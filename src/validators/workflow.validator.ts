/**
 * Workflow validation layer.
 *
 * Validates WorkflowDefinition before execution to prevent abuse:
 * - Action type whitelist
 * - Bounds on retry, retryDelay, timeout, delay
 * - URL protocol restrictions for navigate/evaluate
 * - Path sanitization for screenshot paths
 * - Cloak override policy
 * - PipeConfig safety
 */

import { isURL } from 'class-validator';
import { isSafeRegex } from '../utils/regex.util';
import type {
  WorkflowDefinition,
  WorkflowAction,
  ActionType,
} from '../interfaces/workflow-options';

export class WorkflowValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly action?: string,
    message?: string,
  ) {
    super(message || `Invalid workflow field: ${field}`);
    this.name = 'WorkflowValidationError';
  }
}

/** Whitelist of known action types */
const VALID_ACTIONS = new Set<ActionType>([
  'navigate',
  'wait',
  'waitFor',
  'click',
  'type',
  'select',
  'scroll',
  'extract',
  'screenshot',
  'evaluate',
  'cleanse',
  'saveCookies',
  'loadCookies',
  'clearCookies',
  'listCookies',
  'hover',
  'keyPress',
  'clear',
  'waitForNetwork',
  'reload',
]);

/** Default limits */
const DEFAULT_MAX_ACTIONS = 100;
const DEFAULT_MAX_RETRY = 100;
const DEFAULT_MAX_RETRY_DELAY_MS = 300_000; // 5 min
const DEFAULT_MAX_TIMEOUT_MS = 300_000; // 5 min
const DEFAULT_MAX_WAIT_MS = 300_000; // 5 min
const DEFAULT_MAX_DELAY_MS = 60_000; // 1 min (keystroke delay)
const DEFAULT_MAX_NAVIGATION_TIMEOUT_MS = 300_000; // 5 min

/** Maximum evaluate script length in characters */
const MAX_EVALUATE_SCRIPT_LENGTH = 50_000;

/** Path traversal sentinel */
const PATH_TRAVERSAL = '..';
const ABSOLUTE_PATH_PREFIX = '/';

export interface WorkflowValidationOptions {
  /** Allow per-workflow cloak override. Default: true */
  allowCloakOverride?: boolean;
  /** Max actions in a workflow. Default: 100 */
  maxActions?: number;
  /** Max retry count per action. Default: 100 */
  maxRetry?: number;
  /** Max retry delay in ms. Default: 300_000 */
  maxRetryDelayMs?: number;
  /** Max action timeout in ms. Default: 300_000 */
  maxTimeoutMs?: number;
  /** Max wait delay in ms. Default: 300_000 */
  maxWaitMs?: number;
  /** Max keystroke delay in ms. Default: 60_000 */
  maxDelayMs?: number;
  /** Max navigation timeout in ms. Default: 300_000 */
  maxNavigationTimeoutMs?: number;
  /** Allowed URL protocols. Default: ['http','https'] */
  allowedProtocols?: string[];
}

function validateAction(
  action: WorkflowAction,
  index: number,
  opts: Required<WorkflowValidationOptions>,
): void {
  const prefix = `actions[${index}]`;

  // 1. Action type whitelist
  if (!VALID_ACTIONS.has(action.action)) {
    throw new WorkflowValidationError(
      `${prefix}.action`,
      action.action,
      `Invalid action type: ${action.action}`,
    );
  }

  // 2. Options bounds
  if (action.options) {
    const o = action.options;

    if (o.retry !== undefined) {
      if (
        typeof o.retry !== 'number' ||
        o.retry < 0 ||
        o.retry > opts.maxRetry
      ) {
        throw new WorkflowValidationError(
          `${prefix}.options.retry`,
          action.action,
          `retry must be a number between 0 and ${opts.maxRetry}`,
        );
      }
    }

    if (o.retryDelay !== undefined) {
      if (
        typeof o.retryDelay !== 'number' ||
        o.retryDelay < 0 ||
        o.retryDelay > opts.maxRetryDelayMs
      ) {
        throw new WorkflowValidationError(
          `${prefix}.options.retryDelay`,
          action.action,
          `retryDelay must be a number between 0 and ${opts.maxRetryDelayMs}ms`,
        );
      }
    }

    if (o.timeout !== undefined) {
      if (
        typeof o.timeout !== 'number' ||
        o.timeout < 0 ||
        o.timeout > opts.maxTimeoutMs
      ) {
        throw new WorkflowValidationError(
          `${prefix}.options.timeout`,
          action.action,
          `timeout must be a number between 0 and ${opts.maxTimeoutMs}ms`,
        );
      }
    }

    if (o.delay !== undefined) {
      if (
        typeof o.delay !== 'number' ||
        o.delay < 0 ||
        o.delay > opts.maxDelayMs
      ) {
        throw new WorkflowValidationError(
          `${prefix}.options.delay`,
          action.action,
          `delay must be a number between 0 and ${opts.maxDelayMs}ms`,
        );
      }
    }

    if (o.navigationTimeout !== undefined) {
      if (
        typeof o.navigationTimeout !== 'number' ||
        o.navigationTimeout < 0 ||
        o.navigationTimeout > opts.maxNavigationTimeoutMs
      ) {
        throw new WorkflowValidationError(
          `${prefix}.options.navigationTimeout`,
          action.action,
          `navigationTimeout must be a number between 0 and ${opts.maxNavigationTimeoutMs}ms`,
        );
      }
    }

    // Validate pipes for cleanse action
    if (action.action === 'cleanse' && o.pipes) {
      validatePipeConfigs(o.pipes, `${prefix}.options.pipes`);
    }
  }

  // 3. Value validation per action type
  const val = action.value;

  if (action.action === 'navigate' && val !== undefined) {
    const url = String(val);
    if (
      !isURL(url, { require_protocol: true, protocols: opts.allowedProtocols })
    ) {
      throw new WorkflowValidationError(
        `${prefix}.value`,
        action.action,
        `Invalid URL for navigate: ${url}`,
      );
    }
  }

  if (action.action === 'screenshot' && val !== undefined) {
    const raw = String(val);
    if (raw.includes(PATH_TRAVERSAL) || raw.startsWith(ABSOLUTE_PATH_PREFIX)) {
      throw new WorkflowValidationError(
        `${prefix}.value`,
        action.action,
        `Invalid screenshot path: ${val}`,
      );
    }
  }

  if (action.action === 'evaluate' && val !== undefined) {
    const code = String(val);
    if (code.length > MAX_EVALUATE_SCRIPT_LENGTH) {
      throw new WorkflowValidationError(
        `${prefix}.value`,
        action.action,
        `evaluate script exceeds maximum length of ${MAX_EVALUATE_SCRIPT_LENGTH} characters`,
      );
    }
  }

  if (action.action === 'wait' && val !== undefined) {
    const ms = Number(val);
    if (Number.isNaN(ms) || ms < 0 || ms > opts.maxWaitMs) {
      throw new WorkflowValidationError(
        `${prefix}.value`,
        action.action,
        `wait value must be a number between 0 and ${opts.maxWaitMs}ms`,
      );
    }
  }
}

