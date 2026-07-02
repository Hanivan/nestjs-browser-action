import { NamedBrowserShutdown } from './named-browser-shutdown';
import { BrowserHolder } from './browser-holder';
import { claimBrowserName, releaseBrowserName } from '../common/tokens';
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
});
