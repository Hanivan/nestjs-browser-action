import type { Page, ElementHandle } from 'puppeteer-core';
import { PipeEngine } from '../pipes/pipe-engine';
import { LoggerWithLevel } from '../utils/logger.util';
import { truncateLog } from '../utils/truncate-log.util';
import type {
  SelectorMap,
  ScrapeResult,
  PipeOptions,
} from '../interfaces/types';
import type {
  ActionTarget,
  ActionOptions,
} from '../interfaces/workflow-options';

/**
 * Stateless page-level extraction logic shared by BrowserActionService and
 * (later) PageController. Constructed per-caller with the deps it needs;
 * holds no per-request page state.
 */
export class ExtractionOperator {
  constructor(
    private readonly pipeEngine: PipeEngine,
    private readonly logger: LoggerWithLevel,
  ) {}

  /**
   * Split a trailing `@attr` off a selector, e.g.
   * `meta[name="description"]@content` → { selector, attribute: 'content' }.
   */
  parseSelector(raw: string): { selector: string; attribute?: string } {
    const match = raw.match(/^(.*)@([A-Za-z_][\w-]*)$/);
    if (match && match[1].trim() !== '') {
      return { selector: match[1], attribute: match[2] };
    }
    return { selector: raw };
  }

  validateSelector(key: string, selector: string): void {
    if (!selector || selector.trim() === '') {
      throw new Error(`Selector for '${key}' cannot be empty`);
    }
  }

  async extractSingle(
    page: Page,
    url: string,
    selectors: SelectorMap,
    pipes?: PipeOptions,
  ): Promise<ScrapeResult> {
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

          result[key] = pipes?.[key]
            ? this.pipeEngine.apply(
                typeof value === 'string' ? value : String(value ?? ''),
                pipes[key],
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
    return result;
  }

  async extractAllData(
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

  async extractAllFromShadowRoot(
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

  async extractData(
    page: Page,
    target: ActionTarget,
    as: ActionOptions['as'] = 'text',
    attribute?: string,
    debugLogMaxLength = 0,
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

    const element = await this.findElement(page, target, debugLogMaxLength);
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
}
