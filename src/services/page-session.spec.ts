import { PageSession } from './page-session';
import { BrowserHolder } from './browser-holder';
import { LoggerWithLevel } from '../utils/logger.util';
import type { Browser, Page } from 'puppeteer-core';
import * as browserLauncher from '../utils/browser-launcher';

jest.mock('../utils/browser-launcher', () => ({
  launchLocalBrowser: jest.fn(),
  connectRemoteBrowser: jest.fn(),
}));

const logger = new LoggerWithLevel('test', 'error');

function mockPage(closed = false): Page {
  return {
    isClosed: jest.fn().mockReturnValue(closed),
    close: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn().mockResolvedValue(null),
    setRequestInterception: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as Page;
}

function mockBrowser(connected = true, nextPage?: Page): Browser {
  return {
    connected,
    newPage: jest.fn().mockResolvedValue(nextPage ?? mockPage()),
  } as unknown as Browser;
}

describe('PageSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns current page when alive', async () => {
    const page = mockPage();
    const browser = mockBrowser();
    const s = new PageSession('t', browser, page, {}, logger);
    await expect(s.ensureAlive()).resolves.toBe(page);
    expect(browser.newPage).not.toHaveBeenCalled();
  });

  it('recreates page when closed and browser alive', async () => {
    const fresh = mockPage();
    const browser = mockBrowser(true, fresh);
    const s = new PageSession('t', browser, mockPage(true), {}, logger);
    await expect(s.ensureAlive()).resolves.toBe(fresh);
    expect(s.page).toBe(fresh);
  });

  it('goto tolerates navigation timeout', async () => {
    const page = mockPage();
    (page.goto as jest.Mock).mockRejectedValue(
      new Error('Navigation timeout of 30000 ms exceeded'),
    );
    const s = new PageSession('t', mockBrowser(), page, {}, logger);
    await expect(s.goto('https://x.test')).resolves.toBe(page);
  });

  it('goto rethrows non-timeout errors', async () => {
    const page = mockPage();
    (page.goto as jest.Mock).mockRejectedValue(new Error('net::ERR_FAILED'));
    const s = new PageSession('t', mockBrowser(), page, {}, logger);
    await expect(s.goto('https://x.test')).rejects.toThrow('net::ERR_FAILED');
  });

  it('close() closes page and next ensureAlive recreates', async () => {
    const fresh = mockPage();
    const browser = mockBrowser(true, fresh);
    const first = mockPage();
    const s = new PageSession('t', browser, first, {}, logger);
    await s.close();
    expect(first.close).toHaveBeenCalled();
    (first.isClosed as jest.Mock).mockReturnValue(true);
    await expect(s.ensureAlive()).resolves.toBe(fresh);
  });

  it('re-applies interception after recreate', async () => {
    const fresh = mockPage();
    const browser = mockBrowser(true, fresh);
    const s = new PageSession('t', browser, mockPage(true), {}, logger);
    await s.setInterception(true);
    await s.ensureAlive();
    expect(fresh.setRequestInterception).toHaveBeenCalledWith(true);
  });

  it('setInterception(true) twice registers exactly one listener', async () => {
    const page = mockPage();
    const s = new PageSession('t', mockBrowser(), page, {}, logger);

    await s.setInterception(true);
    await s.setInterception(true);

    expect(page.on).toHaveBeenCalledTimes(2);
    const firstHandler = (page.on as jest.Mock).mock.calls[0][1] as unknown;
    // Second enable must remove the first handler before adding the new one
    expect(page.off).toHaveBeenCalledTimes(1);
    expect(page.off).toHaveBeenCalledWith('request', firstHandler);
    const registered = (page.on as jest.Mock).mock.calls.filter(
      ([event]) => event === 'request',
    ).length;
    const removed = (page.off as jest.Mock).mock.calls.filter(
      ([event]) => event === 'request',
    ).length;
    expect(registered - removed).toBe(1);
  });

  it('setInterception(false) after true removes the listener', async () => {
    const page = mockPage();
    const s = new PageSession('t', mockBrowser(), page, {}, logger);

    await s.setInterception(true);
    const handler = (page.on as jest.Mock).mock.calls[0][1] as unknown;

    await s.setInterception(false);

    expect(page.off).toHaveBeenCalledWith('request', handler);
    expect(page.setRequestInterception).toHaveBeenLastCalledWith(false);
  });

  it('setInterception(false) without prior enable does not call off', async () => {
    const page = mockPage();
    const s = new PageSession('t', mockBrowser(), page, {}, logger);

    await s.setInterception(false);

    expect(page.off).not.toHaveBeenCalled();
    expect(page.setRequestInterception).toHaveBeenCalledWith(false);
  });

  it('recreate registers exactly one listener on the NEW page, old handler discarded', async () => {
    const dead = mockPage();
    const fresh = mockPage();
    const browser = mockBrowser(true, fresh);
    const s = new PageSession('t', browser, dead, {}, logger);

    await s.setInterception(true);
    expect(dead.on).toHaveBeenCalledTimes(1);

    (dead.isClosed as jest.Mock).mockReturnValue(true);
    await s.ensureAlive();

    // New page gets exactly one listener; old page's handler ref discarded so
    // no off() is attempted against the fresh page
    expect(fresh.on).toHaveBeenCalledTimes(1);
    expect(fresh.off).not.toHaveBeenCalled();

    // Re-enabling on the fresh page removes only its own handler
    const freshHandler = (fresh.on as jest.Mock).mock.calls[0][1] as unknown;
    await s.setInterception(true);
    expect(fresh.off).toHaveBeenCalledWith('request', freshHandler);
    expect(fresh.on).toHaveBeenCalledTimes(2);
  });

  it('concurrent ensureAlive calls share one recreate (newPage called once)', async () => {
    const fresh = mockPage();
    const browser = {
      connected: true,
      newPage: jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            process.nextTick(() => resolve(fresh));
          }),
      ),
    } as unknown as Browser;
    const s = new PageSession('t', browser, mockPage(true), {}, logger);

    const [a, b] = await Promise.all([s.ensureAlive(), s.ensureAlive()]);

    expect(browser.newPage).toHaveBeenCalledTimes(1);
    expect(a).toBe(fresh);
    expect(b).toBe(fresh);
  });

  it('recreate guard clears after failure so next ensureAlive retries', async () => {
    const fresh = mockPage();
    const browser = {
      connected: true,
      newPage: jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(fresh),
    } as unknown as Browser;
    const s = new PageSession('t', browser, mockPage(true), {}, logger);

    await expect(s.ensureAlive()).rejects.toThrow('boom');
    await expect(s.ensureAlive()).resolves.toBe(fresh);
    expect(browser.newPage).toHaveBeenCalledTimes(2);
  });

  it('two sessions sharing one holder see the same relaunched browser (launcher called once)', async () => {
    const freshA = mockPage();
    const freshB = mockPage();
    const relaunched = {
      connected: true,
      newPage: jest
        .fn()
        .mockResolvedValueOnce(freshA)
        .mockResolvedValueOnce(freshB),
    } as unknown as Browser;
    (browserLauncher.launchLocalBrowser as jest.Mock).mockResolvedValue(
      relaunched,
    );

    const holder = new BrowserHolder(mockBrowser(false));
    const a = new PageSession('t', holder, mockPage(true), {}, logger);
    const b = new PageSession('t', holder, mockPage(true), {}, logger);

    await expect(a.ensureAlive()).resolves.toBe(freshA);
    expect(holder.browser).toBe(relaunched);

    // Session B's dead browser check now reads A's relaunched browser — no
    // second launch, just a new page on the shared browser
    await expect(b.ensureAlive()).resolves.toBe(freshB);
    expect(browserLauncher.launchLocalBrowser).toHaveBeenCalledTimes(1);
    expect(a.browser).toBe(relaunched);
    expect(b.browser).toBe(relaunched);
  });

  it('concurrent relaunches across sessions sharing one holder call the launcher once', async () => {
    const freshA = mockPage();
    const freshB = mockPage();
    const relaunched = {
      connected: true,
      newPage: jest
        .fn()
        .mockResolvedValueOnce(freshA)
        .mockResolvedValueOnce(freshB),
    } as unknown as Browser;
    (browserLauncher.launchLocalBrowser as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          process.nextTick(() => resolve(relaunched));
        }),
    );

    const holder = new BrowserHolder(mockBrowser(false));
    const a = new PageSession('t', holder, mockPage(true), {}, logger);
    const b = new PageSession('t', holder, mockPage(true), {}, logger);

    const [pa, pb] = await Promise.all([a.ensureAlive(), b.ensureAlive()]);

    expect(browserLauncher.launchLocalBrowser).toHaveBeenCalledTimes(1);
    expect(pa).toBe(freshA);
    expect(pb).toBe(freshB);
    expect(holder.browser).toBe(relaunched);
  });

  it('warns and continues when focus emulation CDP call fails', async () => {
    const warnSpy = jest.spyOn(logger, 'warn');
    const page = mockPage();
    (page as unknown as { createCDPSession: jest.Mock }).createCDPSession = jest
      .fn()
      .mockRejectedValue(new Error('not supported'));
    const s = new PageSession('t', mockBrowser(), page, {}, logger);

    await expect(s.goto('https://x.test')).resolves.toBe(page);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('focus emulation failed'),
    );
  });

  it('relaunches local browser when browser is dead (no remote configured)', async () => {
    const fresh = mockPage();
    const relaunchedBrowser = mockBrowser(true, fresh);
    (browserLauncher.launchLocalBrowser as jest.Mock).mockResolvedValue(
      relaunchedBrowser,
    );
    const deadBrowser = mockBrowser(false);
    const s = new PageSession('t', deadBrowser, mockPage(false), {}, logger);
    await expect(s.ensureAlive()).resolves.toBe(fresh);
    expect(browserLauncher.launchLocalBrowser).toHaveBeenCalledWith(
      {},
      undefined,
      logger,
    );
    expect(browserLauncher.connectRemoteBrowser).not.toHaveBeenCalled();
    expect(s.browser).toBe(relaunchedBrowser);
  });

  it('reconnects remote browser when browser is dead and remote configured', async () => {
    const fresh = mockPage();
    const relaunchedBrowser = mockBrowser(true, fresh);
    (browserLauncher.connectRemoteBrowser as jest.Mock).mockResolvedValue(
      relaunchedBrowser,
    );
    const deadBrowser = mockBrowser(false);
    const remote = { browserURL: 'http://localhost:9222' };
    const s = new PageSession(
      't',
      deadBrowser,
      mockPage(false),
      { remote },
      logger,
    );
    await expect(s.ensureAlive()).resolves.toBe(fresh);
    expect(browserLauncher.connectRemoteBrowser).toHaveBeenCalledWith(
      remote,
      logger,
    );
    expect(browserLauncher.launchLocalBrowser).not.toHaveBeenCalled();
    expect(s.browser).toBe(relaunchedBrowser);
  });
});
