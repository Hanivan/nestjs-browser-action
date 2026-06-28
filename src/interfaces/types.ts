/**
 * Centralized type aliases for common type patterns
 * Reduces repetition and improves maintainability
 */

import { CleansingType } from '../enums/cleansing-type.enum';
import type { CloakOptions } from './browser-action-options';
import type { CleanerStepRules } from '../pipes/pipe-engine';

/**
 * Pipe configuration interface
 * Represents a single pipe transformation with optional parameters
 */
export interface PipeConfig {
  // `string` accommodates custom pipe types registered via
  // CleansingService.registerPipe / module `customPipes`.
  type: CleansingType | string;
  pattern?: string;
  replacement?: string;
  format?: string;
  primaryPipes?: PipeConfig[];
  fallbackPipes?: PipeConfig[];
  fallbackOn?: 'empty' | 'null' | 'undefined' | 'all';
  flags?: string;
  [key: string]: unknown;
}

/**
 * Selector mappings - CSS selector or XPath expression strings
 * Used in scrape() and scrapeAll() methods
 *
 * @example
 * const selectors: SelectorMap = {
 *   title: '.card h2',
 *   price: '.product-price',
 * };
 */
export type SelectorMap = Record<string, string>;

/**
 * Pipe configuration options - maps selector names to CleanerStepRules
 * Used in scrape() and scrapeAll() methods
 *
 * @example
 * const pipeOptions: PipeOptions = {
 *   title: { trim: true, toLowerCase: true },
 *   price: { custom: [{ type: 'num-normalize' }] },
 * };
 */
export type PipeOptions = Record<string, CleanerStepRules>;

export type { CleanerStepRules };

/**
 * Scraping result with single elements - each selector maps to a single value
 * Missing selectors are undefined (Partial type)
 *
 * @example
 * const result: ScrapeResult = {
 *   title: 'Product Title',
 *   price: 29.99,
 * };
 */
export type ScrapeResult = Partial<Record<string, unknown>>;

/**
 * Multi-element scraping result - each selector maps to an array of values
 * Missing selectors are undefined (Partial type)
 *
 * @example
 * const result: ScrapeAllResult = {
 *   titles: ['Title 1', 'Title 2', 'Title 3'],
 *   prices: [29.99, 15.50, 99.00],
 * };
 */
export type ScrapeAllResult = Partial<Record<string, unknown[]>>;

/**
 * Scraper options for scrape() and scrapeAll() methods
 *
 * @example
 * const options: ScraperOptions = {
 *   pipes: {
 *     title: { trim: true },
 *     price: { custom: [{ type: 'num-normalize' }] },
 *   },
 * };
 */
export type ScraperOptions = {
  pipes?: PipeOptions;
  /** Navigation wait condition passed to page.goto / page.setContent. */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  /** Navigation timeout (ms). */
  timeout?: number;
  /**
   * Per-call CloakBrowser override. When set, this call runs on a dedicated
   * off-pool browser launched with these stealth options (proxy/UA rotation),
   * closed when the call finishes. Ignored for remote (CDP) mode.
   */
  cloak?: CloakOptions;
  /**
   * When true, abort requests for stylesheet, image, media, and font resources.
   * Scripts, XHR, and fetch remain enabled.
   */
  interceptResource?: boolean;
  /**
   * When true, pick a random Chrome 71+ user-agent string per call.
   * Overrides cloak.userAgent for this call only.
   */
  useRandomUserAgent?: boolean;
  /**
   * Current page number, used by scrapeContainerFields() to resolve pagination.nextUrl.
   * Default: 1.
   */
  currentPage?: number;
};

/**
 * Generic scraper options for type-safe selector definitions
 *
 * @example
 * interface ProductScraping extends SelectorMap {
 *   title: '.product-title';
 *   price: '.product-price';
 * }
 *
 * const options: ScraperOptionsTyped<ProductScraping> = {
 *   pipes: {
 *     price: [{ type: CleansingType.TO_NUMBER }],
 *   },
 * };
 */
export type ScraperOptionsTyped<T extends SelectorMap> = {
  pipes?: Partial<Record<keyof T, PipeConfig[]>>;
};

/**
 * Generic typed version of ScrapeResult for specific selector keys
 * Preserves type information for known selector keys
 *
 * @example
 * interface ProductSelectors extends SelectorMap {
 *   title: string;
 *   price: number;
 * }
 * const result = await service.scrape<ProductSelectors>(url, {
 *   title: '.title',
 *   price: '.price',
 * }, {
 *   pipes: {
 *     price: [{ type: CleansingType.TO_NUMBER }],
 *   },
 * });
 */
export type ScrapeResultTyped<T extends SelectorMap> = Partial<
  Record<keyof T, unknown>
>;

