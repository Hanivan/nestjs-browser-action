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
  constructor(public browser: Browser) {}
}
