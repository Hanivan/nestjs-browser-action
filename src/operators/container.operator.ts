import type { Page } from 'puppeteer-core';
import { PipeEngine } from '../pipes/pipe-engine';
import { LoggerWithLevel } from '../utils/logger.util';
import { ExtractionOperator } from './extraction.operator';
import type {
  ContainerDescriptor,
  ContainerScrapeResult,
  PaginationDescriptor,
  PaginationResult,
} from '../interfaces/types';

/**
 * Stateless container-extraction logic (container scraping + pagination link
 * resolution) shared by BrowserActionService and (later) PageController.
 * Constructed per-caller with the deps it needs; holds no per-request page
 * state.
 */
export class ContainerOperator {
  constructor(
    private readonly extraction: ExtractionOperator,
    private readonly pipeEngine: PipeEngine,
    private readonly logger: LoggerWithLevel,
    private debugLogMaxLength: number,
  ) {}

  setDebugLogMaxLength(n: number): void {
    this.debugLogMaxLength = n;
  }

  async executeContainerExtraction<T = Record<string, unknown>>(
    page: Page,
    descriptor: ContainerDescriptor<T>,
    currentPage = 1,
  ): Promise<ContainerScrapeResult<T>> {
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
      descriptor.fields as unknown as Record<
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

    const items = rawItems as unknown as T[];
    let pagination: PaginationResult | undefined;
    if (descriptor.pagination) {
      pagination = await this.resolvePagination(
        page,
        descriptor.pagination,
        currentPage,
      );
    }
    return { items, pagination };
  }

  async resolvePagination(
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
}