/**
 * Validate an array of pipe configuration objects.
 *
 * Uses `Record<string, unknown>[]` instead of `PipeConfig[]` so that
 * untrusted / runtime input can be validated without TypeScript
 * rejecting objects that are missing required fields.
 */
export function validatePipeConfigs(
  configs: Array<Record<string, unknown>>,
  pathPrefix = 'pipes',
): void {
  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    const prefix = `${pathPrefix}[${i}]`;

    if (!cfg.type || typeof cfg.type !== 'string') {
      throw new WorkflowValidationError(
        `${prefix}.type`,
        undefined,
        'PipeConfig must have a string type',
      );
    }

    // If a pattern is present, validate it's not a ReDoS regex
    if ('pattern' in cfg && typeof cfg.pattern === 'string') {
      if (!isSafeRegex(cfg.pattern)) {
        throw new WorkflowValidationError(
          `${prefix}.pattern`,
          undefined,
          `Potentially dangerous regex pattern rejected: ${cfg.pattern}`,
        );
      }
    }

    // Validate nested AltFlag pipes
    const primary = cfg.primaryPipes;
    if (
      Array.isArray(primary) &&
      primary.every((p) => typeof p === 'object' && p !== null)
    ) {
      validatePipeConfigs(
        primary as Array<Record<string, unknown>>,
        `${prefix}.primaryPipes`,
      );
    }
    const fallback = cfg.fallbackPipes;
    if (
      Array.isArray(fallback) &&
      fallback.every((p) => typeof p === 'object' && p !== null)
    ) {
      validatePipeConfigs(
        fallback as Array<Record<string, unknown>>,
        `${prefix}.fallbackPipes`,
      );
    }
  }
}

/**
 * Validate a complete WorkflowDefinition before execution.
 *
 * @param workflow The workflow to validate
 * @param options Validation options (all have sensible defaults)
 * @throws WorkflowValidationError on first invalid field found
 */
export function validateWorkflow(
  workflow: WorkflowDefinition,
  options?: WorkflowValidationOptions,
): void {
  const opts: Required<WorkflowValidationOptions> = {
    allowCloakOverride: options?.allowCloakOverride ?? true,
    maxActions: options?.maxActions ?? DEFAULT_MAX_ACTIONS,
    maxRetry: options?.maxRetry ?? DEFAULT_MAX_RETRY,
    maxRetryDelayMs: options?.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS,
    maxTimeoutMs: options?.maxTimeoutMs ?? DEFAULT_MAX_TIMEOUT_MS,
    maxWaitMs: options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
    maxDelayMs: options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
    maxNavigationTimeoutMs:
      options?.maxNavigationTimeoutMs ?? DEFAULT_MAX_NAVIGATION_TIMEOUT_MS,
    allowedProtocols: options?.allowedProtocols ?? ['http', 'https'],
  };

  // 1. Action count limit
  if (!Array.isArray(workflow.actions)) {
    throw new WorkflowValidationError(
      'actions',
      undefined,
      'workflow.actions must be an array',
    );
  }
  if (workflow.actions.length > opts.maxActions) {
    throw new WorkflowValidationError(
      'actions',
      undefined,
      `Too many actions: ${workflow.actions.length} (max ${opts.maxActions})`,
    );
  }

  // 2. Validate each action
  for (let i = 0; i < workflow.actions.length; i++) {
    validateAction(workflow.actions[i], i, opts);
  }

  // 3. Cloak override policy
  if (workflow.cloak && !opts.allowCloakOverride) {
    throw new WorkflowValidationError(
      'cloak',
      undefined,
      'Per-workflow cloak override is disabled',
    );
  }

  // 4. Validate onError config screenshot path
  if (workflow.onError?.screenshotPath) {
    const raw = workflow.onError.screenshotPath;
    if (raw.includes(PATH_TRAVERSAL) || raw.startsWith(ABSOLUTE_PATH_PREFIX)) {
      throw new WorkflowValidationError(
        'onError.screenshotPath',
        undefined,
        `Invalid error screenshot path: ${raw}`,
      );
    }
  }
}
