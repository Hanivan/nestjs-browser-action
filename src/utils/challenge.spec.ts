import type { Page } from 'puppeteer-core';
import { solveChallenge } from './challenge';

const NO_WAIT = { interstitial: 0, widget: 0, checkbox: 0 };
const cursor = { click: jest.fn(), move: jest.fn(), moveTo: jest.fn() };
// Call-order tracker for the widget handle's scrollIntoView/boundingBox mocks.
let widgetCallOrder: string[] = [];

const widgetHandle = () => ({
  scrollIntoView: jest.fn(async () => {
    widgetCallOrder.push('scrollIntoView');
  }),
  boundingBox: async () => {
    widgetCallOrder.push('boundingBox');
    return { x: 100, y: 200, width: 300, height: 64 };
  },
});

function makePage(o: {
  titles?: string[]; // successive page.title() results
  titleError?: Error; // page.title() rejects with this instead
  widget?: boolean;
  jsWidget?: boolean; // only the JS-rendered response input exists
  tokens?: boolean[]; // successive token checks
  inputBox?: { x: number; y: number; width: number; height: number } | null;
  pass?: boolean; // waitForFunction resolves?
  isClosed?: boolean;
  widgetError?: Error; // page.$ rejects with this instead of resolving
}): Page {
  const titles = [...(o.titles ?? [])];
  const tokens = [...(o.tokens ?? [])];
  return {
    title: jest.fn(async () => {
      if (o.titleError) throw o.titleError;
      return titles.length > 1 ? titles.shift() : titles[0];
    }),
    isClosed: jest.fn(() => o.isClosed ?? false),
    $: jest.fn(async (sel: string) => {
      if (o.widgetError) throw o.widgetError;
      if (o.jsWidget)
        return sel === '.cf-turnstile'
          ? null
          : { evaluateHandle: async () => widgetHandle() };
      return o.widget ? widgetHandle() : null;
    }),
    $eval: jest.fn(async (sel: string) => {
      if (sel.includes('.cf-turnstile'))
        return tokens.length > 1 ? tokens.shift() : tokens[0];
      if (o.inputBox === null) throw new Error('no input');
      return o.inputBox;
    }),
    waitForFunction: jest.fn(async () => {
      if (!o.pass) throw new Error('timeout');
    }),
  } as unknown as Page;
}

beforeEach(() => {
  jest.clearAllMocks();
  widgetCallOrder = [];
});

it('returns none on a normal page without waiting', async () => {
  const started = Date.now();
  const r = await solveChallenge(makePage({ titles: ['Home'] }), cursor, 1000);
  expect(r).toBe('none');
  expect(Date.now() - started).toBeLessThan(100);
});

it('interstitial auto-pass: no click', async () => {
  const r = await solveChallenge(
    makePage({ titles: ['Just a moment...', 'Home'], pass: true }),
    cursor,
    1000,
    NO_WAIT,
  );
  expect(r).toBe('passed');
  expect(cursor.click).not.toHaveBeenCalled();
});

it('interstitial still challenged: clicks input parent at (30, center)', async () => {
  const page = makePage({
    titles: ['Just a moment...'],
    inputBox: { x: 10, y: 20, width: 0, height: 60 },
    pass: true,
  });
  const r = await solveChallenge(page, cursor, 1000, NO_WAIT);
  expect(cursor.moveTo).toHaveBeenCalledWith({ x: 40, y: 50 });
  expect(cursor.click).toHaveBeenCalled();
  expect(r).toBe('passed');
});

it('interstitial without reachable input: no click, failed on timeout, no throw', async () => {
  const page = makePage({
    titles: ['Just a moment...'],
    inputBox: null,
    pass: false,
  });
  await expect(solveChallenge(page, cursor, 10, NO_WAIT)).resolves.toBe(
    'failed',
  );
  expect(cursor.click).not.toHaveBeenCalled();
});

it('widget auto-pass: no click', async () => {
  const r = await solveChallenge(
    makePage({ titles: ['Login'], widget: true, tokens: [true], pass: true }),
    cursor,
    1000,
    NO_WAIT,
  );
  expect(r).toBe('passed');
  expect(cursor.click).not.toHaveBeenCalled();
});

it('widget empty token: clicks widget at (30, center)', async () => {
  const r = await solveChallenge(
    makePage({ titles: ['Login'], widget: true, tokens: [false], pass: true }),
    cursor,
    1000,
    NO_WAIT,
  );
  expect(cursor.moveTo).toHaveBeenCalledWith({ x: 130, y: 232 });
  expect(cursor.click).toHaveBeenCalled();
  expect(r).toBe('passed');
});

it('widget: scrolls into view before reading its bounding box', async () => {
  await solveChallenge(
    makePage({ titles: ['Login'], widget: true, tokens: [false], pass: true }),
    cursor,
    1000,
    NO_WAIT,
  );
  expect(widgetCallOrder).toEqual(['scrollIntoView', 'boundingBox']);
});

