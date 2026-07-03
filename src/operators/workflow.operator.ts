import { isURL } from 'class-validator';
import type { Page, ElementHandle, KeyInput } from 'puppeteer-core';
import { PipeEngine } from '../pipes/pipe-engine';
import { CleansingService } from '../services/cleansing.service';
import { CookieService } from '../services/cookie.service';
import { LoggerWithLevel } from '../utils/logger.util';
import { delay } from '../utils/delay.util';
import { truncateLog } from '../utils/truncate-log.util';
import { ExtractionOperator } from './extraction.operator';
import { ContainerOperator } from './container.operator';
import { PaginationOperator } from './pagination.operator';
import { convertPatternsToDescriptor } from '../utils/pattern-converter.util';
import type {
  WorkflowAction,
  ActionTarget,
  ActionOptions,
  VariableContext,
} from '../interfaces/workflow-options';
import type {
  ContainerDescriptor,
  PaginationOptions,
} from '../interfaces/types';
import {
  DEFAULT_ACTION_TIMEOUT,
  DEFAULT_NAVIGATION_TIMEOUT,
  DEFAULT_SCROLL_DELAY_MS,
  DEFAULT_SCREENSHOT_FILENAME,
} from '../constants/browser-action.constants';

/**
 * Stateless workflow per-action execution logic shared by BrowserActionService
 * and (later) PageController. Constructed per-caller with the deps it needs;
 * holds no per-request page state.
 */
export class WorkflowOperator {
  constructor(
    private readonly extraction: ExtractionOperator,
    private readonly container: ContainerOperator,
    private readonly pipeEngine: PipeEngine,
    private readonly cleansingService: CleansingService,
    private readonly logger: LoggerWithLevel,
    // Accessor rather than a captured instance: BrowserActionService allows
    // its cookieService field to be swapped after construction (see specs
    // that stub it post-construction), so we must resolve it fresh per call.
    private readonly getCookieService: () => CookieService,
    private readonly pagination: PaginationOperator,
  ) {}

  async executeAction(
    page: Page,
    action: WorkflowAction,
    context: VariableContext,
    debugLogMaxLength = 0,
  ): Promise<void> {
    // Check condition
    if (action.condition) {
      const shouldExecute = await this.evaluateCondition(
        page,
        action.condition,
        debugLogMaxLength,
      );
      if (!shouldExecute) {
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
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
      truncateLog(debugLogMaxLength, `Executing action: ${actionLabel}`),
    );

    const maxRetries = Math.min(action.options?.retry ?? 0, 100);
    const retryDelay = Math.min(action.options?.retryDelay ?? 0, 300_000);
    for (let attempt = 0; ; attempt++) {
      try {
        await this.dispatchAction(
          page,
          action,
          value,
          context,
          debugLogMaxLength,
        );
        return;
      } catch (err) {
        if (attempt >= maxRetries) throw err;
        this.logger.warn(
          truncateLog(
            debugLogMaxLength,
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
    debugLogMaxLength: number,
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
          truncateLog(debugLogMaxLength, `  navigate → ${value}`),
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
            debugLogMaxLength,
            `  wait ${Number(action.value) || 0}ms`,
          ),
        );
        await delay(Math.min(Number(action.value) || 0, 300_000));
        break;

      case 'waitFor':
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
            `  waitFor target: ${this.describeTarget(action.target!)}`,
          ),
        );
        await this.waitForTarget(page, action.target!, action.options);
        break;

      case 'click':
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
            `  click target: ${this.describeTarget(action.target!)}`,
          ),
        );
        await this.clickElement(
          page,
          action.target!,
          action.options,
          debugLogMaxLength,
        );
        break;

