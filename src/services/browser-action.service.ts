import { Injectable, Scope, Optional, Inject } from '@nestjs/common';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { isURL } from 'class-validator';
import { sanitizeScreenshotPath } from '../utils/path.util';
import { validateWorkflow } from '../validators/workflow.validator';

import type {
  Page,
  ScreenshotOptions,
  PDFOptions,
  ElementHandle,
  KeyInput,
} from 'puppeteer-core';
import { PageService } from './page.service';
import { CookieService } from './cookie.service';
import { CleansingService } from './cleansing.service';
import { PipeEngine } from '../pipes/pipe-engine';
import type {
  WorkflowDefinition,
  WorkflowAction,
  ActionTarget,
  ActionOptions,
  VariableContext,
} from '../interfaces/workflow-options';
import {
  SelectorMap,
  ScraperOptions,
  ScrapeResult,
  ScrapeAllResult,
  WorkflowResultTyped,
  ContainerDescriptor,
  ContainerScrapeResult,
  PaginationDescriptor,
  PaginationResult,
  EvaluateOptions,
  EvaluateResult,
  PipeOptions,
  FieldDescriptor,
  PaginationOptions,
} from '../interfaces/types';
import { getRandomUserAgent } from '../utils/user-agent.util';
import type { TlsFingerprint } from '../interfaces/tls-fingerprint';
import type { BrowserActionOptions } from '../interfaces/browser-action-options';
import { LoggerWithLevel } from '../utils/logger.util';
import { delay } from '../utils/delay.util';
import { isXPathSelector } from '../utils/dom.util';
import { truncateLog } from '../utils/truncate-log.util';
import {
  BROWSER_ACTION_OPTIONS,
  DEFAULT_ACTION_TIMEOUT,
  DEFAULT_DEBUG_LOG_MAX_LENGTH,
  DEFAULT_NAVIGATION_TIMEOUT,
  DEFAULT_SCROLL_DELAY_MS,
  DEFAULT_SCREENSHOT_FILENAME,
  DEFAULT_ERROR_SCREENSHOT_FILENAME,
  TLS_CAPTURE_URL,
} from '../constants/browser-action.constants';

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

@Injectable({ scope: Scope.TRANSIENT })
export class BrowserActionService {
  private readonly logger: LoggerWithLevel;
  private readonly pipeEngine = new PipeEngine();
  private activeDebugLogMaxLength: number;

  constructor(
    private readonly pageService: PageService,
    private readonly cookieService: CookieService,
    private readonly cleansingService: CleansingService,
    @Optional()
    @Inject(BROWSER_ACTION_OPTIONS)
    private readonly moduleOptions?: BrowserActionOptions,
  ) {
    this.logger = new LoggerWithLevel(
      BrowserActionService.name,
      this.pageService.getLogLevel(),
    );
    this.activeDebugLogMaxLength =
      moduleOptions?.debugLogMaxLength ?? DEFAULT_DEBUG_LOG_MAX_LENGTH;
  }

  async takeScreenshot(
    url: string,
    path: string,
    options?: ScreenshotOptions,
    scraperOptions?: ScraperOptions,
  ): Promise<Buffer> {
    this.logger.debug(
      truncateLog(this.activeDebugLogMaxLength, `Taking screenshot of ${url}`),
    );
    const cloak = scraperOptions?.useRandomUserAgent
      ? { ...scraperOptions?.cloak, userAgent: getRandomUserAgent() }
      : scraperOptions?.cloak;
    const page = await this.pageService.navigateTo(
      url,
      this.buildNavOptions(scraperOptions),
      cloak,
      scraperOptions?.interceptResource,
    );
    try {
      const result = await page.screenshot({ path, ...options });
      return result as unknown as Buffer;
    } finally {
      await this.pageService.closePage();
    }
  }

  async generatePDF(
    url: string,
    path: string,
    options?: PDFOptions,
    scraperOptions?: ScraperOptions,
  ): Promise<Buffer> {
    this.logger.debug(
      truncateLog(this.activeDebugLogMaxLength, `Generating PDF for ${url}`),
    );
    const cloak = scraperOptions?.useRandomUserAgent
      ? { ...scraperOptions?.cloak, userAgent: getRandomUserAgent() }
      : scraperOptions?.cloak;
    const page = await this.pageService.navigateTo(
      url,
      this.buildNavOptions(scraperOptions),
      cloak,
      scraperOptions?.interceptResource,
    );
    try {
      const pdf = await page.pdf({ path, ...options });
      return Buffer.from(pdf);
    } finally {
      await this.pageService.closePage();
    }
  }

  /**
   * Navigate to a TLS-inspection endpoint (default {@link TLS_CAPTURE_URL}),
   * parse the browser's own TLS/HTTP fingerprint, persist it to `path` as
   * JSON, and return the curated result. The request is made by the browser
   * itself, so the captured ja3/ja4/akamai reflect this browser's handshake.
   */
  async captureTlsFingerprint(
    path: string,
    url: string = TLS_CAPTURE_URL,
  ): Promise<TlsFingerprint> {
    this.logger.debug(
      truncateLog(
        this.activeDebugLogMaxLength,
        `Capturing TLS fingerprint from ${url}`,
      ),
    );
    const page = await this.pageService.navigateTo(url);
    let rawJson: string;
    try {
      rawJson = await page.evaluate(() => document.body.innerText);
    } finally {
      await this.pageService.closePage();
    }

    const data = JSON.parse(rawJson!) as Record<string, unknown>;
    const fingerprint = this.buildTlsFingerprint(data);

    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, JSON.stringify(fingerprint, null, 2), 'utf-8');