it('closed page: title() rejects, isClosed true, $ rejects → throws (not failed)', async () => {
  const page = makePage({
    titleError: new Error('Protocol error'),
    isClosed: true,
    widgetError: new Error('Target closed'),
  });
  await expect(solveChallenge(page, cursor, 1000, NO_WAIT)).rejects.toThrow(
    'Target closed',
  );
});

it('widget timeout → failed', async () => {
  const r = await solveChallenge(
    makePage({ titles: ['Login'], widget: true, tokens: [false], pass: false }),
    cursor,
    10,
    NO_WAIT,
  );
  expect(r).toBe('failed');
});

it('widget without .cf-turnstile: finds the JS-rendered widget by its response input', async () => {
  const page = makePage({
    titles: ['Home'],
    jsWidget: true,
    tokens: [false],
    pass: true,
  });
  const r = await solveChallenge(page, cursor, 1000, NO_WAIT);
  const widgetSels = (page.$ as jest.Mock).mock.calls.map(([sel]) => sel);
  const [, , tokenSel] = (page.waitForFunction as jest.Mock).mock.calls[0] as [
    unknown,
    unknown,
    string,
  ];
  expect(widgetSels).toEqual([
    '.cf-turnstile',
    'input[id^="cf-chl-widget-"][id$="_response"]',
  ]);
  expect(tokenSel).toContain('input[id^="cf-chl-widget-"][id$="_response"]');
  expect(cursor.moveTo).toHaveBeenCalledWith({ x: 130, y: 232 });
  expect(cursor.click).toHaveBeenCalled();
  expect(r).toBe('passed');
});

describe('real checkbox inside the Turnstile iframe', () => {
  const CF = 'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/x';
  const detach = jest.fn(async () => undefined);
  // Closed shadow root → iframe doc → closed shadow root → label > input.
  const root = {
    backendNodeId: 1,
    children: [
      {
        backendNodeId: 2,
        shadowRoots: [
          {
            backendNodeId: 3,
            children: [
              {
                backendNodeId: 7,
                localName: 'input',
                attributes: [
                  'type',
                  'checkbox',
                  'aria-label',
                  'Verify you are human',
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const send = jest.fn(async (method: string) =>
    method === 'DOM.getDocument'
      ? { root }
      : { model: { border: [9, 20, 173, 20, 173, 44, 9, 44] } },
  );

  function withFrame(page: Page, frameElement: () => Promise<unknown>): Page {
    return Object.assign(page, {
      frames: () => [{ url: () => CF, frameElement }],
      browser: () => ({
        targets: () => [
          { url: () => CF, createCDPSession: async () => ({ send, detach }) },
        ],
      }),
    }) as unknown as Page;
  }
  const iframe = async () => ({
    boundingBox: async () => ({ x: 500, y: 300, width: 300, height: 65 }),
  });

  it('interstitial: clicks the checkbox via iframe box + in-frame box', async () => {
    const page = withFrame(
      makePage({
        titles: ['Just a moment...'],
        inputBox: { x: 10, y: 20, width: 0, height: 60 },
        pass: true,
      }),
      iframe,
    );
    await solveChallenge(page, cursor, 1000, NO_WAIT);
    // Left square of the 24px-tall box: x = 9 + 12, y = 20 + 12.
    expect(cursor.moveTo).toHaveBeenCalledWith({ x: 521, y: 332 });
    expect(send).toHaveBeenCalledWith('DOM.getBoxModel', { backendNodeId: 7 });
    expect(detach).toHaveBeenCalled();
  });

  it('widget: clicks the located checkbox too', async () => {
    const page = withFrame(
      makePage({
        titles: ['Login'],
        widget: true,
        tokens: [false],
        pass: true,
      }),
      iframe,
    );
    await solveChallenge(page, cursor, 1000, NO_WAIT);
    expect(cursor.moveTo).toHaveBeenCalledWith({ x: 521, y: 332 });
  });

  it('falls back to the +30px guess when CDP lookup fails (e.g. Obscura), without re-polling', async () => {
    const frameElement = jest.fn(async () => {
      throw new Error('Unknown DOM method: getFrameOwner');
    });
    const page = withFrame(
      makePage({
        titles: ['Just a moment...'],
        inputBox: { x: 10, y: 20, width: 0, height: 60 },
        pass: false,
      }),
      frameElement,
    );
    await expect(
      solveChallenge(page, cursor, 10, { ...NO_WAIT, checkbox: 2_000 }),
    ).resolves.toBe('failed');
    expect(frameElement).toHaveBeenCalledTimes(1);
    expect(cursor.moveTo).toHaveBeenCalledWith({ x: 40, y: 50 });
  });
});
