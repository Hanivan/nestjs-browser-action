import type {
  Browser,
  Page,
  ScreenshotOptions,
  PDFOptions,
} from 'puppeteer-core';
import { PageSession } from './page-session';
import type { NavigateOptions } from './page.service';
import { validateWorkflow } from '../validators/workflow.validator';
import {
  ExtractionOperator,
  CaptureOperator,
  ContainerOperator,
  WorkflowOperator,
  PaginationOperator,
} from '../operators';
import type {
  SelectorMap,
  ScraperOptions,
  ScrapeResult,
  ScrapeAllResult,
  WorkflowResultTyped,
  ContainerDescriptor,
  ContainerScrapeResult,
  EvaluateOptions,
  EvaluateResult,
  PipeOptions,
  FieldDescriptor,
} from '../interfaces/types';
import type {
  WorkflowDefinition,
  VariableContext,
} from '../interfaces/workflow-options';
import type { TlsFingerprint } from '../interfaces/tls-fingerprint';
import { LoggerWithLevel } from '../utils/logger.util';
import { isXPathSelector } from '../utils/dom.util';
import { truncateLog } from '../utils/truncate-log.util';
import { PipeEngine } from '../pipes/pipe-engine';
import {
  DEFAULT_DEBUG_LOG_MAX_LENGTH,
  DEFAULT_ERROR_SCREENSHOT_FILENAME,
  TLS_CAPTURE_URL,
} from '../constants/browser-action.constants';
import { sanitizeScreenshotPath } from '../utils/path.util';

/**
 * `ScraperOptions` without `cloak`/`useRandomUserAgent` — a persistent page is
 * bound to a single browser/fingerprint for its whole lifetime, so per-call
 * cloak overrides don't apply here.
 */
export type ControllerScraperOptions = Omit<
  ScraperOptions,
  'cloak' | 'useRandomUserAgent'
>;

/**
 * Thin, full-parity control handle for a single persistent named page.
 *
 * Mirrors BrowserActionService's public surface, minus per-call cloak
 * overrides (the page is fingerprint-bound to its browser) and minus the
 * open/close-per-call lifecycle: every method resolves the live page via
 * `PageSession.ensureAlive()`/`goto()` and never closes it. Delegates the
 * actual scraping/workflow/pagination/capture logic to the shared operators.
 */
export class PageController {
  private readonly pipeEngine = new PipeEngine();

  constructor(
    private readonly session: PageSession,
    private readonly extraction: ExtractionOperator,
    private readonly container: ContainerOperator,
    private readonly workflow: WorkflowOperator,
    private readonly pagination: PaginationOperator,
    private readonly capture: CaptureOperator,
    private readonly logger: LoggerWithLevel,
    private readonly debugLogMaxLength: number = DEFAULT_DEBUG_LOG_MAX_LENGTH,
  ) {}

  get page(): Page {
    return this.session.page;
  }

  get browser(): Browser {
    return this.session.browser;
  }

  private navOptions(
    options?: ControllerScraperOptions,
  ): NavigateOptions | undefined {
    if (!options?.waitUntil && !options?.timeout) return undefined;
    return { waitUntil: options?.waitUntil, timeout: options?.timeout };
  }

  private async prepare(
    url: string,
    options?: ControllerScraperOptions,
  ): Promise<Page> {
    await this.session.ensureAlive();
    if (options?.interceptResource !== undefined) {
      await this.session.setInterception(!!options.interceptResource);
    }
    return this.session.goto(url, this.navOptions(options));
  }

  async scrape<T extends SelectorMap>(
    url: string,
    selectors: T,
    options?: ControllerScraperOptions,
  ): Promise<ScrapeResult> {
    this.logger.debug(truncateLog(this.debugLogMaxLength, `Scraping ${url}`));
    const page = await this.prepare(url, options);
    return this.extraction.extractSingle(page, url, selectors, options?.pipes);
  }

  async extract<T extends SelectorMap>(
    selectors: T,
    options?: ControllerScraperOptions,
  ): Promise<ScrapeResult> {
    const page = await this.session.ensureAlive();
    if (options?.interceptResource !== undefined) {
      await this.session.setInterception(!!options.interceptResource);
    }
    return this.extraction.extractSingle(
      page,
      page.url(),
      selectors,
      options?.pipes,
    );
  }

  async scrapeAll<T extends SelectorMap>(
    url: string,
    selectors: T,
    options?: ControllerScraperOptions,
  ): Promise<ScrapeAllResult> {
    this.logger.debug(
      truncateLog(this.debugLogMaxLength, `Scraping all elements from ${url}`),
    );
    const page = await this.prepare(url, options);

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

    return result;
  }

