import { Injectable, Optional, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { sanitizeScreenshotPath } from '../utils/path.util';
import { convertPatternsToDescriptor } from '../utils/pattern-converter.util';
import { validateWorkflow } from '../validators/workflow.validator';

import type { Page, ScreenshotOptions, PDFOptions } from 'puppeteer-core';
import { PageService } from './page.service';
import { CookieService } from './cookie.service';
import { CleansingService } from './cleansing.service';
import { PipeEngine } from '../pipes/pipe-engine';
import {
  ExtractionOperator,
  CaptureOperator,
  ContainerOperator,
  WorkflowOperator,
  PaginationOperator,
} from '../operators';
import type {
  WorkflowDefinition,
  WorkflowAction,
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
  EvaluateOptions,
  EvaluateResult,
} from '../interfaces/types';
import { getRandomUserAgent } from '../utils/user-agent.util';
import type { TlsFingerprint } from '../interfaces/tls-fingerprint';
import type { BrowserActionOptions } from '../interfaces/browser-action-options';
import { LoggerWithLevel } from '../utils/logger.util';
import { isXPathSelector } from '../utils/dom.util';
import { truncateLog } from '../utils/truncate-log.util';
import {
  BROWSER_ACTION_OPTIONS,
  DEFAULT_DEBUG_LOG_MAX_LENGTH,
  DEFAULT_ERROR_SCREENSHOT_FILENAME,
  TLS_CAPTURE_URL,
} from '../constants/browser-action.constants';

// Singleton-safe: BrowserActionService holds no per-request page state — each
// public method resolves its own transient PageService via newPage(). This lets
// implementers inject it into their own singletons without concurrent requests
// sharing (and tearing down) one page. See newPage() below.
@Injectable()
export class BrowserActionService {
  private readonly logger: LoggerWithLevel;
  private readonly pipeEngine = new PipeEngine();
  private activeDebugLogMaxLength: number;
  private readonly extraction: ExtractionOperator;
  private readonly capture: CaptureOperator;
  private readonly container: ContainerOperator;
  private readonly workflow: WorkflowOperator;
  private readonly pagination: PaginationOperator;

  constructor(
    private readonly pageService: PageService,
    private readonly cookieService: CookieService,
    private readonly cleansingService: CleansingService,
    private readonly moduleRef: ModuleRef,
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
    this.extraction = new ExtractionOperator(this.pipeEngine, this.logger);
    this.capture = new CaptureOperator(this.logger);
    this.container = new ContainerOperator(
      this.extraction,
      this.pipeEngine,
      this.logger,
    );
    this.pagination = new PaginationOperator(this.logger);
    this.workflow = new WorkflowOperator(
      this.extraction,
      this.container,
      this.pipeEngine,
      this.cleansingService,
      this.logger,
      // Accessor, not the instance: some specs stub `service.cookieService`
      // after construction (see browser-action.service.spec.ts), and this
      // keeps that live rather than frozen at construction time.
      () => this.cookieService,
      this.pagination,
    );
  }

  /**
   * Resolve a fresh, isolated PageService for a single public call.
   *
   * PageService is transient and holds mutable currentPage/currentBrowser
   * state. If every call shared one instance (as constructor injection into a
   * singleton would force), concurrent scrapes would stomp each other's page
   * and one would be torn down mid-flight. Resolving per call gives each its
   * own page slot while all still share the one BrowserPoolService singleton.
   *
   * The constructor-injected `this.pageService` is used only for getLogLevel().
   */
  private async newPage(): Promise<PageService> {
    return this.moduleRef.resolve(PageService, undefined, { strict: false });
  }

  /**
   * Register a named browser with `BrowserActionModule.forRoot({ name: 'main', ... })`,
   * declare pages with `BrowserActionModule.forFeature(['myPage'], 'main')`, and use
   * `@InjectPageController('myPage', 'main')` instead.
   */
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
    const pageService = await this.newPage();
    const page = await pageService.navigateTo(
      url,
      this.buildNavOptions(scraperOptions),
      cloak,
      scraperOptions?.interceptResource,
    );
    try {
      return await this.capture.screenshot(page, path, options);
    } finally {
      await pageService.closePage();
    }
  }

  /**
   * Register a named browser with `BrowserActionModule.forRoot({ name: 'main', ... })`,
   * declare pages with `BrowserActionModule.forFeature(['myPage'], 'main')`, and use
   * `@InjectPageController('myPage', 'main')` instead.
   */
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
    const pageService = await this.newPage();
    const page = await pageService.navigateTo(
      url,
      this.buildNavOptions(scraperOptions),
      cloak,
      scraperOptions?.interceptResource,
    );
    try {
      return await this.capture.pdf(page, path, options);
    } finally {
      await pageService.closePage();
    }
  }

  /**
   * Navigate to a TLS-inspection endpoint (default {@link TLS_CAPTURE_URL}),
   * parse the browser's own TLS/HTTP fingerprint, persist it to `path` as
   * JSON, and return the curated result. The request is made by the browser
   * itself, so the captured ja3/ja4/akamai reflect this browser's handshake.
   *
   * Register a named browser with `BrowserActionModule.forRoot({ name: 'main', ... })`,
   * declare pages with `BrowserActionModule.forFeature(['myPage'], 'main')`, and use
   * `@InjectPageController('myPage', 'main')` instead.
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
    const pageService = await this.newPage();
    const page = await pageService.navigateTo(url);
    try {
      return await this.capture.tlsFingerprint(page, path);
    } finally {
      await pageService.closePage();
    }
  }

  /**
   * Register a named browser with `BrowserActionModule.forRoot({ name: 'main', ... })`,
   * declare pages with `BrowserActionModule.forFeature(['myPage'], 'main')`, and use
   * `@InjectPageController('myPage', 'main')` instead.
   */
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

    const pageService = await this.newPage();
    const page = await pageService.navigateTo(
      url,
      this.buildNavOptions(options),
      cloak,
      options?.interceptResource,
    );

    try {
      return await this.extraction.extractSingle(
        page,
        url,
        selectors,
        options?.pipes,
      );
    } finally {
      await pageService.closePage();
    }
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

  /**
   * Register a named browser with `BrowserActionModule.forRoot({ name: 'main', ... })`,
   * declare pages with `BrowserActionModule.forFeature(['myPage'], 'main')`, and use
   * `@InjectPageController('myPage', 'main')` instead.
   */
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

    const pageService = await this.newPage();
    const page = await pageService.navigateTo(
      url,
      this.buildNavOptions(options),
      cloak,
      options?.interceptResource,
    );

    const result: ScrapeAllResult = {};
    const evalAll = page['$$eval'].bind(page) as Page['$$eval'];

    Object.entries(selectors).forEach(([key, selector]) =>
      this.extraction.validateSelector(key, selector),
    );

    await Promise.all(
      Object.entries(selectors).map(async ([key, rawSelector]) => {
        const { selector, attribute } =
          this.extraction.parseSelector(rawSelector);
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

    await pageService.closePage();
    return result;
  }

  /**
   * Register a named browser with `BrowserActionModule.forRoot({ name: 'main', ... })`,
   * declare pages with `BrowserActionModule.forFeature(['myPage'], 'main')`, and use
   * `@InjectPageController('myPage', 'main')` instead.
   */
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

    const pageService = await this.newPage();
    let page: Page;
    try {
      page = await pageService.navigateTo(
        url,
        this.buildNavOptions(options),
        cloak,
        options?.interceptResource,
      );
    } catch (err) {
      await pageService.closePage();
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
      await pageService.closePage();
    }
  }

  /**
   * Register a named browser with `BrowserActionModule.forRoot({ name: 'main', ... })`,
   * declare pages with `BrowserActionModule.forFeature(['myPage'], 'main')`, and use
   * `@InjectPageController('myPage', 'main')` instead.
   */
  async evaluateWebsite<T = Record<string, unknown>>(
    options: EvaluateOptions,
  ): Promise<EvaluateResult<T>> {
    const { url, patterns, pagination, ...scraperOptions } = options;

    if (!url) {
      throw new Error('evaluateWebsite requires a url');
    }

    const converted = convertPatternsToDescriptor<T>(patterns);

    if (converted.kind === 'flat') {
      if (pagination) {
        throw new Error(
          'pagination requires a container pattern (meta.isContainer: true)',
        );
      }
      const rawResult = await this.scrape(url, converted.selectors, {
        ...scraperOptions,
        pipes: converted.pipes,
      });
      return { results: [rawResult as T] };
    }

    const descriptor = converted.descriptor;
    const pipeMap = converted.pipes;

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
        await this.pagination.paginateUrlIncrement<T>(
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

    const pageService = await this.newPage();
    let page: Page;
    try {
      page = await pageService.navigateTo(
        url,
        this.buildNavOptions(scraperOpts),
        cloak,
        scraperOpts.interceptResource,
      );
    } catch (err) {
      await pageService.closePage();
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
        const { items, pages } = await this.pagination.paginateClickNext<T>(
          page,
          containerFn,
          pagination,
        );
        return { results: items, totalPages: pages };
      } else if (pagination.type === 'load-more') {
        const { items, pages } = await this.pagination.paginateLoadMore<T>(
          page,
          containerFn,
          pagination,
        );
        return { results: items, totalPages: pages };
      } else {
        const { items, pages } =
          await this.pagination.paginateInfiniteScroll<T>(
            page,
            containerFn,
            pagination,
          );
        return { results: items, totalPages: pages };
      }
    } finally {
      await pageService.closePage();
    }
  }

  /**
   * Register a named browser with `BrowserActionModule.forRoot({ name: 'main', ... })`,
   * declare pages with `BrowserActionModule.forFeature(['myPage'], 'main')`, and use
   * `@InjectPageController('myPage', 'main')` instead.
   */
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
    // Returns the open page for the caller to drive; caller owns closing it.
    const pageService = await this.newPage();
    const page = await pageService.navigateTo(
      url,
      this.buildNavOptions(scraperOptions),
      cloak,
      scraperOptions?.interceptResource,
    );
    await page.waitForSelector(selector, { timeout });
    return page;
  }

  /**
   * Register a named browser with `BrowserActionModule.forRoot({ name: 'main', ... })`,
   * declare pages with `BrowserActionModule.forFeature(['myPage'], 'main')`, and use
   * `@InjectPageController('myPage', 'main')` instead.
   */
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
    const pageService = await this.newPage();
    const page = await pageService.navigateTo(
      url,
      this.buildNavOptions(options),
      cloak,
      options?.interceptResource,
    );
    const result =
      typeof script === 'function'
        ? await page.evaluate(script)
        : await page.evaluate(script);
    await pageService.closePage();
    return result as T;
  }

  /**
   * Register a named browser with `BrowserActionModule.forRoot({ name: 'main', ... })`,
   * declare pages with `BrowserActionModule.forFeature(['myPage'], 'main')`, and use
   * `@InjectPageController('myPage', 'main')` instead.
   */
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
    const pageService = await this.newPage();
    const page = await pageService.navigateTo(
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
          await this.workflow.executeAction(
            page,
            action,
            context,
            this.activeDebugLogMaxLength,
          );
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
            await pageService.closePage();
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
      await pageService.closePage();
    }

    return result;
  }

  /**
   * Register a named browser with `BrowserActionModule.forRoot({ name: 'main', ... })`,
   * declare pages with `BrowserActionModule.forFeature(['myPage'], 'main')`, and use
   * `@InjectPageController('myPage', 'main')` instead.
   */
  async scrapeAllWithWorkflow<T = Record<string, unknown>>(
    url: string,
    workflow: WorkflowDefinition,
    variables?: VariableContext,
  ): Promise<WorkflowResultTyped<T>> {
    // Reuse existing scrapeWithWorkflow infrastructure
    // The only difference is the name - it already supports multi-element via options.multiple
    return await this.scrapeWithWorkflow<T>(url, workflow, variables);
  }

  /**
   * Thin delegate kept on the service so existing specs that spy on
   * `service['executeContainerExtraction']` keep working; real logic lives
   * in ContainerOperator.
   */
  private async executeContainerExtraction(
    page: Page,
    descriptor: import('../interfaces/types').ContainerDescriptor,
    currentPage = 1,
  ): Promise<import('../interfaces/types').ContainerScrapeResult> {
    return this.container.executeContainerExtraction(
      page,
      descriptor,
      currentPage,
    );
  }

  /**
   * Thin delegate kept on the service so existing specs that call/stub
   * `service['executeAction']` and `service['evaluateCondition']` directly
   * keep working; real dispatch logic lives in WorkflowOperator. The
   * condition check is re-run here (rather than purely inside
   * WorkflowOperator) so stubbing `service['evaluateCondition']` still
   * short-circuits execution as it did before the extraction.
   */
  private async executeAction(
    page: Page,
    action: WorkflowAction,
    context: VariableContext,
  ): Promise<void> {
    if (action.condition) {
      const shouldExecute = await this.evaluateCondition(
        page,
        action.condition,
      );
      if (!shouldExecute) return;
    }
    await this.workflow.executeAction(
      page,
      { ...action, condition: undefined },
      context,
      this.activeDebugLogMaxLength,
    );
  }

  /**
   * Thin delegate kept on the service so existing specs that stub
   * `service['evaluateCondition']` keep working; real logic lives in
   * WorkflowOperator.
   */
  private async evaluateCondition(
    page: Page,
    condition: WorkflowAction['condition'],
  ): Promise<boolean> {
    return this.workflow.evaluateCondition(
      page,
      condition,
      this.activeDebugLogMaxLength,
    );
  }
}
