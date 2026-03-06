import { Injectable } from '@nestjs/common';
import type {
  Page,
  ScreenshotOptions,
  PDFOptions,
  ElementHandle,
} from 'puppeteer';
import { PageService } from '../services/page-service';
import type {
  WorkflowDefinition,
  WorkflowResult,
  WorkflowAction,
  ActionTarget,
  VariableContext,
} from '../interfaces/workflow-options';
import { LoggerWithLevel } from './logger.util';
import {
  DEFAULT_ACTION_TIMEOUT,
  DEFAULT_NAVIGATION_TIMEOUT,
  DEFAULT_SCROLL_DELAY_MS,
  DEFAULT_SCREENSHOT_FILENAME,
  DEFAULT_ERROR_SCREENSHOT_FILENAME,
} from '../constants/browser-action.constants';

@Injectable()
export class ActionHelpersService {
  private readonly logger: LoggerWithLevel;

  constructor(private readonly pageService: PageService) {
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
    this.logger.log(`Taking screenshot of ${url}`, 'debug');
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
    this.logger.log(`Generating PDF for ${url}`, 'debug');
    const page = await this.pageService.navigateTo(url);
    const pdf = await page.pdf({ path, ...options });
    await this.pageService.closePage();
    return Buffer.from(pdf);
  }

  async scrape<T extends Record<string, string>>(
    url: string,
    selectors: T,
  ): Promise<Partial<Record<keyof T, string>>> {
    this.logger.log(`Scraping ${url}`, 'debug');
    const page = await this.pageService.navigateTo(url);

    const result: Partial<Record<keyof T, string>> = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        const value = await page.$eval(selector, (el) => el.textContent);
        (result as Record<string, string>)[key] = value;
      } catch {
        this.logger.log(`Failed to scrape ${selector}`, 'warn');
        // Property remains undefined (optional in Partial type)
      }
    }

    await this.pageService.closePage();
    return result;
  }

  async waitForSelector(
    url: string,
    selector: string,
    timeout?: number,
  ): Promise<Page> {
    this.logger.log(`Waiting for ${selector} on ${url}`, 'debug');
    const page = await this.pageService.navigateTo(url);
    await page.waitForSelector(selector, { timeout });
    return page;
  }

  async evaluate<T = unknown>(
    url: string,
    script: string | (() => any),
  ): Promise<T> {
    this.logger.log(`Evaluating script on ${url}`, 'debug');
    const page = await this.pageService.navigateTo(url);
    const result = await page.evaluate(script as string);
    await this.pageService.closePage();
    return result as T;
  }

  async scrapeWithActions<T extends Record<string, any> = Record<string, any>>(
    url: string,
    workflow: WorkflowDefinition,
    variables?: VariableContext,
  ): Promise<WorkflowResult & { data: T }> {
    this.logger.log(`Starting workflow execution for ${url}`, 'debug');
    const page = await this.pageService.navigateTo(url);
    const result: WorkflowResult & { data: T } = {
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
          this.logger.log(`Action failed: ${errorMessage}`, 'error');

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
      this.logger.log(`Workflow execution failed: ${errorMessage}`, 'error');
    } finally {
      await this.pageService.closePage();
    }

    return result;
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
        this.logger.log(
          `Skipping action due to condition: ${action.action}`,
          'debug',
        );
        return;
      }
    }

    const value = this.interpolateValue(String(action.value || ''), context);

    switch (action.action) {
      case 'navigate':
        await page.goto(value);
        break;

      case 'wait':
        await this.wait(Number(action.value) || 0);
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
        const extractedValue = await this.extractData(page, action.target!);
        if (action.id) {
          context[action.id] = extractedValue;
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
        // Handle arrow functions: '() => expr' becomes (() => expr)()
        // Handle raw expressions: 'expr' becomes expr
        let evalCode: string;
        if (value.includes('=>')) {
          // It's an arrow function, wrap and execute it
          evalCode = `(${value})()`;
        } else {
          // It's a raw expression or already has return
          evalCode = value;
        }

        this.logger.log(`Evaluating: ${evalCode}`, 'debug');
        const evalResult = await page.evaluate(evalCode);
        this.logger.log(`Result: ${JSON.stringify(evalResult)}`, 'debug');

        if (action.id) {
          context[action.id] = evalResult;
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

  private async findElement(
    page: Page,
    target: ActionTarget,
  ): Promise<ElementHandle<Node> | null> {
    // If shadow host is specified, find element within shadow root
    if (target.shadowHost) {
      return this.findElementInShadowRoot(page, target);
    }

    // Regular element lookup
    if (target.type === 'css') {
      return page.$(target.value) as Promise<ElementHandle<Node> | null>;
    }

    // XPath lookup
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
      }, target.value)
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

          // XPath lookup in shadow root
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
      await page.waitForSelector(target.value, { timeout });
    } else {
      // For XPath, use waitForFunction with document.evaluate
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
        target.value,
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

    // Cast to ElementHandle<Element> for Puppeteer methods
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
    await this.wait(DEFAULT_SCROLL_DELAY_MS / 1000);
  }

  private async extractData(page: Page, target: ActionTarget): Promise<string> {
    const element = await this.findElement(page, target);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }

    return element.evaluate((el: Element) => el.textContent?.trim() || '', {});
  }

  private wait(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
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
