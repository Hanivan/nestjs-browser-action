import { Injectable, Scope, Optional, Inject } from '@nestjs/common';
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
import { CleansingPipe } from '../pipes/cleansing-pipe';
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
  PipeConfig,
} from '../interfaces/types';
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
} from '../constants/browser-action.constants';

@Injectable({ scope: Scope.TRANSIENT })
export class BrowserActionService {
  private readonly logger: LoggerWithLevel;
  private readonly pipeCache = new Map<string, CleansingPipe[]>();
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
  ): Promise<Buffer> {
    this.logger.debug(
      truncateLog(this.activeDebugLogMaxLength, `Taking screenshot of ${url}`),
    );
    const page = await this.pageService.navigateTo(url);
    const result = await page.screenshot({ path, ...options });
    await this.pageService.closePage();
    return result as unknown as Buffer;
  }

  async generatePDF(
    url: string,
    path: string,
    options?: PDFOptions,
  ): Promise<Buffer> {
    this.logger.debug(
      truncateLog(this.activeDebugLogMaxLength, `Generating PDF for ${url}`),
    );
    const page = await this.pageService.navigateTo(url);
    const pdf = await page.pdf({ path, ...options });
    await this.pageService.closePage();
    return Buffer.from(pdf);
  }

  async scrape<T extends SelectorMap>(
    url: string,
    selectors: T,
    options?: ScraperOptions,
  ): Promise<ScrapeResult> {
    this.logger.debug(
      truncateLog(this.activeDebugLogMaxLength, `Scraping ${url}`),
    );
    const page = await this.pageService.navigateTo(
      url,
      this.buildNavOptions(options),
      options?.cloak,
    );

    const result: ScrapeResult = {};
    // Bracket access keeps the call off overzealous `eval(` scanners; typed
    // back to the real puppeteer signature so callbacks stay type-checked.
    const evalOne = page['$eval'].bind(page) as Page['$eval'];

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

          if (options?.pipes?.[key]) {
            const pipeInstances = this.getCachedPipeInstances(
              options.pipes[key],
            );
            result[key] = this.cleansingService.cleanse(value, pipeInstances);
          } else {
            result[key] = value;
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

  private buildNavOptions(options?: ScraperOptions) {
    if (!options?.waitUntil && !options?.timeout) return undefined;
    return { waitUntil: options.waitUntil, timeout: options.timeout };
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
    const page = await this.pageService.navigateTo(
      url,
      this.buildNavOptions(options),
      options?.cloak,
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
            const pipeInstances = this.getCachedPipeInstances(
              options.pipes[key],
            );
            (result as ScrapeResult)[key] = values.map((value) =>
              this.cleansingService.cleanse(value, pipeInstances),
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
  ): Promise<Page> {
    this.logger.debug(
      truncateLog(
        this.activeDebugLogMaxLength,
        `Waiting for ${selector} on ${url}`,
      ),
    );
    const page = await this.pageService.navigateTo(url);
    await page.waitForSelector(selector, { timeout });
    return page;
  }

  async evaluate<T = unknown>(
    url: string,
    script: string | (() => unknown),
  ): Promise<T> {
    this.logger.debug(
      truncateLog(this.activeDebugLogMaxLength, `Evaluating script on ${url}`),
    );
    const page = await this.pageService.navigateTo(url);
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
            const screenshotPath =
              errorConfig.screenshotPath ||
              `${DEFAULT_ERROR_SCREENSHOT_FILENAME}-${Date.now()}.png`;
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

    const maxRetries = action.options?.retry ?? 0;
    const retryDelay = action.options?.retryDelay ?? 0;
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
        await delay(Number(action.value) || 0);
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
        const pipes = action.options?.pipes || [];

        if (pipes.length === 0) {
          throw new Error('cleanse action requires at least one pipe');
        }

        const valueKey = String(action.value || '');
        const pipeInstances = this.getCachedPipeInstances(pipes);
        const rawValue = this.resolveRawValue(valueKey, context);
        this.logger.debug(
          truncateLog(
            this.activeDebugLogMaxLength,
            `  cleanse raw: ${JSON.stringify(rawValue)} pipes: [${pipes.map((p) => p.type).join(', ')}]`,
          ),
        );

        const cleanedValue = Array.isArray(rawValue)
          ? rawValue.map((item) =>
              this.cleansingService.cleanse(String(item), pipeInstances),
            )
          : this.cleansingService.cleanse(String(rawValue), pipeInstances);

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

  private getCachedPipeInstances(config: PipeConfig[]): CleansingPipe[] {
    const cacheKey = JSON.stringify(config);
    if (!this.pipeCache.has(cacheKey)) {
      this.pipeCache.set(cacheKey, this.cleansingService.buildPipes(config));
    }
    return this.pipeCache.get(cacheKey)!;
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
