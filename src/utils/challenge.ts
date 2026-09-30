import type { Page } from 'puppeteer-core';
import { delay } from './delay.util';
import { offsetPoint, type CursorLike } from './ghost-cursor';

export type ChallengeResult = 'passed' | 'failed' | 'none';

const INTERSTITIAL_TITLE = 'Just a moment...';
const WIDGET = '.cf-turnstile';
const WIDGET_TOKEN = '.cf-turnstile [name="cf-turnstile-response"]';
const RESPONSE_INPUT = 'input[name="cf-turnstile-response"]';
// Checkbox sits ~30px from the widget's left edge, vertically centered.
const CHECKBOX_OFFSET = { x: 30, y: 'center' } as const;

/**
 * Cloudflare Turnstile widget / "Just a moment..." interstitial.
 * Managed mode often auto-passes, so wait first and click only if still challenged.
 * Never throws on challenge failure — returns 'failed'.
 */
export async function solveChallenge(
  page: Page,
  cursor: CursorLike,
  timeout = 20_000,
  waits = { interstitial: 5_000, widget: 3_000 },
): Promise<ChallengeResult> {
  const onInterstitial = () =>
    page.title().then(
      (t) => t === INTERSTITIAL_TITLE,
      () => !page.isClosed(),
    );

  if (await onInterstitial()) {
    await delay(waits.interstitial);
    if (await onInterstitial()) {
      // Widget iframe is in a closed shadow root; only the hidden input is reachable.
      const box = await page
        .$eval(RESPONSE_INPUT, (el) => {
          const r = el.parentElement!.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        })
        .catch(() => null);
      if (box?.height) {
        await cursor.moveTo(offsetPoint(box, CHECKBOX_OFFSET));
        await cursor.click();
      }
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

  const widget = await page.$(WIDGET);
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
    const box = await widget.boundingBox();
    if (box) {
      await cursor.moveTo(offsetPoint(box, CHECKBOX_OFFSET));
      await cursor.click();
    }
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