/**
 * Generic typed version of ScrapeAllResult for specific selector keys
 * Preserves type information for known selector keys
 *
 * @example
 * interface ProductSelectors extends SelectorMap {
 *   titles: string[];
 *   prices: number[];
 * }
 * const result = await service.scrapeAll<ProductSelectors>(url, {
 *   titles: '.title',
 *   prices: '.price',
 * }, {
 *   pipes: {
 *     prices: [{ type: CleansingType.TO_NUMBER }],
 *   },
 * });
 */
export type ScrapeAllResultTyped<T extends SelectorMap = SelectorMap> = Partial<
  Record<keyof T, unknown[]>
>;

/**
 * Workflow result with typed data
 *
 * @example
 * interface ResultData {
 *   pageTitle: string;
 *   itemCount: number;
 * }
 * const result: WorkflowResultTyped<ResultData> = {
 *   success: true,
 *   data: {
 *     pageTitle: 'Home',
 *     itemCount: 42,
 *   },
 *   errors: [],
 * };
 */
export interface WorkflowResultTyped<T = Record<string, unknown>> {
  success: boolean;
  data: T;
  errors: string[];
  screenshots?: string[];
}

/**
 * How to extract one named field from a container node.
 * Selector is CSS or XPath (auto-detected by // or ( prefix), relative to the container node.
 */
export interface FieldDescriptor {
  selector: string;
  attribute?: string;
  returnType?: 'text' | 'html';
  multiple?: boolean;
  fallback?: string[];
}

/**
 * How to find pagination links on a page.
 */
export interface PaginationDescriptor {
  container: string;
  linkSelector: string;
  labelSelector: string;
}

/**
 * Resolved pagination state returned from extraction.
 */
export interface PaginationResult {
  pages: Array<{ label: string; url: string }>;
  nextUrl: string | null;
}

/**
 * Full descriptor for scrapeContainerFields().
 * `container` is CSS or XPath to each repeating root node.
 * `fields` maps output key names to FieldDescriptor.
 */
export interface ContainerDescriptor<T = Record<string, unknown>> {
  container: string;
  fields: Record<string & keyof T, FieldDescriptor>;
  pagination?: PaginationDescriptor;
}

/**
 * Output of scrapeContainerFields().
 */
export interface ContainerScrapeResult<T = Record<string, unknown>> {
  items: T[];
  pagination?: PaginationResult;
}

/**
 * Metadata for a PatternField — mirrors xpath-parser's PatternMeta exactly.
 */
export interface PatternMeta {
  multiple?: boolean | string;
  multiline?: boolean;
  alterPattern?: string[];
  isContainer?: boolean;
  isPage?: boolean;
  pageUrlKey?: string;
  pageTextKey?: string;
}

/**
 * Single field definition — mirrors xpath-parser's PatternField.
 * patternType 'css' is browser-action-specific; 'xpath' is shared with xpath-parser.
 * returnType 'rawHTML' is the xpath-parser spelling; 'html' is accepted as an alias.
 */
export interface PatternField {
  key: string;
  patternType: 'xpath' | 'css';
  returnType: 'text' | 'rawHTML' | 'html';
  patterns: string[];
  meta?: PatternMeta;
  pipes?: CleanerStepRules;
}

/**
 * Pagination strategy type for evaluateWebsite().
 */
export type PaginationType =
  | 'click-next'
  | 'load-more'
  | 'infinite-scroll'
  | 'url-increment';

/**
 * Pagination configuration for evaluateWebsite().
 */
export interface PaginationOptions {
  type: PaginationType;
  /** click-next / load-more: selector for the button/link to click.
   *  infinite-scroll: optional selector for a sentinel element to scroll to (omit = scroll to bottom). */
  selector?: string;
  /** infinite-scroll: selector for an "end of list" marker — stops when visible. */
  endSelector?: string;
  /** url-increment: URL template with {page} placeholder, e.g. "https://site.com/list?page={page}" */
  urlTemplate?: string;
  /** url-increment: first page number substituted into urlTemplate. Default: 2. */
  startPage?: number;
  /** Safety cap — max pagination iterations. Default: 10. */
  maxPages?: number;
  /** ms to wait after each pagination action before re-scraping. Default: 800. */
  waitAfter?: number;
}

/**
 * Input to evaluateWebsite() — mirrors xpath-parser's EvaluateOptions.
 */
export interface EvaluateOptions {
  url?: string;
  patterns: PatternField[];
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
  cloak?: CloakOptions;
  interceptResource?: boolean;
  useRandomUserAgent?: boolean;
  pagination?: PaginationOptions;
}

/**
 * Output of evaluateWebsite() — mirrors xpath-parser's return shape.
 */
export interface EvaluateResult<T = Record<string, unknown>> {
  results: T[];
  totalPages?: number;
}

/**
 * All workflow-related types re-exported for convenience
 */
export type {
  ActionTarget,
  ActionType,
  ActionOptions,
  ActionCondition,
  ErrorStrategy,
  WorkflowAction,
  WorkflowDefinition,
  WorkflowResult,
  VariableContext,
} from './workflow-options';
