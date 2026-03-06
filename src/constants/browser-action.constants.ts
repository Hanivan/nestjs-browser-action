export const BROWSER_ACTION_OPTIONS = 'BROWSER_ACTION_OPTIONS';

export const DEFAULT_POOL_OPTIONS = {
  min: 2,
  max: 10,
  idleTimeoutMs: 30000,
  strategy: 'round-robin' as const,
};

export const DEFAULT_LAUNCH_OPTIONS = {
  headless: true,
};

export const DEFAULT_CONTEXT_OPTIONS = {
  viewport: {
    width: 1920,
    height: 1080,
  },
};

// Workflow action defaults
export const DEFAULT_ACTION_TIMEOUT = 30000;
export const DEFAULT_NAVIGATION_TIMEOUT = 30000;
export const DEFAULT_SCROLL_DELAY_MS = 100;
export const DEFAULT_SCREENSHOT_FILENAME = 'screenshot';
export const DEFAULT_ERROR_SCREENSHOT_FILENAME = 'error';
