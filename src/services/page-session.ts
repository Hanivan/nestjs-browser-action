import type { Browser, HTTPRequest, Page } from 'puppeteer-core';
import type { NavigateOptions } from './page.service';
import type { BrowserActionOptions } from '../interfaces/browser-action-options';
import { BrowserHolder } from './browser-holder';
import { LoggerWithLevel } from '../utils/logger.util';
import {
  launchLocalBrowser,
  connectRemoteBrowser,
} from '../utils/browser-launcher';

/**
 * Stateful holder for a single named page. Auto-recreates the page (or, if
 * needed, the underlying browser) when it dies, so callers always get back a
 * live page from `ensureAlive()`/`goto()` without managing lifecycle
 * themselves.
 *
 * The browser lives in a shared `BrowserHolder` so a relaunch by one session
 * is seen by every session (and the shutdown hook) on the same named browser.
 */
export class PageSession {
  private readonly holder: BrowserHolder;
  private currentPage: Page;
  private interceptionEnabled = false;
  private interceptionHandler?: (request: HTTPRequest) => void;
  private recreating?: Promise<Page>;
  private focusEmulatedOn?: Page;

  constructor(
    private readonly name: string,
    browser: Browser | BrowserHolder,
    page: Page,
    private readonly options: BrowserActionOptions,
    private readonly logger: LoggerWithLevel,
  ) {
    this.holder =
      browser instanceof BrowserHolder ? browser : new BrowserHolder(browser);
    this.currentPage = page;
  }

  get page(): Page {
    return this.currentPage;
  }

  get browser(): Browser {
    return this.holder.browser;
  }

  async ensureAlive(): Promise<Page> {
    if (!this.currentPage.isClosed() && this.holder.browser.connected) {
      return this.currentPage;
    }

    // Concurrent callers must share one recreate — otherwise the loser's
    // newPage() tab is orphaned open forever.
    this.recreating ??= this.recreate();
    try {
      return await this.recreating;
    } finally {
      this.recreating = undefined;
    }
  }

  private async recreate(): Promise<Page> {
    if (this.holder.browser.connected) {
      this.logger.debug(`[PAGE-SESSION:${this.name}] page dead, reopening`);
      this.currentPage = await this.holder.browser.newPage();
    } else {
      this.logger.debug(
        `[PAGE-SESSION:${this.name}] browser dead, relaunching`,
      );
      this.holder.browser = this.options.remote
        ? await connectRemoteBrowser(this.options.remote, this.logger)
        : await launchLocalBrowser(this.options, undefined, this.logger);
      this.currentPage = await this.holder.browser.newPage();
    }

    // Old page (and its listener) is gone — drop the stale handler ref so
    // applyInterception registers exactly one listener on the new page.
    this.interceptionHandler = undefined;
    if (this.interceptionEnabled) {
      await this.applyInterception(this.currentPage);
    }

    return this.currentPage;
  }

  private async emulateFocus(page: Page): Promise<void> {
    if (this.focusEmulatedOn === page) return;
    try {
      const client = await page.createCDPSession();
      await client.send('Emulation.setFocusEmulationEnabled', {
        enabled: true,
      });
      // Session stays open on purpose — closing it disables the emulation.
      this.focusEmulatedOn = page;
    } catch {
      /* best-effort — remote browsers may reject; fall through unfocused */
    }
  }

  async goto(url: string, options?: NavigateOptions): Promise<Page> {
    const page = await this.ensureAlive();

    // Chromium pauses rAF-driven in-page work (e.g. humanized typing) on
    // unfocused tabs even with backgrounding-disable launch flags, which
    // stalls workflows until the tab is focused. Focus *emulation* makes
    // this page believe it's focused without stealing real focus, so
    // multiple pages on one browser can all run concurrently — unlike
    // bringToFront(), which is exclusive per browser.
    await this.emulateFocus(page);

    const gotoOptions: {
      waitUntil?: NavigateOptions['waitUntil'];
      timeout?: number;
    } = {};
    if (options?.waitUntil) gotoOptions.waitUntil = options.waitUntil;
    if (options?.timeout !== undefined) gotoOptions.timeout = options.timeout;

    try {
      await page.goto(
        url,
        Object.keys(gotoOptions).length ? gotoOptions : undefined,
      );
    } catch (err) {
      // SPAs often block domcontentloaded/load lifecycle indefinitely while
      // the HTML structure is already present. Allow navigation timeout through
      // so extraction can still run on whatever the page has rendered.
      if (err instanceof Error && err.message.includes('Navigation timeout')) {
        this.logger.warn(`Navigation timeout on goto — continuing: ${url}`);
      } else {
        throw err;
      }
    }

    return page;
  }

  async setInterception(enabled: boolean): Promise<void> {
    this.interceptionEnabled = enabled;
    if (enabled) {
      await this.applyInterception(this.currentPage);
    } else {
      if (this.interceptionHandler) {
        this.currentPage.off('request', this.interceptionHandler);
        this.interceptionHandler = undefined;
      }
      await this.currentPage.setRequestInterception(false);
    }
  }

  private async applyInterception(page: Page): Promise<void> {
    // Remove any previously-registered handler so repeated enables never
    // accumulate listeners on the persistent page.
    if (this.interceptionHandler) {
      page.off('request', this.interceptionHandler);
    }
    const blocked = new Set(['stylesheet', 'image', 'media', 'font']);
    await page.setRequestInterception(true);
    this.interceptionHandler = (request: HTTPRequest) => {
      if (request.isInterceptResolutionHandled()) return;
      if (blocked.has(request.resourceType())) {
        void request.abort();
      } else {
        void request.continue();
      }
    };
    page.on('request', this.interceptionHandler);
  }

  async close(): Promise<void> {
    try {
      await this.currentPage.close();
    } catch {
      /* page already closed externally */
    }
  }
}
