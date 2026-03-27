import { Injectable, Scope } from '@nestjs/common';
import type {
  Page,
  ScreenshotOptions,
  PDFOptions,
  ElementHandle,
  KeyInput,
} from 'puppeteer';
import { PageService } from '../services/page-service';
import { CookieService } from '../services/cookie.service';
import { CleansingService } from '../services/cleansing.service';
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
import { LoggerWithLevel } from './logger.util';
import { delay } from './delay.util';
import { isXPathSelector } from './dom.util';
import {
  DEFAULT_ACTION_TIMEOUT,
  DEFAULT_NAVIGATION_TIMEOUT,
  DEFAULT_SCROLL_DELAY_MS,
  DEFAULT_SCREENSHOT_FILENAME,
  DEFAULT_ERROR_SCREENSHOT_FILENAME,
} from '../constants/browser-action.constants';

@Injectable({ scope: Scope.TRANSIENT })
export class ActionHelpersService {
  private readonly logger: LoggerWithLevel;
  private readonly pipeCache = new Map<string, CleansingPipe[]>();

  constructor(
    private readonly pageService: PageService,
    private readonly cookieService: CookieService,
    private readonly cleansingService: CleansingService,
  ) {
    this.logger = new LoggerWithLevel(
      ActionHelpersService.name,
      this.pageService.getLogLevel(),
    );
  }

