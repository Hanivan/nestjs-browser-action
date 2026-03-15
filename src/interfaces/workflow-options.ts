/**
 * Workflow system for declarative browser automation
 * Based on action-based scraping patterns
 */

/**
 * Target selector for browser actions
 */
export interface ActionTarget {
  type: 'css' | 'xpath';
  value: string;
  shadowHost?: string; // For Shadow DOM elements
}

/**
 * Action types supported in the workflow
 */
export type ActionType =
  | 'navigate' // Go to URL
  | 'wait' // Delay in seconds
  | 'waitFor' // Wait for selector
  | 'click' // Click element
  | 'type' // Type text
  | 'select' // Select from dropdown
  | 'scroll' // Scroll to element
  | 'extract' // Extract data
  | 'screenshot' // Take screenshot
  | 'evaluate' // Run JavaScript
  | 'saveCookies' // Save cookies to file
  | 'loadCookies' // Load cookies from file
  | 'clearCookies' // Clear all cookies
  | 'listCookies'; // List all cookies

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
}

/**
 * Result of workflow execution
 */
export interface WorkflowResult {
  success: boolean;
  data: Record<string, any>;
  errors: string[];
  screenshots?: string[];
}

/**
 * Variable interpolation context
 */
export type VariableContext = Record<string, any>;