    this.logger.log(`Saved TLS fingerprint to ${path}`);
    return fingerprint;
  }

  private buildTlsFingerprint(data: Record<string, unknown>): TlsFingerprint {
    const tls = (data.tls ?? {}) as Record<string, unknown>;
    const http2 = (data.http2 ?? {}) as Record<string, unknown>;

    const extensions = Array.isArray(tls.extensions)
      ? (tls.extensions as Array<Record<string, unknown>>)
      : [];
    const sentFrames = Array.isArray(http2.sent_frames)
      ? (http2.sent_frames as Array<Record<string, unknown>>)
      : [];
    const headersFrame = sentFrames.find(
      (frame) => frame.frame_type === 'HEADERS',
    );

    return {
      capturedAt: new Date().toISOString(),
      ip: (data.ip as string) ?? '',
      httpVersion: (data.http_version as string) ?? '',
      method: (data.method as string) ?? '',
      userAgent: (data.user_agent as string) ?? '',
      ja3: (tls.ja3 as string) ?? '',
      ja3Hash: (tls.ja3_hash as string) ?? '',
      ja4: (tls.ja4 as string) ?? '',
      ja4_r: tls.ja4_r as string | undefined,
      peetprint: (tls.peetprint as string) ?? '',
      peetprintHash: (tls.peetprint_hash as string) ?? '',
      ciphers: Array.isArray(tls.ciphers) ? (tls.ciphers as string[]) : [],
      tlsExtensions: extensions.map((ext) => String(ext.name)),
      akamaiFingerprint: (http2.akamai_fingerprint as string) ?? '',
      akamaiFingerprintHash: (http2.akamai_fingerprint_hash as string) ?? '',
      headers: Array.isArray(headersFrame?.headers)
        ? (headersFrame.headers as string[])
        : [],
      raw: data,
    };
  }

  async scrape<T extends SelectorMap>(
    url: string,
    selectors: T,
    options?: ScraperOptions,
  ): Promise<ScrapeResult> {
    this.logger.debug(
      truncateLog(this.activeDebugLogMaxLength, `Scraping ${url}`),
    );
    const cloak = options?.useRandomUserAgent
      ? { ...options?.cloak, userAgent: getRandomUserAgent() }
      : options?.cloak;

    const page = await this.pageService.navigateTo(
      url,
      this.buildNavOptions(options),
      cloak,
      options?.interceptResource,
    );

    const result: ScrapeResult = {};
    // Bracket access keeps the call off overzealous `eval(` scanners; typed
    // back to the real puppeteer signature so callbacks stay type-checked.
    const evalOne = page['$eval'].bind(page) as Page['$eval'];

    try {
      await Promise.all(
        Object.entries(selectors).map(async ([key, rawSelector]) => {
          const { selector, attribute } = this.parseSelector(rawSelector);
          try {
            const value = attribute
              ? await evalOne(
                  selector,
                  (el, attr) => el.getAttribute(attr),
                  attribute,
                )
              : await evalOne(selector, (el) => el.textContent);

            result[key] = options?.pipes?.[key]
              ? this.pipeEngine.apply(
                  typeof value === 'string' ? value : String(value ?? ''),
                  options.pipes[key],
                  url,
                )
              : value;
          } catch (err) {
            this.logger.warn(
              `Failed to scrape '${key}' (${rawSelector}): ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }),
      );
    } finally {
      await this.pageService.closePage();
    }
    return result;
  }

  /**
   * Split a trailing `@attr` off a selector, e.g.
   * `meta[name="description"]@content` → { selector, attribute: 'content' }.
   */
  private parseSelector(raw: string): { selector: string; attribute?: string } {
    const match = raw.match(/^(.*)@([A-Za-z_][\w-]*)$/);
    if (match && match[1].trim() !== '') {
      return { selector: match[1], attribute: match[2] };
    }
    return { selector: raw };
  }

  private buildNavOptions(
    options?: ScraperOptions,
  ): import('./page.service').NavigateOptions | undefined {
    if (!options?.waitUntil && !options?.timeout) return undefined;
    return {
      waitUntil: options?.waitUntil,
      timeout: options?.timeout,
    };
  }

  async scrapeAll<T extends SelectorMap>(
    url: string,
    selectors: T,
    options?: ScraperOptions,
  ): Promise<ScrapeAllResult> {
    this.logger.debug(
      truncateLog(
        this.activeDebugLogMaxLength,
        `Scraping all elements from ${url}`,
      ),
    );
    const cloak = options?.useRandomUserAgent
      ? { ...options?.cloak, userAgent: getRandomUserAgent() }
      : options?.cloak;

    const page = await this.pageService.navigateTo(
      url,
      this.buildNavOptions(options),
      cloak,
      options?.interceptResource,
    );

    const result: ScrapeAllResult = {};
    const evalAll = page['$$eval'].bind(page) as Page['$$eval'];

    Object.entries(selectors).forEach(([key, selector]) =>
      this.validateSelector(key, selector),
    );

    await Promise.all(
      Object.entries(selectors).map(async ([key, rawSelector]) => {
        const { selector, attribute } = this.parseSelector(rawSelector);
        try {
          const isXPath = isXPathSelector(selector);
          let values: string[];

          if (isXPath && attribute) {
            values = await page.evaluate(
              (xpathSelector, attr) => {
                const results = document.evaluate(
                  xpathSelector,
                  document,
                  null,
                  XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                  null,
                );
                const vals: string[] = [];
                let node: Node | null;
                while ((node = results.iterateNext())) {
                  vals.push(
                    node instanceof Element
                      ? node.getAttribute(attr) || ''
                      : node?.textContent?.trim() || '',
                  );
                }
                return vals;
              },
              selector,
              attribute,
            );
          } else if (isXPath) {
            values = await page.evaluate((xpathSelector) => {
              const results = document.evaluate(
                xpathSelector,
                document,
                null,
                XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                null,
              );
              const vals: string[] = [];
              let node: Node | null;
              while ((node = results.iterateNext())) {
                vals.push(node?.textContent?.trim() || '');
              }
              return vals;
            }, selector);
          } else if (attribute) {
            values = await evalAll(
              selector,
              (elements, attr) =>
                elements.map((el) => el.getAttribute(attr) || ''),
              attribute,
            );
          } else {
            values = await evalAll(selector, (elements) =>
              elements.map((el) => el.textContent?.trim() || ''),
            );
          }

          if (options?.pipes?.[key]) {
            (result as ScrapeResult)[key] = values.map((value) =>
              this.pipeEngine.apply(value, options.pipes![key], url),
            );
          } else {
            (result as ScrapeResult)[key] = values;
          }
        } catch (err) {
          this.logger.warn(
            `Failed to scrape '${key}' (${rawSelector}): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );

    await this.pageService.closePage();
    return result;
  }

  async scrapeContainerFields<T = Record<string, unknown>>(
    url: string,
    descriptor: ContainerDescriptor<T>,
    options?: ScraperOptions,
  ): Promise<ContainerScrapeResult<T>> {
    this.logger.debug(
      truncateLog(
        this.activeDebugLogMaxLength,
        `Scraping container fields from ${url}`,
      ),
    );

    const cloak = options?.useRandomUserAgent
      ? { ...options?.cloak, userAgent: getRandomUserAgent() }
      : options?.cloak;

    let page: Page;
    try {
      page = await this.pageService.navigateTo(
        url,
        this.buildNavOptions(options),
        cloak,
        options?.interceptResource,
      );
    } catch (err) {
      await this.pageService.closePage();
      throw err;
    }

    try {
      const raw = await this.executeContainerExtraction(
        page,
        descriptor as ContainerDescriptor,
        options?.currentPage ?? 1,
      );

      // Apply pipes per field
      const items = raw.items.map((item) => {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(item)) {
          const val = item[key];
          if (options?.pipes?.[key]) {
            const toStr = (v: unknown) =>
              typeof v === 'string' ? v : String(v as string);
            out[key] = Array.isArray(val)
              ? val.map((v) =>
                  v == null
                    ? null
                    : this.pipeEngine.apply(toStr(v), options.pipes![key], url),
                )
              : val == null
                ? null
                : this.pipeEngine.apply(toStr(val), options.pipes[key], url);
          } else {
            out[key] = val;
          }
        }
        return out as T;
      });

      return { items, pagination: raw.pagination };
    } finally {
      await this.pageService.closePage();
    }
  }

  async evaluateWebsite<T = Record<string, unknown>>(
    options: EvaluateOptions,
  ): Promise<EvaluateResult<T>> {
    const { url, patterns, pagination, ...scraperOptions } = options;

    if (!url) {
      throw new Error('evaluateWebsite requires a url');
    }

    const containerPattern = patterns.find((p) => p.meta?.isContainer);

    if (!containerPattern) {
      if (pagination) {
        throw new Error(
          'pagination requires a container pattern (meta.isContainer: true)',
        );
      }
      const selectors = Object.fromEntries(
        patterns.map((p) => [p.key, p.patterns[0]]),
      );
      const pipes: PipeOptions = Object.fromEntries(
        patterns.filter((p) => p.pipes).map((p) => [p.key, p.pipes!]),
      );
      const rawResult = await this.scrape(url, selectors, {
        ...scraperOptions,
        pipes,
      });
      return { results: [rawResult as T] };
    }

    const fieldPatterns = patterns.filter(
      (p) => !p.meta?.isContainer && !p.meta?.isPage,
    );

    const fields = Object.fromEntries(
      fieldPatterns.map((p) => [
        p.key,
        {
          selector: p.patterns[0],
          returnType:
            p.returnType === 'rawHTML'
              ? 'html'
              : p.returnType === 'html'
                ? 'html'
                : 'text',
          multiple: !!p.meta?.multiple,
          fallback: [...p.patterns.slice(1), ...(p.meta?.alterPattern ?? [])],
        } satisfies FieldDescriptor,
      ]),
    );

    const descriptor: ContainerDescriptor<T> = {
      container: containerPattern.patterns[0],
      fields: fields as Record<string & keyof T, FieldDescriptor>,
    };

    const pipeMap: PipeOptions = Object.fromEntries(
      fieldPatterns.filter((p) => p.pipes).map((p) => [p.key, p.pipes!]),
    );

    if (!pagination) {
      const { items } = await this.scrapeContainerFields<T>(url, descriptor, {
        ...scraperOptions,
        pipes: pipeMap,
      });
      return { results: items };
    }

    // --- Paginated path ---
    const scraperOpts = { ...scraperOptions, pipes: pipeMap };

    if (pagination.type === 'url-increment') {
      const template = pagination.urlTemplate ?? url;
      const startPage = pagination.startPage ?? 2;

      const { items: page1Items } = await this.scrapeContainerFields<T>(
        url,
        descriptor,
        scraperOpts,
      );

      const { items: restItems, pages: restPages } =
        await this.paginateUrlIncrement<T>(
          template,
          async (pageUrl) => {
            const { items } = await this.scrapeContainerFields<T>(
              pageUrl,
              descriptor,
              scraperOpts,
            );
            return items;
          },
          pagination,
          startPage,
        );

      return {
        results: [...page1Items, ...restItems],
        totalPages: 1 + restPages,
      };
    }

    // For click-next, load-more, infinite-scroll: open a single page and keep it open
    const cloak = scraperOpts.useRandomUserAgent
      ? { ...scraperOpts.cloak, userAgent: getRandomUserAgent() }
      : scraperOpts.cloak;

    let page: Page;
    try {
      page = await this.pageService.navigateTo(
        url,
        this.buildNavOptions(scraperOpts),
        cloak,
        scraperOpts.interceptResource,
      );
    } catch (err) {
      await this.pageService.closePage();
      throw err;
    }

    try {
      const containerFn = async (p: Page): Promise<T[]> => {
        const raw = await this.executeContainerExtraction(
          p,
          descriptor as ContainerDescriptor,
          1,
        );
        return raw.items.map((item) => {
          const out: Record<string, unknown> = {};
          for (const key of Object.keys(item)) {
            const val = item[key];
            if (pipeMap[key]) {
              const toStr = (v: unknown) =>
                typeof v === 'string' ? v : String(v as string);
              out[key] = Array.isArray(val)
                ? val.map((v) =>
                    v == null
                      ? null
                      : this.pipeEngine.apply(toStr(v), pipeMap[key], url),
                  )
                : val == null
                  ? null
                  : this.pipeEngine.apply(toStr(val), pipeMap[key], url);
            } else {
              out[key] = val;
            }
          }
          return out as T;
        });
      };

      if (pagination.type === 'click-next') {
        const { items, pages } = await this.paginateClickNext<T>(
          page,
          containerFn,
          pagination,
        );
        return { results: items, totalPages: pages };
      } else if (pagination.type === 'load-more') {
        const { items, pages } = await this.paginateLoadMore<T>(
          page,
          containerFn,
          pagination,
        );
        return { results: items, totalPages: pages };
      } else {
        const { items, pages } = await this.paginateInfiniteScroll<T>(
          page,
          containerFn,
          pagination,
        );
        return { results: items, totalPages: pages };
      }
    } finally {
      await this.pageService.closePage();
    }
  }

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

  private async paginateClickNext<T>(
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

  private async paginateLoadMore<T>(
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

  private async paginateInfiniteScroll<T>(
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

  private async paginateUrlIncrement<T>(
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

  private async extractAllData(
    page: Page,
    target: ActionTarget,
    as: ActionOptions['as'] = 'text',
    attribute?: string,
  ): Promise<string[]> {
    if (target.shadowHost && !target.value) {
      const hosts = await page.$$(target.shadowHost);
      const results = await Promise.all(
        hosts.map((host) =>
          host.evaluate(
            (el, extractAs, attr) => {
              const sr = el.shadowRoot;
              if (!sr) return '';
              if (extractAs === 'html' || extractAs === 'outerHtml')
                return sr.innerHTML;
              if (extractAs === 'attribute')
                return el.getAttribute(attr || '') || '';
              return sr.textContent?.trim() || '';
            },
            as,
            attribute,
          ),
        ),
      );
      return results;
    }

    if (target.shadowHost) {
      return await this.extractAllFromShadowRoot(page, target, as, attribute);
    }

    if (target.type === 'css') {
      return await page.$$eval(
        target.value!,
        (elements, extractAs, attr) =>
          elements.map((el) => {
            if (extractAs === 'html') return el.innerHTML;
            if (extractAs === 'outerHtml') return el.outerHTML;
            if (extractAs === 'attribute')
              return el.getAttribute(attr || '') || '';
            return el.textContent?.trim() || '';
          }),
        as,
        attribute,
      );
    }

    return await page.evaluate(
      (selector, extractAs, attr) => {
        const results = document.evaluate(
          selector,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null,
        );
        const values: string[] = [];
        for (let i = 0; i < results.snapshotLength; i++) {
          const node = results.snapshotItem(i);
          if (!(node instanceof Element)) {
            values.push(node?.textContent?.trim() || '');
            continue;
          }
          if (extractAs === 'html') values.push(node.innerHTML);
          else if (extractAs === 'outerHtml') values.push(node.outerHTML);
          else if (extractAs === 'attribute')
            values.push(node.getAttribute(attr || '') || '');
          else values.push(node.textContent?.trim() || '');
        }
        return values;
      },
      target.value!,
      as,
      attribute,
    );
  }

  private async extractAllFromShadowRoot(
    page: Page,
    target: ActionTarget,
    as: ActionOptions['as'] = 'text',
    attribute?: string,
  ): Promise<string[]> {
    const hosts = await page.$$(target.shadowHost!);

    const allResults: string[][] = await Promise.all(
      hosts.map(async (host) => {
        return await host.evaluate(
          (el, selector, targetType, extractAs, attr) => {
            const shadowRoot = el.shadowRoot;
            if (!shadowRoot) return [];

            const getVal = (e: Element): string => {
              if (extractAs === 'html') return e.innerHTML;
              if (extractAs === 'outerHtml') return e.outerHTML;
              if (extractAs === 'attribute')
                return e.getAttribute(attr || '') || '';
              return e.textContent?.trim() || '';
            };

            if (targetType === 'css') {
              const elements = shadowRoot.querySelectorAll(selector);
              return Array.from(elements).map(getVal);
            }

            const results = document.evaluate(
              selector,
              shadowRoot,
              null,
              XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
              null,
            );
            const values: string[] = [];
            let node: Node | null;
            while ((node = results.iterateNext())) {
              values.push(
                node instanceof Element
                  ? getVal(node)
                  : node?.textContent?.trim() || '',
              );
            }
            return values;
          },
          target.value!,
          target.type,
          as,
          attribute,
        );
      }),
    );

    return allResults.flat();
  }

  async waitForSelector(
    url: string,
    selector: string,
    timeout?: number,
    scraperOptions?: ScraperOptions,
  ): Promise<Page> {
    this.logger.debug(
      truncateLog(
        this.activeDebugLogMaxLength,
        `Waiting for ${selector} on ${url}`,
      ),
    );
    const cloak = scraperOptions?.useRandomUserAgent
      ? { ...scraperOptions?.cloak, userAgent: getRandomUserAgent() }
      : scraperOptions?.cloak;
    const page = await this.pageService.navigateTo(
      url,
      this.buildNavOptions(scraperOptions),
      cloak,
      scraperOptions?.interceptResource,
    );
    await page.waitForSelector(selector, { timeout });
    return page;
  }

  async evaluate<T = unknown>(
    url: string,
    script: string | (() => unknown),
    options?: ScraperOptions,
  ): Promise<T> {
    this.logger.debug(
      truncateLog(this.activeDebugLogMaxLength, `Evaluating script on ${url}`),
    );
    const cloak = options?.useRandomUserAgent
      ? { ...options?.cloak, userAgent: getRandomUserAgent() }
      : options?.cloak;
    const page = await this.pageService.navigateTo(
      url,
      this.buildNavOptions(options),
      cloak,
      options?.interceptResource,
    );
    const result =
      typeof script === 'function'
        ? await page.evaluate(script)
        : await page.evaluate(script);
    await this.pageService.closePage();
    return result as T;
  }

  async scrapeWithWorkflow<T = Record<string, unknown>>(
    url: string,
    workflow: WorkflowDefinition,
    variables?: VariableContext,
  ): Promise<WorkflowResultTyped<T>> {
    // Security: validate workflow before execution (fail fast)
    validateWorkflow(workflow);

    this.activeDebugLogMaxLength =
      workflow.debugLogMaxLength ??
      this.moduleOptions?.debugLogMaxLength ??
      DEFAULT_DEBUG_LOG_MAX_LENGTH;
    this.logger.debug(
      truncateLog(
        this.activeDebugLogMaxLength,
        `Starting workflow execution for ${url}`,
      ),
    );
    const page = await this.pageService.navigateTo(
      url,
      undefined,
      workflow.cloak,
      workflow.interceptResource,
    );
    const result: WorkflowResultTyped<T> = {
      success: false,
      data: {} as T,
      errors: [],
      screenshots: [],
    };

    try {
      const context: VariableContext = variables || {};
      const errorConfig = workflow.onError || {};

      for (const action of workflow.actions) {
        try {
          await this.executeAction(page, action, context);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Action failed: ${errorMessage}`);

          if (action.onError === 'continue' || action.onError === 'skip') {
            continue;
          }

          if (errorConfig.screenshot) {
            const screenshotPath = sanitizeScreenshotPath(
              errorConfig.screenshotPath ||
                `${DEFAULT_ERROR_SCREENSHOT_FILENAME}-${Date.now()}.png`,
            );
            await page.screenshot({ path: screenshotPath });
            result.screenshots?.push(screenshotPath);
          }

          if (!errorConfig.continue) {
            result.errors.push(errorMessage);
            await this.pageService.closePage();
            return result;
          }
        }
      }

      result.success = true;
      result.data = context as T;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      this.logger.error(`Workflow execution failed: ${errorMessage}`);
    } finally {
      await this.pageService.closePage();
    }

    return result;
  }

  async scrapeAllWithWorkflow<T = Record<string, unknown>>(
    url: string,
    workflow: WorkflowDefinition,
    variables?: VariableContext,
  ): Promise<WorkflowResultTyped<T>> {
    // Reuse existing scrapeWithWorkflow infrastructure
    // The only difference is the name - it already supports multi-element via options.multiple
    return await this.scrapeWithWorkflow<T>(url, workflow, variables);
  }

  private async executeAction(
    page: Page,
    action: WorkflowAction,
    context: VariableContext,
  ): Promise<void> {
    // Check condition
    if (action.condition) {
      const shouldExecute = await this.evaluateCondition(
        page,
        action.condition,
      );
      if (!shouldExecute) {
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `Skipping action due to condition: ${action.action}`,
          ),
        );
        return;
      }
    }

    const value = this.interpolateValue(String(action.value || ''), context);

    const actionLabel = action.id
      ? `[${action.action}] id="${action.id}"`
      : `[${action.action}]`;
    this.logger.debug(
      truncateLog(
        this.activeDebugLogMaxLength,
        `Executing action: ${actionLabel}`,
      ),
    );

    const maxRetries = Math.min(action.options?.retry ?? 0, 100);
    const retryDelay = Math.min(action.options?.retryDelay ?? 0, 300_000);
    for (let attempt = 0; ; attempt++) {
      try {
        await this.dispatchAction(page, action, value, context);
        return;
      } catch (err) {
        if (attempt >= maxRetries) throw err;
        this.logger.warn(
          truncateLog(
            this.activeDebugLogMaxLength,
            `Action ${actionLabel} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        if (retryDelay > 0) await delay(retryDelay);
      }
    }
  }

  private async dispatchAction(
    page: Page,
    action: WorkflowAction,
    value: string,
    context: VariableContext,
  ): Promise<void> {
    switch (action.action) {
      case 'navigate': {
        const navOptions: {
          waitUntil?: ActionOptions['waitUntil'];
          timeout?: number;
        } = {};
        if (action.options?.waitUntil)
          navOptions.waitUntil = action.options.waitUntil;
        if (action.options?.timeout)
          navOptions.timeout = action.options.timeout;
        if (
          !isURL(value, {
            require_protocol: true,
            protocols: ['http', 'https'],
          })
        ) {
          throw new Error(`Invalid or disallowed URL: ${value}`);
        }
        this.logger.debug(
          truncateLog(this.activeDebugLogMaxLength, `  navigate → ${value}`),
        );
        await page.goto(
          value,
          Object.keys(navOptions).length ? navOptions : undefined,
        );
        break;
      }

      case 'wait':
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  wait ${Number(action.value) || 0}ms`,
          ),
        );
        await delay(Math.min(Number(action.value) || 0, 300_000));
        break;

      case 'waitFor':
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  waitFor target: ${this.describeTarget(action.target!)}`,
          ),
        );
        await this.waitForTarget(page, action.target!, action.options);
        break;

      case 'click':
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  click target: ${this.describeTarget(action.target!)}`,
          ),
        );
        await this.clickElement(page, action.target!, action.options);
        break;

      case 'type':
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  type target: ${this.describeTarget(action.target!)} value: "${value}"`,
          ),
        );
        await this.typeText(page, action.target!, value, action.options);
        break;

      case 'select':
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  select target: ${this.describeTarget(action.target!)} value: "${value}"`,
          ),
        );
        await this.selectOption(page, action.target!, value, action.options);
        break;

      case 'scroll':
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  scroll target: ${this.describeTarget(action.target!)}`,
          ),
        );
        await this.scrollToElement(page, action.target!);
        break;

      case 'extract': {
        const extractOptions = action.options || {};
        const extractAs = extractOptions.as ?? 'text';
        const extractAttr = extractOptions.attribute;

        if (!action.target) {
          this.logger.debug(
            truncateLog(
              this.activeDebugLogMaxLength,
              `  extract full page HTML`,
            ),
          );
          if (action.id) context[action.id] = await page.content();
          break;
        }

        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  extract target: ${this.describeTarget(action.target)} as="${extractAs}"${extractAttr ? ` attr="${extractAttr}"` : ''}${extractOptions.multiple ? ' multiple=true' : ''}`,
          ),
        );

        if (extractOptions.multiple) {
          const allValues = await this.extractAllData(
            page,
            action.target,
            extractAs,
            extractAttr,
          );
          if (action.id) {
            context[action.id] = allValues;
            this.logger.debug(
              truncateLog(
                this.activeDebugLogMaxLength,
                `  extracted ${Array.isArray(allValues) ? allValues.length : 1} item(s) → id="${action.id}"`,
              ),
            );
          }
        } else {
          const extractedValue = await this.extractData(
            page,
            action.target,
            extractAs,
            extractAttr,
          );
          if (action.id) {
            context[action.id] = extractedValue;
            this.logger.debug(
              truncateLog(
                this.activeDebugLogMaxLength,
                `  extracted → id="${action.id}": ${JSON.stringify(extractedValue)}`,
              ),
            );
          }
        }
        break;
      }

      case 'screenshot': {
        const screenshotPath = String(
          action.value || `${DEFAULT_SCREENSHOT_FILENAME}-${Date.now()}.png`,
        );
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  screenshot → ${screenshotPath}`,
          ),
        );
        await page.screenshot({ path: screenshotPath });
        break;
      }

      case 'evaluate': {
        let evalCode: string;
        if (value.includes('=>')) {
          evalCode = `(${value})()`;
        } else {
          evalCode = value;
        }
        if (evalCode.length > 50_000) {
          throw new Error(
            'evaluate script exceeds maximum length of 50000 characters',
          );
        }

        this.logger.debug(
          truncateLog(this.activeDebugLogMaxLength, `Evaluating: ${evalCode}`),
        );
        const evalResult = await page.evaluate(evalCode);
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `Result: ${JSON.stringify(evalResult)}`,
          ),
        );

        if (action.id) {
          context[action.id] = evalResult;
        }
        break;
      }

      case 'cleanse': {
        const pipes = action.options?.pipes;

        if (!pipes) {
          throw new Error('cleanse action requires pipes');
        }

        const valueKey = String(action.value || '');
        const rawValue = this.resolveRawValue(valueKey, context);
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  cleanse raw: ${JSON.stringify(rawValue)}`,
          ),
        );

        const cleanedValue = Array.isArray(rawValue)
          ? rawValue.map((item) => this.pipeEngine.apply(String(item), pipes))
          : this.pipeEngine.apply(String(rawValue), pipes);

        if (action.id) {
          context[action.id] = cleanedValue;
          this.logger.debug(
            truncateLog(
              this.activeDebugLogMaxLength,
              `Cleansed value for '${action.id}': ${JSON.stringify(cleanedValue)}`,
            ),
          );
        }
        break;
      }

      case 'saveCookies': {
        const sessionName = String(value);
        const overwrite = action.options?.overwrite ?? false;
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  saveCookies session="${sessionName}" overwrite=${overwrite}`,
          ),
        );

        // Extract metadata if provided
        const metadata: Record<string, unknown> = {};
        if (action.options?.metadata) {
          Object.assign(metadata, action.options.metadata);
        }

        await this.cookieService.saveCookies(page, sessionName, {
          overwrite,
          metadata,
        });
        break;
      }

      case 'loadCookies': {
        const sessionName = String(value);
        const throwIfNotExists =
          action.onError !== 'skip' && action.onError !== 'continue';
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  loadCookies session="${sessionName}"`,
          ),
        );

        await this.cookieService.loadCookies(page, sessionName, {
          throwIfNotExists,
        });
        break;
      }

      case 'clearCookies': {
        const sessionName = String(value);
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  clearCookies session="${sessionName}"`,
          ),
        );
        await this.cookieService.deleteCookies(sessionName);
        break;
      }

      case 'listCookies': {
        this.logger.debug(
          truncateLog(this.activeDebugLogMaxLength, `  listCookies`),
        );
        const sessions = await this.cookieService.listCookies();

        if (action.id) {
          context[action.id] = sessions;
        }
        break;
      }

      case 'hover':
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  hover target: ${this.describeTarget(action.target!)}`,
          ),
        );
        await this.hoverElement(page, action.target!, action.options);
        break;

      case 'keyPress':
        if (!value) {
          throw new Error('keyPress action requires a key value');
        }
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  keyPress key="${value}"`,
          ),
        );
        await page.keyboard.press(value as KeyInput);
        break;

      case 'clear':
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  clear target: ${this.describeTarget(action.target!)}`,
          ),
        );
        await this.clearElement(page, action.target!);
        break;

      case 'waitForNetwork':
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  waitForNetwork timeout=${action.options?.timeout ?? DEFAULT_ACTION_TIMEOUT}ms`,
          ),
        );
        await page.waitForNetworkIdle({
          timeout: action.options?.timeout ?? DEFAULT_ACTION_TIMEOUT,
        });
        break;

      case 'reload':
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  reload waitUntil="${action.options?.waitUntil ?? 'load'}"`,
          ),
        );
        await page.reload({
          waitUntil: action.options?.waitUntil ?? 'load',
          timeout: action.options?.timeout ?? DEFAULT_NAVIGATION_TIMEOUT,
        });
        break;

      case 'scrapeContainer': {
        const o = action.options;
        if (!o?.container || !o?.fields) {
          throw new Error(
            'scrapeContainer requires options.container and options.fields',
          );
        }
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  scrapeContainer container="${o.container}"`,
          ),
        );
        const containerResult = await this.executeContainerExtraction(
          page,
          {
            container: o.container,
            fields: o.fields,
            pagination: o.pagination,
          },
          o.currentPage ?? 1,
        );
        if (action.id) {
          context[action.id] = containerResult.items;
          if (containerResult.pagination) {
            context[`${action.id}_pagination`] = containerResult.pagination;
          }
          this.logger.debug(
            truncateLog(
              this.activeDebugLogMaxLength,
              `  scrapeContainer → id="${action.id}": ${containerResult.items.length} items`,
            ),
          );
        }
        break;
      }

      case 'extractPagination': {
        const o = action.options;
        if (!o?.container || !o?.linkSelector || !o?.labelSelector) {
          throw new Error(
            'extractPagination requires options.container, linkSelector, and labelSelector',
          );
        }
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  extractPagination container="${o.container}"`,
          ),
        );
        const paginationResult = await this.resolvePagination(
          page,
          {
            container: o.container,
            linkSelector: o.linkSelector,
            labelSelector: o.labelSelector,
          },
          o.currentPage ?? 1,
        );
        if (action.id) {
          context[action.id] = paginationResult;
          this.logger.debug(
            truncateLog(
              this.activeDebugLogMaxLength,
              `  extractPagination → id="${action.id}": nextUrl=${paginationResult.nextUrl}`,
            ),
          );
        }
        break;
      }

      default: {
        const exhaustiveCheck: never = action.action;
        throw new Error(`Unknown action type: ${String(exhaustiveCheck)}`);
      }
    }
  }

  private async evaluateCondition(
    page: Page,
    condition: WorkflowAction['condition'],
  ): Promise<boolean> {
    if (!condition) return true;

    if (condition.ifExists) {
      const element = await this.findElement(page, condition.ifExists);
      return element !== null;
    }

    if (condition.unlessExists) {
      const element = await this.findElement(page, condition.unlessExists);
      return element === null;
    }

    return true;
  }

  private describeTarget(target: ActionTarget): string {
    const base = target.value
      ? `${target.type}="${target.value}"`
      : `(no selector)`;
    return target.shadowHost
      ? `shadowHost="${target.shadowHost}" > ${base}`
      : base;
  }

  private async findElement(
    page: Page,
    target: ActionTarget,
  ): Promise<ElementHandle<Node> | null> {
    this.logger.debug(
      truncateLog(
        this.activeDebugLogMaxLength,
        `  findElement: ${this.describeTarget(target)}`,
      ),
    );

    if (target.shadowHost) {
      const el = await this.findElementInShadowRoot(page, target);
      this.logger.debug(
        truncateLog(
          this.activeDebugLogMaxLength,
          `  findElement result: ${el ? 'found' : 'NOT FOUND'}`,
        ),
      );
      return el;
    }

    if (target.type === 'css') {
      const el = await (page.$(
        target.value!,
      ) as Promise<ElementHandle<Node> | null>);
      this.logger.debug(
        truncateLog(
          this.activeDebugLogMaxLength,
          `  findElement result: ${el ? 'found' : 'NOT FOUND'}`,
        ),
      );
      return el;
    }

    const el = await page
      .evaluateHandle((selector: string) => {
        const result = document.evaluate(
          selector,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        );
        return result.singleNodeValue;
      }, target.value!)
      .then((handle) => handle.asElement());
    this.logger.debug(
      truncateLog(
        this.activeDebugLogMaxLength,
        `  findElement result: ${el ? 'found' : 'NOT FOUND'}`,
      ),
    );
    return el;
  }

  private async findElementInShadowRoot(
    page: Page,
    target: ActionTarget,
  ): Promise<ElementHandle<Node> | null> {
    const host = await page.$(target.shadowHost!);
    if (!host) return null;

    return host
      .evaluateHandle(
        (el: Element, selector: string, targetType: string) => {
          const shadowRoot = el.shadowRoot;
          if (!shadowRoot) return null;

          if (targetType === 'css') {
            return shadowRoot.querySelector(selector);
          }

          const result = document.evaluate(
            selector,
            shadowRoot,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null,
          );
          return result.singleNodeValue;
        },
        target.value,
        target.type,
      )
      .then((handle) => handle.asElement());
  }

  private async waitForTarget(
    page: Page,
    target: ActionTarget,
    options?: WorkflowAction['options'],
  ): Promise<void> {
    const timeout = options?.timeout || DEFAULT_ACTION_TIMEOUT;

    if (target.type === 'css') {
      await page.waitForSelector(target.value!, { timeout });
    } else {
      await page.waitForFunction(
        (selector) => {
          const result = document.evaluate(
            selector,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null,
          );
          return result.singleNodeValue !== null;
        },
        { timeout },
        target.value!,
      );
    }
  }

  private async clickElement(
    page: Page,
    target: ActionTarget,
    options?: WorkflowAction['options'],
  ): Promise<void> {
    const element = await this.findElement(page, target);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }

    await this.maybeScrollToElement(element, options?.scrollTo);

    const elem = element as ElementHandle<Element>;
    await elem.click();

    if (options?.waitForNavigation) {
      await page.waitForNavigation({
        timeout: options.navigationTimeout || DEFAULT_NAVIGATION_TIMEOUT,
      });
    }
  }

  private async typeText(
    page: Page,
    target: ActionTarget,
    value: string,
    options?: WorkflowAction['options'],
  ): Promise<void> {
    const element = await this.findElement(page, target);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }

    await this.maybeScrollToElement(element, options?.scrollTo);

    const elem = element as ElementHandle<Element>;
    await elem.click();
    const delay = options?.delay || 0;
    await elem.type(value, { delay });
    await elem.evaluate((el) => {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    });
  }

  private async selectOption(
    page: Page,
    target: ActionTarget,
    value: string,
    options?: WorkflowAction['options'],
  ): Promise<void> {
    const element = await this.findElement(page, target);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }

    await this.maybeScrollToElement(element, options?.scrollTo);

    const elem = element as ElementHandle<Element>;
    await elem.select(value);
  }

  private async scrollToElement(
    page: Page,
    target: ActionTarget,
  ): Promise<void> {
    const element = await this.findElement(page, target);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }

    await this.scrollElementIntoView(element);
  }

  /**
   * Scroll element into view if requested.
   */
  private async maybeScrollToElement(
    element: ElementHandle<Node>,
    shouldScroll: boolean | undefined,
  ): Promise<void> {
    if (shouldScroll) {
      await this.scrollElementIntoView(element);
    }
  }

  /**
   * Scroll element into view with a small delay.
   */
  private async scrollElementIntoView(
    element: ElementHandle<Node>,
  ): Promise<void> {
    await element.evaluate(
      (el: Element) =>
        el.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      {},
    );
    await delay(DEFAULT_SCROLL_DELAY_MS);
  }

  private async executeContainerExtraction(
    page: Page,
    descriptor: import('../interfaces/types').ContainerDescriptor,
    currentPage = 1,
  ): Promise<import('../interfaces/types').ContainerScrapeResult> {
    const rawItems = await page.evaluate(
      (
        containerSel: string,
        fieldDefs: Record<
          string,
          {
            selector: string;
            attribute?: string;
            returnType?: string;
            multiple?: boolean;
            fallback?: string[];
          }
        >,
      ) => {
        const isXPath = (s: string) =>
          s.trim().startsWith('//') ||
          s.trim().startsWith('(') ||
          s.trim().startsWith('./');
        const getContainerNodes = (sel: string): Element[] => {
          if (isXPath(sel)) {
            const res = document.evaluate(
              sel,
              document,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null,
            );
            const nodes: Element[] = [];
            for (let i = 0; i < res.snapshotLength; i++)
              nodes.push(res.snapshotItem(i) as Element);
            return nodes;
          }
          return Array.from(document.querySelectorAll(sel));
        };
        const extractOne = (
          sel: string,
          root: Element,
          attr?: string,
          returnType?: string,
        ): string => {
          let node: Element | Node | null = null;
          if (isXPath(sel)) {
            const res = document.evaluate(
              sel,
              root,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null,
            );
            node = res.singleNodeValue;
          } else {
            node = root.querySelector(sel);
          }
          if (!node) return '';
          if (attr) return (node as Element).getAttribute?.(attr) ?? '';
          if (returnType === 'html') return (node as Element).innerHTML ?? '';
          return node.textContent?.trim() ?? '';
        };
        const extractMany = (
          sel: string,
          root: Element,
          attr?: string,
          returnType?: string,
        ): string[] => {
          let nodes: (Element | Node)[] = [];
          if (isXPath(sel)) {
            const res = document.evaluate(
              sel,
              root,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null,
            );
            for (let i = 0; i < res.snapshotLength; i++)
              nodes.push(res.snapshotItem(i) as Element);
          } else {
            nodes = Array.from(root.querySelectorAll(sel));
          }
          return nodes.map((n) => {
            if (attr) return (n as Element).getAttribute?.(attr) ?? '';
            if (returnType === 'html') return (n as Element).innerHTML ?? '';
            return n.textContent?.trim() ?? '';
          });
        };
        const extractField = (
          root: Element,
          fd: {
            selector: string;
            attribute?: string;
            returnType?: string;
            multiple?: boolean;
            fallback?: string[];
          },
        ): string | string[] => {
          const selectors = [fd.selector, ...(fd.fallback ?? [])];
          for (const sel of selectors) {
            const val = fd.multiple
              ? extractMany(sel, root, fd.attribute, fd.returnType)
              : extractOne(sel, root, fd.attribute, fd.returnType);
            if (Array.isArray(val) ? val.length > 0 : val !== '') return val;
          }
          return fd.multiple ? [] : '';
        };
        return getContainerNodes(containerSel).map((node) => {
          const item: Record<string, unknown> = {};
          for (const [key, fd] of Object.entries(fieldDefs))
            item[key] = extractField(node, fd);
          return item;
        });
      },
      descriptor.container,
      descriptor.fields as Record<
        string,
        {
          selector: string;
          attribute?: string;
          returnType?: string;
          multiple?: boolean;
          fallback?: string[];
        }
      >,
    );

    const items = rawItems;
    let pagination: import('../interfaces/types').PaginationResult | undefined;
    if (descriptor.pagination) {
      pagination = await this.resolvePagination(
        page,
        descriptor.pagination,
        currentPage,
      );
    }
    return { items, pagination };
  }

  private async resolvePagination(
    page: Page,
    descriptor: PaginationDescriptor,
    currentPage = 1,
  ): Promise<PaginationResult> {
    currentPage = Math.max(1, currentPage);
    const rawPages = await page.evaluate(
      (containerSel: string, linkSel: string, labelSel: string) => {
        const getNode = (sel: string, root: Document | Element) => {
          if (
            sel.trim().startsWith('//') ||
            sel.trim().startsWith('(') ||
            sel.trim().startsWith('./')
          ) {
            const res = document.evaluate(
              sel,
              root,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null,
            );
            return res.singleNodeValue as Element | null;
          }
          return root.querySelector(sel);
        };
        const getNodes = (sel: string, root: Element) => {
          if (
            sel.trim().startsWith('//') ||
            sel.trim().startsWith('(') ||
            sel.trim().startsWith('./')
          ) {
            const res = document.evaluate(
              sel,
              root,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null,
            );
            const nodes: Element[] = [];
            for (let i = 0; i < res.snapshotLength; i++)
              nodes.push(res.snapshotItem(i) as Element);
            return nodes;
          }
          return Array.from(root.querySelectorAll(sel));
        };

        const container = getNode(containerSel, document);
        if (!container) return [];

        return getNodes(linkSel, container).map((el) => {
          // Use labelSel relative to each link element to extract the label text
          const isXPath = (s: string) =>
            s.trim().startsWith('//') ||
            s.trim().startsWith('(') ||
            s.trim().startsWith('./');
          const labelNodes = isXPath(labelSel)
            ? (() => {
                const r = document.evaluate(
                  labelSel,
                  el,
                  null,
                  XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                  null,
                );
                const ns: Element[] = [];
                for (let i = 0; i < r.snapshotLength; i++)
                  ns.push(r.snapshotItem(i) as Element);
                return ns;
              })()
            : Array.from(el.querySelectorAll(labelSel));
          const label =
            labelNodes.length > 0
              ? (labelNodes[0].textContent?.trim() ?? '')
              : (el.textContent?.trim() ?? '');
          return {
            label,
            url: el.getAttribute('href') ?? '',
          };
        });
      },
      descriptor.container,
      descriptor.linkSelector,
      descriptor.labelSelector,
    );

    const pages = (rawPages as Array<{ label: string; url: string }>).filter(
      (p) => p.url,
    );

    const numericNext = pages
      .filter(
        (p) =>
          !Number.isNaN(parseInt(p.label, 10)) &&
          parseInt(p.label, 10) > currentPage,
      )
      .sort((a, b) => parseInt(a.label, 10) - parseInt(b.label, 10))[0];

    const nextUrl =
      numericNext?.url ??
      pages.find((p) => ['next', '>'].includes(p.label.toLowerCase()))?.url ??
      null;

    return { pages, nextUrl };
  }

  private validateSelector(key: string, selector: string): void {
    if (!selector || selector.trim() === '') {
      throw new Error(`Selector for '${key}' cannot be empty`);
    }
  }

  private async extractData(
    page: Page,
    target: ActionTarget,
    as: ActionOptions['as'] = 'text',
    attribute?: string,
  ): Promise<string> {
    if (target.shadowHost && !target.value) {
      const host = await page.$(target.shadowHost);
      if (!host) throw new Error(`Shadow host not found: ${target.shadowHost}`);
      return host.evaluate(
        (el, extractAs, attr) => {
          const sr = el.shadowRoot;
          if (!sr) return '';
          if (extractAs === 'html' || extractAs === 'outerHtml')
            return sr.innerHTML;
          if (extractAs === 'attribute')
            return el.getAttribute(attr || '') || '';
          return sr.textContent?.trim() || '';
        },
        as,
        attribute,
      );
    }

    const element = await this.findElement(page, target);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }

    return element.evaluate(
      (el: Element, extractAs, attr) => {
        if (extractAs === 'html') return el.innerHTML;
        if (extractAs === 'outerHtml') return el.outerHTML;
        if (extractAs === 'attribute') return el.getAttribute(attr || '') || '';
        return el.textContent?.trim() || '';
      },
      as,
      attribute,
    );
  }

  private async hoverElement(
    page: Page,
    target: ActionTarget,
    options?: WorkflowAction['options'],
  ): Promise<void> {
    const element = await this.findElement(page, target);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }
    await this.maybeScrollToElement(element, options?.scrollTo);
    const elem = element as ElementHandle<Element>;
    await elem.hover();
  }

  private async clearElement(page: Page, target: ActionTarget): Promise<void> {
    const element = await this.findElement(page, target);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }
    await (element as ElementHandle<Element>).evaluate((el: Element) => {
      if ('value' in el) {
        (el as HTMLInputElement).value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  private resolveRawValue(value: string, context: VariableContext): unknown {
    if (value.startsWith('${') && value.endsWith('}')) {
      const path = value.slice(2, -1);
      if (!path.includes('${') && !path.includes('.') && !path.includes('[')) {
        return context[path] ?? value;
      }
    }
    return this.resolveValue(value, context);
  }

  private resolveValue(value: string, context: VariableContext): string {
    if (value.startsWith('${') && value.endsWith('}')) {
      const path = value.slice(2, -1);
      // If the path is a simple variable (no ${} in it), look it up directly
      if (!path.includes('${')) {
        const keys: string[] = path.split('.');
        let result: unknown = context;

        for (const key of keys) {
          // Handle array access like packages[0]
          const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
          if (arrayMatch) {
            const [, arrayKey, indexStr] = arrayMatch;
            if (!result || typeof result !== 'object') {
              return value;
            }
            const arrayValue = (result as Record<string, unknown>)[arrayKey];
            const index = parseInt(indexStr, 10);
            result = Array.isArray(arrayValue) ? arrayValue[index] : undefined;
          } else {
            if (!result || typeof result !== 'object') {
              return value;
            }
            result = (result as Record<string, unknown>)[key];
          }

          if (result === undefined) {
            return value;
          }
        }

        if (result === null || typeof result === 'object') {
          return value;
        }

        return result as string;
      }
      // For complex paths with nested ${}, use interpolateValue
      return this.interpolateValue(path, context);
    }
    return value;
  }

  private interpolateValue(value: string, context: VariableContext): string {
    return value.replace(/\$\{([^}]+)\}/g, (_match: string, path: string) => {
      const keys: string[] = path.split('.');
      let result: unknown = context;

      for (const key of keys) {
        // Security: block prototype pollution keys
        if (
          key === '__proto__' ||
          key === 'constructor' ||
          key === 'prototype'
        ) {
          return '';
        }
        // Handle array access like packages[0]
        const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, arrayKey, indexStr] = arrayMatch;
          if (!result || typeof result !== 'object') {
            return '';
          }
          const arrayValue = (result as Record<string, unknown>)[arrayKey];
          const index = parseInt(indexStr, 10);
          result = Array.isArray(arrayValue) ? arrayValue[index] : undefined;
        } else {
          if (!result || typeof result !== 'object') {
            return '';
          }
          result = (result as Record<string, unknown>)[key];
        }

        if (result === undefined) {
          return '';
        }
      }

      if (result === null || typeof result === 'object') {
        return '';
      }

      // Safe conversion - we've checked it's not an object or null above
      return result as string;
    });
  }
}