      case 'type':
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
            `  type target: ${this.describeTarget(action.target!)} value: "${value}"`,
          ),
        );
        await this.typeText(
          page,
          action.target!,
          value,
          action.options,
          debugLogMaxLength,
        );
        break;

      case 'select':
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
            `  select target: ${this.describeTarget(action.target!)} value: "${value}"`,
          ),
        );
        await this.selectOption(
          page,
          action.target!,
          value,
          action.options,
          debugLogMaxLength,
        );
        break;

      case 'scroll':
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
            `  scroll target: ${this.describeTarget(action.target!)}`,
          ),
        );
        await this.scrollToElement(page, action.target!, debugLogMaxLength);
        break;

      case 'extract': {
        const extractOptions = action.options || {};
        const extractAs = extractOptions.as ?? 'text';
        const extractAttr = extractOptions.attribute;

        if (!action.target) {
          this.logger.debug(
            truncateLog(debugLogMaxLength, `  extract full page HTML`),
          );
          if (action.id) context[action.id] = await page.content();
          break;
        }

        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
            `  extract target: ${this.describeTarget(action.target)} as="${extractAs}"${extractAttr ? ` attr="${extractAttr}"` : ''}${extractOptions.multiple ? ' multiple=true' : ''}`,
          ),
        );

        if (extractOptions.multiple) {
          const allValues = await this.extraction.extractAllData(
            page,
            action.target,
            extractAs,
            extractAttr,
          );
          if (action.id) {
            context[action.id] = allValues;
            this.logger.debug(
              truncateLog(
                debugLogMaxLength,
                `  extracted ${Array.isArray(allValues) ? allValues.length : 1} item(s) → id="${action.id}"`,
              ),
            );
          }
        } else {
          const extractedValue = await this.extraction.extractData(
            page,
            action.target,
            extractAs,
            extractAttr,
            debugLogMaxLength,
          );
          if (action.id) {
            context[action.id] = extractedValue;
            this.logger.debug(
              truncateLog(
                debugLogMaxLength,
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
          truncateLog(debugLogMaxLength, `  screenshot → ${screenshotPath}`),
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
          truncateLog(debugLogMaxLength, `Evaluating: ${evalCode}`),
        );
        const evalResult = await page.evaluate(evalCode);
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
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
            debugLogMaxLength,
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
              debugLogMaxLength,
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
            debugLogMaxLength,
            `  saveCookies session="${sessionName}" overwrite=${overwrite}`,
          ),
        );

        // Extract metadata if provided
        const metadata: Record<string, unknown> = {};
        if (action.options?.metadata) {
          Object.assign(metadata, action.options.metadata);
        }

        await this.getCookieService().saveCookies(page, sessionName, {
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
            debugLogMaxLength,
            `  loadCookies session="${sessionName}"`,
          ),
        );

        await this.getCookieService().loadCookies(page, sessionName, {
          throwIfNotExists,
        });
        break;
      }

      case 'clearCookies': {
        const sessionName = String(value);
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
            `  clearCookies session="${sessionName}"`,
          ),
        );
        await this.getCookieService().deleteCookies(sessionName);
        break;
      }

      case 'listCookies': {
        this.logger.debug(truncateLog(debugLogMaxLength, `  listCookies`));
        const sessions = await this.getCookieService().listCookies();

        if (action.id) {
          context[action.id] = sessions;
        }
        break;
      }

      case 'hover':
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
            `  hover target: ${this.describeTarget(action.target!)}`,
          ),
        );
        await this.hoverElement(
          page,
          action.target!,
          action.options,
          debugLogMaxLength,
        );
        break;

      case 'keyPress':
        if (!value) {
          throw new Error('keyPress action requires a key value');
        }
        this.logger.debug(
          truncateLog(debugLogMaxLength, `  keyPress key="${value}"`),
        );
        await page.keyboard.press(value as KeyInput);
        break;

      case 'clear':
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
            `  clear target: ${this.describeTarget(action.target!)}`,
          ),
        );
        await this.clearElement(page, action.target!, debugLogMaxLength);
        break;

      case 'waitForNetwork':
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
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
            debugLogMaxLength,
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
            debugLogMaxLength,
            `  scrapeContainer container="${o.container}"`,
          ),
        );
        const containerResult = await this.container.executeContainerExtraction(
          page,
          {
            container: o.container,
            fields: o.fields,
            pagination: o.pagination,
          } as ContainerDescriptor,
          o.currentPage ?? 1,
        );
        if (action.id) {
          context[action.id] = containerResult.items;
          if (containerResult.pagination) {
            context[`${action.id}_pagination`] = containerResult.pagination;
          }
          this.logger.debug(
            truncateLog(
              debugLogMaxLength,
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
            debugLogMaxLength,
            `  extractPagination container="${o.container}"`,
          ),
        );
        const paginationResult = await this.container.resolvePagination(
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
              debugLogMaxLength,
              `  extractPagination → id="${action.id}": nextUrl=${paginationResult.nextUrl}`,
            ),
          );
        }
        break;
      }

      case 'extractPatterns': {
        const o = action.options;
        if (!o?.patterns || o.patterns.length === 0) {
          throw new Error('extractPatterns requires options.patterns');
        }
        this.logger.debug(
          truncateLog(
            debugLogMaxLength,
            `  extractPatterns ${o.patterns.length} pattern(s)`,
          ),
        );

        const converted = convertPatternsToDescriptor(o.patterns);

        if (o.patternPagination && converted.kind === 'flat') {
          throw new Error(
            'pagination requires a container pattern (meta.isContainer: true)',
          );
        }

        if (converted.kind === 'flat') {
          const result = await this.extraction.extractSingle(
            page,
            page.url(),
            converted.selectors,
            converted.pipes,
          );
          if (action.id) {
            context[action.id] = result;
            this.logger.debug(
              truncateLog(
                debugLogMaxLength,
                `  extractPatterns → id="${action.id}": flat result`,
              ),
            );
          }
          break;
        }

        const descriptor = converted.descriptor;
        const applyPipes = (
          items: Record<string, unknown>[],
        ): Record<string, unknown>[] =>
          items.map((item) => {
            const out: Record<string, unknown> = {};
            for (const key of Object.keys(item)) {
              const val = item[key];
              const rule = converted.pipes[key];
              if (!rule) {
                out[key] = val;
                continue;
              }
              const toStr = (v: unknown) =>
                typeof v === 'string' ? v : String(v as string);
              out[key] = Array.isArray(val)
                ? val.map((v) =>
                    v == null
                      ? null
                      : this.pipeEngine.apply(toStr(v), rule, page.url()),
                  )
                : val == null
                  ? null
                  : this.pipeEngine.apply(toStr(val), rule, page.url());
            }
            return out;
          });

        if (!o.patternPagination) {
          const raw = await this.container.executeContainerExtraction(
            page,
            descriptor,
            o.currentPage ?? 1,
          );
          const items = applyPipes(
            raw.items as unknown as Record<string, unknown>[],
          );
          if (action.id) {
            context[action.id] = items;
            this.logger.debug(
              truncateLog(
                debugLogMaxLength,
                `  extractPatterns → id="${action.id}": ${items.length} item(s)`,
              ),
            );
          }
          break;
        }

        const popts: PaginationOptions = o.patternPagination;
        // Signature required by PaginationOperator's containerFn:
        // (page: Page) => Promise<T[]>; this action always operates on the
        // single outer `page`, never a distinct one, so the param is unused.
        const containerFn = async (
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _page: Page,
        ): Promise<Record<string, unknown>[]> => {
          const raw = await this.container.executeContainerExtraction(
            page,
            descriptor,
            1,
          );
          return applyPipes(raw.items as unknown as Record<string, unknown>[]);
        };

        let items: Record<string, unknown>[];
        let pages: number;

        if (popts.type === 'click-next') {
          ({ items, pages } = await this.pagination.paginateClickNext(
            page,
            containerFn,
            popts,
          ));
        } else if (popts.type === 'load-more') {
          ({ items, pages } = await this.pagination.paginateLoadMore(
            page,
            containerFn,
            popts,
          ));
        } else if (popts.type === 'infinite-scroll') {
          ({ items, pages } = await this.pagination.paginateInfiniteScroll(
            page,
            containerFn,
            popts,
          ));
        } else {
          const template = popts.urlTemplate ?? page.url();
          const startPage = popts.startPage ?? 2;

          const page1Items = await containerFn(page);

          const { items: restItems, pages: restPages } =
            await this.pagination.paginateUrlIncrement(
              template,
              async (pageUrl: string) => {
                await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
                return containerFn(page);
              },
              popts,
              startPage,
            );

          items = [...page1Items, ...restItems];
          pages = 1 + restPages;
        }

        if (action.id) {
          context[action.id] = items;
          context[`${action.id}_pagination`] = { pages };
          this.logger.debug(
            truncateLog(
              debugLogMaxLength,
              `  extractPatterns → id="${action.id}": ${items.length} item(s) across ${pages} page(s)`,
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

  async evaluateCondition(
    page: Page,
    condition: WorkflowAction['condition'],
    debugLogMaxLength = 0,
  ): Promise<boolean> {
    if (!condition) return true;

    if (condition.ifExists) {
      const element = await this.findElement(
        page,
        condition.ifExists,
        debugLogMaxLength,
      );
      return element !== null;
    }

    if (condition.unlessExists) {
      const element = await this.findElement(
        page,
        condition.unlessExists,
        debugLogMaxLength,
      );
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
    debugLogMaxLength = 0,
  ): Promise<ElementHandle<Node> | null> {
    this.logger.debug(
      truncateLog(
        debugLogMaxLength,
        `  findElement: ${this.describeTarget(target)}`,
      ),
    );

    if (target.shadowHost) {
      const el = await this.findElementInShadowRoot(page, target);
      this.logger.debug(
        truncateLog(
          debugLogMaxLength,
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
          debugLogMaxLength,
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
        debugLogMaxLength,
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
    debugLogMaxLength = 0,
  ): Promise<void> {
    const element = await this.findElement(page, target, debugLogMaxLength);
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
    debugLogMaxLength = 0,
  ): Promise<void> {
    const element = await this.findElement(page, target, debugLogMaxLength);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }

    await this.maybeScrollToElement(element, options?.scrollTo);

    const elem = element as ElementHandle<Element>;
    await elem.click();
    const typeDelay = options?.delay || 0;
    await elem.type(value, { delay: typeDelay });
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
    debugLogMaxLength = 0,
  ): Promise<void> {
    const element = await this.findElement(page, target, debugLogMaxLength);
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
    debugLogMaxLength = 0,
  ): Promise<void> {
    const element = await this.findElement(page, target, debugLogMaxLength);
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

  private async hoverElement(
    page: Page,
    target: ActionTarget,
    options?: WorkflowAction['options'],
    debugLogMaxLength = 0,
  ): Promise<void> {
    const element = await this.findElement(page, target, debugLogMaxLength);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }
    await this.maybeScrollToElement(element, options?.scrollTo);
    const elem = element as ElementHandle<Element>;
    await elem.hover();
  }

  private async clearElement(
    page: Page,
    target: ActionTarget,
    debugLogMaxLength = 0,
  ): Promise<void> {
    const element = await this.findElement(page, target, debugLogMaxLength);
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
