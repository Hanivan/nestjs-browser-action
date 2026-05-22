/**
 * Centralized type aliases for common type patterns
 * Reduces repetition and improves maintainability
 */

import { CleansingType } from '../enums/cleansing-type.enum';
import type { CloakOptions } from './browser-action-options';

/**
 * Pipe configuration interface
 * Represents a single pipe transformation with optional parameters
 */
export interface PipeConfig {
  type: CleansingType;
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
 * Pipe configuration options - maps selector names to pipe arrays
 * Used in scrape() and scrapeAll() methods
 *
 * @example
 * const pipeOptions: PipeOptions = {
 *   title: [{ type: CleansingType.TRIM }, { type: CleansingType.TO_LOWER_CASE }],
 *   price: [{ type: CleansingType.TO_NUMBER }],
 * };
 */
export type PipeOptions = Record<string, PipeConfig[]>;

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
 *     title: [{ type: CleansingType.TRIM }],
 *   },
 * };
 */
export type ScraperOptions = {
  pipes?: PipeOptions;
  /** Navigation wait condition passed to page.goto. */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  /** Navigation timeout (ms) passed to page.goto. */
  timeout?: number;
  /**
   * Per-call CloakBrowser override. When set, this call runs on a dedicated
   * off-pool browser launched with these stealth options (proxy/UA rotation),
   * closed when the call finishes. Ignored for remote (CDP) mode.
   */
  cloak?: CloakOptions;
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
