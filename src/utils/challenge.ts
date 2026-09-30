import type { ElementHandle, Page, Protocol } from 'puppeteer-core';
import { delay } from './delay.util';
import { offsetPoint, type CursorLike } from './ghost-cursor';

export type ChallengeResult = 'passed' | 'failed' | 'none';

const INTERSTITIAL_TITLE = 'Just a moment...';
// JS-rendered widgets (turnstile.render without .cf-turnstile) only expose
// their response input; its parent div is the widget box.
const JS_WIDGET_INPUT = 'input[id^="cf-chl-widget-"][id$="_response"]';
const WIDGET = '.cf-turnstile';
const WIDGET_TOKEN = `.cf-turnstile [name="cf-turnstile-response"], ${JS_WIDGET_INPUT}`;
const RESPONSE_INPUT = 'input[name="cf-turnstile-response"]';
// Fallback guess: checkbox sits ~30px from the widget's left edge, vertically centered.
const CHECKBOX_OFFSET = { x: 30, y: 'center' } as const;
const CF_FRAME = 'challenges.cloudflare.com';
const CHECKBOX_LABEL = 'Verify you are human';

type Point = { x: number; y: number };

function findCheckbox(node: Protocol.DOM.Node): Protocol.DOM.Node | undefined {
  const a = node.attributes ?? [];
  for (let i = 0; i < a.length; i += 2)
    if (a[i] === 'aria-label' && a[i + 1] === CHECKBOX_LABEL) return node;
  for (const child of [
    ...(node.children ?? []),
    ...(node.shadowRoots ?? []),
    ...(node.contentDocument ? [node.contentDocument] : []),
  ]) {
    const hit = findCheckbox(child);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * The real "Verify you are human" checkbox lives in a cross-origin iframe
 * behind two closed shadow roots — unreachable via page.$. Pierce the iframe
 * target's DOM over CDP and map its box to page coordinates.
 * Returns null while the widget hasn't rendered; throws when the browser
 * lacks the CDP methods (e.g. Obscura has no DOM.getFrameOwner).
 */
async function locateCheckbox(page: Page): Promise<Point | null> {
  const frame = page.frames().find((f) => f.url().includes(CF_FRAME));
  const frameBox = await (await frame?.frameElement())?.boundingBox();
  const target = page
    .browser()
    .targets()
    .find((t) => t.url() === frame?.url());
  if (!frameBox || !target) return null;
  const session = await target.createCDPSession();
  try {
    const { root } = await session.send('DOM.getDocument', {
      depth: -1,
      pierce: true,
    });
    const node = findCheckbox(root);
    if (!node) return null;
    const { model } = await session.send('DOM.getBoxModel', {
      backendNodeId: node.backendNodeId,
    });
    const [x1, y1, , , , y3] = model.border;
    const h = y3 - y1;
    // Input spans the whole label; the tick box is the h×h square at its left.
    return { x: frameBox.x + x1 + h / 2, y: frameBox.y + y1 + h / 2 };
  } finally {
    await session.detach().catch(() => undefined);
  }
}

async function clickCheckbox(
  page: Page,
  cursor: CursorLike,
  fallback: () => Promise<Point | null>,
  wait: number,
): Promise<void> {
  // Checkbox renders a few seconds after the iframe — poll briefly. A thrown
  // CDP error won't fix itself, so stop polling and use the guess.
  const end = Date.now() + wait;
  let point: Point | null = null;
  try {
    point = await locateCheckbox(page);
    while (!point && Date.now() < end) {
      await delay(500);
      point = await locateCheckbox(page);
    }
  } catch {
    /* unsupported CDP (e.g. Obscura) — fall back to the offset guess */
  }
  point ??= await fallback();
  if (!point) return;
  await cursor.moveTo(point);
  await cursor.click();
}

/**
 * Cloudflare Turnstile widget / "Just a moment..." interstitial.
 * Managed mode often auto-passes, so wait first and click only if still challenged.
 * Never throws on challenge failure — returns 'failed'.
 */
export async function solveChallenge(
  page: Page,
  cursor: CursorLike,
  timeout = 20_000,
  waits = { interstitial: 5_000, widget: 3_000, checkbox: 5_000 },
): Promise<ChallengeResult> {
  const onInterstitial = () =>
    page.title().then(
      (t) => t === INTERSTITIAL_TITLE,
      () => !page.isClosed(),
    );

  if (await onInterstitial()) {
    await delay(waits.interstitial);
    if (await onInterstitial()) {
      await clickCheckbox(
        page,
        cursor,
        async () => {
          // Fallback: guess from the hidden input's container.
          const box = await page
            .$eval(RESPONSE_INPUT, (el) => {
              const r = el.parentElement!.getBoundingClientRect();
              return { x: r.x, y: r.y, width: r.width, height: r.height };
            })
            .catch(() => null);
          return box?.height ? offsetPoint(box, CHECKBOX_OFFSET) : null;
        },
        waits.checkbox,
      );
    }
    return page
      .waitForFunction(
        (t) => document.title !== t,
        { timeout },
        INTERSTITIAL_TITLE,
      )
      .then(
        () => 'passed' as const,
        () => 'failed' as const,
      );
  }

  const jsInput = async () => {
    const input = await page.$(JS_WIDGET_INPUT);
    return input
      ? ((await input.evaluateHandle(
          (el) => el.parentElement!,
        )) as unknown as ElementHandle<Element>)
      : null;
  };
  const widget = (await page.$(WIDGET)) ?? (await jsInput());
  if (!widget) return 'none';

  const hasToken = () =>
    page
      .$eval(WIDGET_TOKEN, (el) => !!(el as HTMLInputElement).value)
      .catch(() => false);
  await delay(waits.widget);
  if (!(await hasToken())) {
    // moveTo doesn't auto-scroll — ensure the widget is on-screen before
    // reading its box, or the click offset lands off-viewport.
    await widget.scrollIntoView();
    await clickCheckbox(
      page,
      cursor,
      async () => {
        const box = await widget.boundingBox();
        return box ? offsetPoint(box, CHECKBOX_OFFSET) : null;
      },
      waits.checkbox,
    );
  }
  return page
    .waitForFunction(
      (sel) => !!document.querySelector<HTMLInputElement>(sel)?.value,
      { timeout },
      WIDGET_TOKEN,
    )
    .then(
      () => 'passed' as const,
      () => 'failed' as const,
    );
}
