import type { Browser } from 'puppeteer-core';

/**
 * Shared mutable holder for a named browser. All PageSessions on the same
 * named browser plus the NamedBrowserShutdown hook share one holder, so a
 * relaunch performed by any session is visible to every other session and to
 * shutdown — preserving the 1-browser-N-pages invariant.
 *
 * The raw `getBrowserToken(name)` DI token still provides the bootstrap
 * `Browser` directly (public API); this holder is additional internal wiring.
 */
export class BrowserHolder {
  private relaunching?: Promise<Browser>;

  constructor(public browser: Browser) {}

  /**
   * Relaunches/reconnects the browser, deduped across every PageSession
   * sharing this holder — concurrent callers all await the same in-flight
   * relaunch instead of each racing to overwrite `this.browser`.
   */
  async relaunch(factory: () => Promise<Browser>): Promise<Browser> {
    if (this.browser.connected) return this.browser;

    this.relaunching ??= factory().then((browser) => {
      this.browser = browser;
      return browser;
    });
    try {
      return await this.relaunching;
    } finally {
      this.relaunching = undefined;
    }
  }
}