  async takeScreenshot(
    url: string,
    path: string,
    options?: ScreenshotOptions,
  ): Promise<Buffer> {
    this.logger.debug(`Taking screenshot of ${url}`);
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
    this.logger.debug(`Generating PDF for ${url}`);
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
    this.logger.debug(`Scraping ${url}`);
    const page = await this.pageService.navigateTo(url);

    const result: ScrapeResult = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        const value = await page.$eval(selector, (el) => el.textContent);

        if (options?.pipes?.[key]) {
          const pipeInstances = this.getCachedPipeInstances(options.pipes[key]);
          result[key] = this.cleansingService.cleanse(value, pipeInstances);
        } else {
          result[key] = value;
        }
      } catch {
        this.logger.warn(`Failed to scrape ${selector}`);
      }
    }

    await this.pageService.closePage();
    return result;
  }

  async scrapeAll<T extends SelectorMap>(
    url: string,
    selectors: T,
    options?: ScraperOptions,
  ): Promise<ScrapeAllResult> {
    this.logger.debug(`Scraping all elements from ${url}`);
    const page = await this.pageService.navigateTo(url);

    const result: ScrapeAllResult = {};

    for (const [key, selector] of Object.entries(selectors)) {
      this.validateSelector(key, selector);

      try {
        const isXPath = isXPathSelector(selector);
        let values: string[];

        if (isXPath) {
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
        } else {
          values = await page.$$eval(selector, (elements) =>
            elements.map((el) => el.textContent?.trim() || ''),
          );
        }

        if (options?.pipes?.[key]) {
          const pipeInstances = this.getCachedPipeInstances(options.pipes[key]);
          (result as ScrapeResult)[key] = values.map((value) =>
            this.cleansingService.cleanse(value, pipeInstances),
          );
        } else {
          (result as ScrapeResult)[key] = values;
        }
      } catch {
        this.logger.warn(`Failed to scrape ${selector}`);
      }
    }

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
          selector!,
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
    this.logger.debug(`Waiting for ${selector} on ${url}`);
    const page = await this.pageService.navigateTo(url);
    await page.waitForSelector(selector, { timeout });
    return page;
  }

  async evaluate<T = unknown>(
    url: string,
    script: string | (() => any),
  ): Promise<T> {
    this.logger.debug(`Evaluating script on ${url}`);
    const page = await this.pageService.navigateTo(url);
    const result = await page.evaluate(script as string);
    await this.pageService.closePage();
    return result as T;
  }

  async scrapeWithActions<T = Record<string, unknown>>(
    url: string,
    workflow: WorkflowDefinition,
    variables?: VariableContext,
  ): Promise<WorkflowResultTyped<T>> {
    this.logger.debug(`Starting workflow execution for ${url}`);
    const page = await this.pageService.navigateTo(url);
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
    // Reuse existing scrapeWithActions infrastructure
    // The only difference is the name - it already supports multi-element via options.multiple
    return await this.scrapeWithActions<T>(url, workflow, variables);
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
        this.logger.debug(`Skipping action due to condition: ${action.action}`);
        return;
      }
    }

    const value = this.interpolateValue(String(action.value || ''), context);

    switch (action.action) {
      case 'navigate':
        await page.goto(value);
        break;

      case 'wait':
        await delay(Number(action.value) || 0);
        break;

      case 'waitFor':
        await this.waitForTarget(page, action.target!, action.options);
        break;

      case 'click':
        await this.clickElement(page, action.target!, action.options);
        break;

      case 'type':
        await this.typeText(page, action.target!, value, action.options);
        break;

      case 'select':
        await this.selectOption(page, action.target!, value, action.options);
        break;

      case 'scroll':
        await this.scrollToElement(page, action.target!);
        break;

      case 'extract': {
        const extractOptions = action.options || {};
        const extractAs = extractOptions.as ?? 'text';
        const extractAttr = extractOptions.attribute;

        if (!action.target) {
          if (action.id) context[action.id] = await page.content();
          break;
        }

        if (extractOptions.multiple) {
          const allValues = await this.extractAllData(
            page,
            action.target,
            extractAs,
            extractAttr,
          );
          if (action.id) context[action.id] = allValues;
        } else {
          const extractedValue = await this.extractData(
            page,
            action.target,
            extractAs,
            extractAttr,
          );
          if (action.id) context[action.id] = extractedValue;
        }
        break;
      }

      case 'screenshot': {
        const screenshotPath = String(
          action.value || `${DEFAULT_SCREENSHOT_FILENAME}-${Date.now()}.png`,
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

        this.logger.debug(`Evaluating: ${evalCode}`);
        const evalResult = await page.evaluate(evalCode);
        this.logger.debug(`Result: ${JSON.stringify(evalResult)}`);

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

        const currentValue = this.resolveValue(
          String(action.value || ''),
          context,
        );
        const pipeInstances = this.getCachedPipeInstances(pipes);
        const cleanedValue = this.cleansingService.cleanse(
          currentValue,
          pipeInstances,
        );

        if (action.id) {
          context[action.id] = cleanedValue;
          this.logger.debug(
            `Cleansed value for '${action.id}': ${JSON.stringify(cleanedValue)}`,
          );
        }
        break;
      }

      case 'saveCookies': {
        const sessionName = String(value);
        const overwrite = action.options?.overwrite ?? false;

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

        await this.cookieService.loadCookies(page, sessionName, {
          throwIfNotExists,
        });
        break;
      }

      case 'clearCookies': {
        const sessionName = String(value);
        await this.cookieService.deleteCookies(sessionName);
        break;
      }

      case 'listCookies': {
        const sessions = await this.cookieService.listCookies();

        if (action.id) {
          context[action.id] = sessions;
        }
        break;
      }

      case 'hover':
        await this.hoverElement(page, action.target!, action.options);
        break;

      case 'keyPress':
        if (!value) {
          throw new Error('keyPress action requires a key value');
        }
        await page.keyboard.press(value as KeyInput);
        break;

      case 'clear':
        await this.clearElement(page, action.target!);
        break;

      case 'waitForNetwork':
        await page.waitForNetworkIdle({
          timeout: action.options?.timeout ?? DEFAULT_ACTION_TIMEOUT,
        });
        break;

      case 'reload':
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

  private async findElement(
    page: Page,
    target: ActionTarget,
  ): Promise<ElementHandle<Node> | null> {
    if (target.shadowHost) {
      return this.findElementInShadowRoot(page, target);
    }

    if (target.type === 'css') {
      return page.$(target.value!) as Promise<ElementHandle<Node> | null>;
    }

    return page
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
      this.pipeCache.set(cacheKey, this.cleansingService.loadPipes(config));
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
          if (extractAs === 'attribute') return el.getAttribute(attr || '') || '';
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
