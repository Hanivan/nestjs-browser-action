import { NamedBrowserShutdown } from './named-browser-shutdown';
import { BrowserHolder } from './browser-holder';
import {
  claimBrowserName,
  releaseBrowserName,
  registerPages,
} from '../common/tokens';
import type { Browser } from 'puppeteer-core';

function mockBrowser(connected = true): Browser {
  return {
    connected,
    close: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  } as unknown as Browser;
}

describe('NamedBrowserShutdown', () => {
  afterEach(() => {
    releaseBrowserName('shut');
  });

  it('closes the CURRENT holder.browser, not the bootstrap one', async () => {
    const bootstrap = mockBrowser();
    const relaunched = mockBrowser();
    const holder = new BrowserHolder(bootstrap);
    const shutdown = new NamedBrowserShutdown('shut', holder, false);

    // Simulate a PageSession relaunch swapping the browser in the holder
    holder.browser = relaunched;

    await shutdown.onApplicationShutdown();

    expect(relaunched.close).toHaveBeenCalled();
    expect(bootstrap.close).not.toHaveBeenCalled();
  });

  it('disconnects instead of closing for remote browsers', async () => {
    const browser = mockBrowser();
    const shutdown = new NamedBrowserShutdown(
      'shut',
      new BrowserHolder(browser),
      true,
    );

    await shutdown.onApplicationShutdown();

    expect(browser.disconnect).toHaveBeenCalled();
    expect(browser.close).not.toHaveBeenCalled();
  });

  it('releases the browser name even when browser is already gone', async () => {
    claimBrowserName('shut');
    const shutdown = new NamedBrowserShutdown(
      'shut',
      new BrowserHolder(mockBrowser(false)),
      false,
    );

    await shutdown.onApplicationShutdown();

    // Name released — claiming again must not throw
    expect(() => claimBrowserName('shut')).not.toThrow();
  });

  it('stops the health check before closing the browser, when one is provided', async () => {
    const browser = mockBrowser();
    const holder = new BrowserHolder(browser);
    const healthCheck = { stop: jest.fn() };
    const shutdown = new NamedBrowserShutdown(
      'shut',
      holder,
      false,
      healthCheck as unknown as import('./browser-health-check').BrowserHealthCheck,
    );

    await shutdown.onApplicationShutdown();

    expect(healthCheck.stop).toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalled();
  });

  it('works with no health check provided (backward-compatible 3-arg construction)', async () => {
    const browser = mockBrowser();
    const shutdown = new NamedBrowserShutdown(
      'shut',
      new BrowserHolder(browser),
      false,
    );

    await expect(shutdown.onApplicationShutdown()).resolves.not.toThrow();
  });

  it('releases the page count for this browser name on shutdown', async () => {
    registerPages('shut', 3);
    const browser = mockBrowser();
    const shutdown = new NamedBrowserShutdown(
      'shut',
      new BrowserHolder(browser),
      false,
    );

    await shutdown.onApplicationShutdown();

    // If the count was released, a fresh registerPages call starts back at 1.
    expect(registerPages('shut', 1)).toBe(1);
  });
});
