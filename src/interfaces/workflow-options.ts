/**
 * Workflow system for declarative browser automation
 * Based on action-based scraping patterns
 */

import type { PipeConfig } from './types';
import type { CloakOptions } from './browser-action-options';

/**
 * Target selector for browser actions
 */
export interface ActionTarget {
  type: 'css' | 'xpath';
  value?: string; // Omit to extract the shadow root itself (requires shadowHost)
  shadowHost?: string; // For Shadow DOM elements
}

/**
 * Action types supported in the workflow
 */
export type ActionType =
  | 'navigate' // Go to URL
  | 'wait' // Delay in milliseconds
  | 'waitFor' // Wait for selector
  | 'click' // Click element
  | 'type' // Type text
  | 'select' // Select from dropdown
  | 'scroll' // Scroll to element
  | 'extract' // Extract data
  | 'screenshot' // Take screenshot
  | 'evaluate' // Run JavaScript
  | 'cleanse' // Cleanse extracted data
  | 'saveCookies' // Save cookies to file
  | 'loadCookies' // Load cookies from file
  | 'clearCookies' // Clear all cookies
  | 'listCookies' // List all cookies
  | 'hover' // Hover over element
  | 'keyPress' // Press keyboard key(s)
  | 'clear' // Clear input field value
  | 'waitForNetwork' // Wait for network idle
  | 'reload'; // Reload the page

/**
 * Condition for conditional action execution
 */
export interface ActionCondition {
  ifExists?: ActionTarget;
  unlessExists?: ActionTarget;
}

/**
 * Error strategy for action execution
 */
export type ErrorStrategy = 'continue' | 'fail' | 'skip';

/**
 * Options for action execution
 */
export interface ActionOptions {
  timeout?: number;
  delay?: number; // Delay between keystrokes (ms)
  scrollTo?: boolean; // Scroll element into view before interaction
  retry?: number; // Number of retries on failure
  retryDelay?: number; // Delay between retries (ms)
  waitForNavigation?: boolean; // Wait for navigation after action
  navigationTimeout?: number; // Timeout for navigation wait
  overwrite?: boolean; // Overwrite existing file (for saveCookies action)
  metadata?: Record<string, unknown>; // Additional metadata (for saveCookies action)
  pipes?: PipeConfig[]; // Pipes for cleanse action
  multiple?: boolean; // Extract all matching elements as array
  as?: 'text' | 'html' | 'outerHtml' | 'attribute'; // Extract mode (default: 'text')
  attribute?: string; // Attribute name when as: 'attribute'
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'; // For reload
}

/**
 * Individual workflow action
 */
export interface WorkflowAction {
  id?: string; // For referencing extracted data
  action: ActionType;
  target?: ActionTarget;
  value?: string | number;
  options?: ActionOptions;
  condition?: ActionCondition;
  onError?: ErrorStrategy;
}

/**
 * Error handling configuration
 */
export interface WorkflowErrorConfig {
  screenshot?: boolean;
  screenshotPath?: string;
  continue?: boolean;
}

/**
 * Complete workflow definition
 */
export interface WorkflowDefinition {
  version: string;
  actions: WorkflowAction[];
  onError?: WorkflowErrorConfig;
  /**
   * Override the global debugLogMaxLength for this workflow only.
   * Set to 0 to disable truncation for this workflow.
   */
  debugLogMaxLength?: number;
  /**
   * Per-call CloakBrowser override. When set, the workflow runs on a dedicated
   * off-pool browser (proxy/UA rotation), closed when the workflow finishes.
   * Ignored in remote (CDP) mode.
   */
  cloak?: CloakOptions;
}

/**
 * Result of workflow execution
 */
export interface WorkflowResult {
  success: boolean;
  data: Record<string, unknown>;
  errors: string[];
  screenshots?: string[];
}

/**
 * Variable interpolation context
 */
export type VariableContext = Record<string, unknown>;
