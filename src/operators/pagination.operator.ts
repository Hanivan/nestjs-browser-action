import type { Page, ElementHandle } from 'puppeteer-core';
import { LoggerWithLevel } from '../utils/logger.util';
import { delay } from '../utils/delay.util';
import { isXPathSelector } from '../utils/dom.util';
import type { PaginationOptions } from '../interfaces/types';

const isTargetClosed = (err: unknown): boolean =>
  err instanceof Error &&
  (err.message.includes('Target closed') ||
    err.message.includes('No target with given id') ||
    err.message.includes('detached Frame') ||
    err.message.includes('Attempted to use detached') ||
    err.message.includes('Execution context was destroyed') ||
    err.message.includes('context was destroyed') ||
    err.message.includes('Session closed') ||
    err.message.includes('Navigating frame was detached'));

/**
 * Stateless pagination loop drivers shared by BrowserActionService and
 * (later) PageController. Constructed per-caller with the deps it needs;
 * holds no per-request page state.
 *
 * `resolvePagination` (link-based pagination resolution) stays on
 * ContainerOperator — it's called from executeContainerExtraction and
 * WorkflowOperator's extractPagination action, both of which already hold a
 * ContainerOperator reference. This operator owns only the four pagination
 * *loop drivers* (click-next / load-more / infinite-scroll / url-increment)
 * that evaluateWebsite's paginated path delegates to.
 */
export class PaginationOperator {
  constructor(private readonly logger: LoggerWithLevel) {}

  /**
   * Find a single element by CSS selector or XPath expression.
   * Returns an ElementHandle cast to Element so callers can call .click()
   * and other Element methods.
   */
  private async findPaginationElement(
    page: Page,
    selector: string,
  ): Promise<ElementHandle<Element> | null> {
    if (!isXPathSelector(selector)) {
      return page.$(selector);
    }
    // XPath: use the legacy $x interface if present (for mocks/older versions),
    // otherwise fall back to evaluateHandle.
    const pageWithX = page as unknown as {
      $x?: (s: string) => Promise<ElementHandle<Element>[]>;
    };
    if (typeof pageWithX.$x === 'function') {
      const results = await pageWithX.$x(selector);
      return results[0] ?? null;
    }
    const handle = await page
      .evaluateHandle((sel: string) => {
        const res = document.evaluate(
          sel,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        );
        return res.singleNodeValue as Element | null;
      }, selector)
      .then((h) => h.asElement() as ElementHandle<Element> | null);
    return handle;
  }

  async paginateClickNext<T>(
    page: Page,
    containerFn: (page: Page) => Promise<T[]>,
    opts: PaginationOptions,
  ): Promise<{ items: T[]; pages: number }> {
    const max = opts.maxPages ?? 10;
    const wait = opts.waitAfter ?? 800;
    const all: T[] = [];
    let pages = 0;

    for (let i = 0; i < max; i++) {
      try {
        const items = await containerFn(page);
        all.push(...items);
        pages++;

        if (!opts.selector) break;
        const btn = await this.findPaginationElement(page, opts.selector);
        if (!btn) break;

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
          btn.click(),
        ]);
        await delay(wait);
      } catch (err) {
        if (isTargetClosed(err)) break;
        // Navigation timeout or other recoverable error — return what we have
        if (err instanceof Error && err.message.includes('TimeoutError')) break;
        throw err;
      }
    }

    return { items: all, pages };
  }

  async paginateLoadMore<T>(
    page: Page,
    containerFn: (page: Page) => Promise<T[]>,
    opts: PaginationOptions,
  ): Promise<{ items: T[]; pages: number }> {
    const max = opts.maxPages ?? 10;
    const wait = opts.waitAfter ?? 800;
    let previousCount = 0;
    let clicks = 0;

    let lastItems: T[] = [];
    for (let i = 0; i < max; i++) {
      try {
        const items = await containerFn(page);
        if (items.length === previousCount) {
          return { items, pages: clicks + 1 };
        }
        lastItems = items;
        previousCount = items.length;

        if (!opts.selector) break;
        const btn = await this.findPaginationElement(page, opts.selector);
        if (!btn) break;

        await btn.click();
        clicks++;
        await delay(wait);
      } catch (err) {
        if (isTargetClosed(err)) break;
        throw err;
      }
    }

    try {
      const finalItems = await containerFn(page);
      return { items: finalItems, pages: clicks + 1 };
    } catch (err) {
      if (isTargetClosed(err)) return { items: lastItems, pages: clicks + 1 };
      throw err;
    }
  }

  async paginateInfiniteScroll<T>(
    page: Page,
    containerFn: (page: Page) => Promise<T[]>,
    opts: PaginationOptions,
  ): Promise<{ items: T[]; pages: number }> {
    const max = opts.maxPages ?? 10;
    const wait = opts.waitAfter ?? 800;
    let previousCount = 0;
    let scrolls = 0;

    let lastItems: T[] = [];
    for (let i = 0; i < max; i++) {
      try {
        const items = await containerFn(page);

        if (opts.endSelector) {
          const endEl = await this.findPaginationElement(
            page,
            opts.endSelector,
          );
          if (endEl) return { items, pages: scrolls + 1 };
        }

        if (items.length === previousCount)
          return { items, pages: scrolls + 1 };
        lastItems = items;
        previousCount = items.length;

        if (opts.selector) {
          const sentinel = await this.findPaginationElement(
            page,
            opts.selector,
          );
          if (sentinel) {
            await page.evaluate((el) => el.scrollIntoView(), sentinel);
          } else {
            await page.evaluate(() =>
              window.scrollTo(0, document.body.scrollHeight),
            );
          }
        } else {
          await page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight),
          );
        }

        scrolls++;
        await delay(wait);
      } catch (err) {
        if (isTargetClosed(err)) break;
        throw err;
      }
    }

    try {
      const finalItems = await containerFn(page);
      return { items: finalItems, pages: scrolls + 1 };
    } catch (err) {
      if (isTargetClosed(err)) return { items: lastItems, pages: scrolls + 1 };
      throw err;
    }
  }

  async paginateUrlIncrement<T>(
    urlTemplate: string,
    containerFn: (url: string) => Promise<T[]>,
    opts: PaginationOptions,
    startPage: number,
  ): Promise<{ items: T[]; pages: number }> {
    const max = opts.maxPages ?? 10;
    const wait = opts.waitAfter ?? 800;
    const all: T[] = [];
    let pagesScraped = 0;

    for (let p = startPage; p < startPage + max; p++) {
      try {
        const url = urlTemplate.replace('{page}', String(p));
        const items = await containerFn(url);
        if (items.length === 0) break;
        all.push(...items);
        pagesScraped++;
        if (p < startPage + max - 1) await delay(wait);
      } catch (err) {
        // Return whatever was accumulated so far rather than losing all pages
        if (isTargetClosed(err)) break;
        throw err;
      }
    }

    return { items: all, pages: pagesScraped };
  }
}