  async scrapeContainerFields<T = Record<string, unknown>>(
    url: string,
    descriptor: ContainerDescriptor<T>,
    options?: ControllerScraperOptions,
  ): Promise<ContainerScrapeResult<T>> {
    this.logger.debug(
      truncateLog(
        this.debugLogMaxLength,
        `Scraping container fields from ${url}`,
      ),
    );
    const page = await this.prepare(url, options);

    const raw = await this.container.executeContainerExtraction(
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
  }

  async evaluateWebsite<T = Record<string, unknown>>(
    options: Omit<EvaluateOptions, 'cloak' | 'useRandomUserAgent'>,
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

    // For click-next, load-more, infinite-scroll: reuse this session's page
    const page = await this.prepare(url, scraperOpts);

    const containerFn = async (p: Page): Promise<T[]> => {
      const raw = await this.container.executeContainerExtraction(
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
      const { items, pages } = await this.pagination.paginateInfiniteScroll<T>(
        page,
        containerFn,
        pagination,
      );
      return { results: items, totalPages: pages };
    }
  }

  async takeScreenshot(
    url: string,
    path: string,
    options?: ScreenshotOptions,
    scraperOptions?: ControllerScraperOptions,
  ): Promise<Buffer> {
    this.logger.debug(
      truncateLog(this.debugLogMaxLength, `Taking screenshot of ${url}`),
    );
    const page = await this.prepare(url, scraperOptions);
    return this.capture.screenshot(page, path, options);
  }

  async generatePDF(
    url: string,
    path: string,
    options?: PDFOptions,
    scraperOptions?: ControllerScraperOptions,
  ): Promise<Buffer> {
    this.logger.debug(
      truncateLog(this.debugLogMaxLength, `Generating PDF for ${url}`),
    );
    const page = await this.prepare(url, scraperOptions);
    return this.capture.pdf(page, path, options);
  }

  async captureTlsFingerprint(
    path: string,
    url: string = TLS_CAPTURE_URL,
  ): Promise<TlsFingerprint> {
    this.logger.debug(
      truncateLog(
        this.debugLogMaxLength,
        `Capturing TLS fingerprint from ${url}`,
      ),
    );
    const page = await this.session.goto(url);
    return this.capture.tlsFingerprint(page, path);
  }

  async waitForSelector(
    url: string,
    selector: string,
    timeout?: number,
    scraperOptions?: ControllerScraperOptions,
  ): Promise<Page> {
    this.logger.debug(
      truncateLog(this.debugLogMaxLength, `Waiting for ${selector} on ${url}`),
    );
    const page = await this.prepare(url, scraperOptions);
    await page.waitForSelector(selector, { timeout });
    return page;
  }

  async evaluate<T = unknown>(
    url: string,
    script: string | (() => unknown),
    options?: ControllerScraperOptions,
  ): Promise<T> {
    this.logger.debug(
      truncateLog(this.debugLogMaxLength, `Evaluating script on ${url}`),
    );
    const page = await this.prepare(url, options);
    const result =
      typeof script === 'function'
        ? await page.evaluate(script)
        : await page.evaluate(script);
    return result as T;
  }

  async scrapeWithWorkflow<T = Record<string, unknown>>(
    url: string,
    workflow: Omit<WorkflowDefinition, 'cloak'>,
    variables?: VariableContext,
  ): Promise<WorkflowResultTyped<T>> {
    // Security: validate workflow before execution (fail fast)
    validateWorkflow(workflow);

    const debugLogMaxLength =
      workflow.debugLogMaxLength ?? this.debugLogMaxLength;
    this.logger.debug(
      truncateLog(debugLogMaxLength, `Starting workflow execution for ${url}`),
    );

    await this.session.ensureAlive();
    if (workflow.interceptResource !== undefined) {
      await this.session.setInterception(!!workflow.interceptResource);
    }
    const page = await this.session.goto(url);

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
            debugLogMaxLength,
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
    }

    return result;
  }

  async scrapeAllWithWorkflow<T = Record<string, unknown>>(
    url: string,
    workflow: Omit<WorkflowDefinition, 'cloak'>,
    variables?: VariableContext,
  ): Promise<WorkflowResultTyped<T>> {
    return this.scrapeWithWorkflow<T>(url, workflow, variables);
  }

  async goto(url: string, options?: NavigateOptions): Promise<void> {
    await this.session.goto(url, options);
  }

  async close(): Promise<void> {
    await this.session.close();
  }
}
