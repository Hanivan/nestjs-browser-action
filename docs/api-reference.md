# API Reference

Complete reference of all services, interfaces, and configuration options.

## Table of Contents

- [Services](#services)
- [Configuration](#configuration)
- [Interfaces](#interfaces)
- [Enums](#enums)
- [Types](#types)

## Services

### ActionHelpersService

High-level browser automation service.

#### Methods

##### `scrape<T extends SelectorMap>(url, selectors, options?): Promise<ScrapeResult>`

Extract single elements from web page.

**See:** [scrape() Documentation](../methods/scrape.md)

---

##### `scrapeAll<T extends SelectorMap>(url, selectors, options?): Promise<ScrapeAllResult>`

Extract all matching elements from web page.

**See:** [scrapeAll() Documentation](../methods/scrape-all.md)

---

##### `scrapeWithActions<T>(url, workflow, variables?): Promise<WorkflowResultTyped<T>>`

Execute workflow-based browser automation.

**See:** [Workflow Documentation](../methods/workflow.md)

---

##### `scrapeAllWithWorkflow<T>(url, workflow, variables?): Promise<WorkflowResultTyped<T>>`

Execute workflow with multi-element extraction support (alias for `scrapeWithActions` with `options.multiple`).

**See:** [Workflow Documentation](../methods/workflow.md)

---

##### `takeScreenshot(url, path, options?): Promise<Buffer>`

Capture screenshot of web page.

**See:** [Screenshots Documentation](../methods/screenshots.md)

---

##### `generatePDF(url, path, options?): Promise<Buffer>`

Generate PDF of web page.

**See:** [Screenshots Documentation](../methods/screenshots.md)

---

##### `waitForSelector(url, selector, timeout?): Promise<Page>`

Wait for selector to appear on page.

---

##### `evaluate<T>(url, script): Promise<T>`

Execute JavaScript in page context.

---

### BrowserManagerService

Manage browser pool connections.

#### Methods

##### `getBrowser(): Promise<Browser>`

Acquire browser from pool.

##### `releaseBrowser(browser: Browser): Promise<void>`

Return browser to pool.

##### `getPoolStatus(): PoolStatus`

Get current pool statistics.

**Returns:**
```typescript
{
  available: number;  // Available browsers
  size: number;       // Total pool size
  waiting: number;    // Requests waiting
}
```

---

### PageService

Manage page lifecycle.

#### Methods

##### `createPage(): Promise<Page>`

Create new page (auto-acquires browser from pool).

##### `navigateTo(url, options?): Promise<Page>`

Navigate to URL.

##### `closePage(): Promise<void>`

Close current page (releases browser to pool).

##### `getCurrentPage(): Promise<Page>`

Get current page instance.

##### `getCurrentBrowser(): Promise<Browser>`

Get current browser instance.

---

### CookieService

Manage cookie persistence.

#### Methods

##### `saveCookies(page, sessionName, options?): Promise<void>`

Save cookies to file.

**See:** [Cookie Management](../features/cookies.md)

##### `loadCookies(page, sessionName, options?): Promise<void>`

Load cookies from file.

##### `deleteCookies(sessionName): Promise<void>`

Delete cookie session.

##### `clearAllCookies(): Promise<void>`

Clear all cookie sessions.

##### `listCookies(): Promise<CookieSessionInfo[]>`

List all saved sessions.

##### `hasSession(sessionName): boolean`

Check if session exists.

**See:** [Cookie Management](../features/cookies.md)

---

### CleansingService

Data cleansing with pipes.

#### Methods

##### `cleanse<TInput, TOutput>(data, pipes): TOutput`

Apply pipes to transform data.

##### `cleanseWithProfile<T>(data, profileName): T`

Apply predefined profile to data.

##### `loadPipes(config: PipeConfig[]): CleansingPipe[]`

Load pipe instances from configuration.

**See:** [Pipe System](../features/pipes.md)

---

## Configuration

### BrowserActionOptions

```typescript
interface BrowserActionOptions {
  // Browser launch options
  launchOptions?: LaunchOptions;

  // Browser context options
  contextOptions?: BrowserContextOptions;

  // Connection pool configuration
  pool?: {
    min?: number;              // Minimum pool size (default: 2)
    max?: number;              // Maximum pool size (default: 10)
    idleTimeoutMs?: number;   // Idle timeout (default: 30000ms)
    strategy?: 'round-robin' | 'least-recently-used'; // Pool selection (default: 'round-robin')
  };

  // Multi-context support
  multiContext?: boolean;

  // Logging
  logLevel?: 'log' | 'error' | 'warn' | 'debug' | 'verbose';

  // Cookie persistence
  cookies?: {
    enabled?: boolean;          // Enable cookie persistence (default: true)
    cookiesDir?: string;        // Cookie directory (default: './cookies')
    autoSave?: boolean;         // Auto-save after workflows
    autoLoad?: boolean;         // Auto-load before workflows
    defaultSessionName?: string; // Default session name (default: 'default')
  };
}
```

## Interfaces

### ActionTarget

```typescript
interface ActionTarget {
  type: 'css' | 'xpath';
  value: string;
  shadowHost?: string;  // For Shadow DOM elements
}
```

### ActionType

```typescript
type ActionType =
  | 'navigate'           // Go to URL
  | 'wait'               // Delay in seconds
  | 'waitFor'            // Wait for selector
  | 'click'              // Click element
  | 'type'               // Type text
  | 'select'             // Select from dropdown
  | 'scroll'             // Scroll to element
  | 'extract'            // Extract data
  | 'screenshot'         // Take screenshot
  | 'evaluate'           // Run JavaScript
  | 'cleanse'            // Cleanse extracted data
  | 'saveCookies'        // Save cookies to file
  | 'loadCookies'        // Load cookies from file
  | 'clearCookies'       // Clear all cookies
  | 'listCookies';       // List all cookies
```

### ActionOptions

```typescript
interface ActionOptions {
  timeout?: number;              // Action timeout (ms)
  delay?: number;                // Delay between keystrokes (ms)
  scrollTo?: boolean;            // Scroll element into view
  retry?: number;                // Number of retries
  retryDelay?: number;           // Delay between retries (ms)
  waitForNavigation?: boolean;   // Wait for navigation after action
  navigationTimeout?: number;    // Timeout for navigation wait
  overwrite?: boolean;           // Overwrite existing file (cookies)
  metadata?: Record<string, unknown>; // Additional metadata (cookies)
  pipes?: PipeConfig[];          // Pipes for cleanse action
  multiple?: boolean;            // Extract all matching elements (extract)
}
```

### ActionCondition

```typescript
interface ActionCondition {
  ifExists?: ActionTarget;      // Execute only if element exists
  unlessExists?: ActionTarget;   // Execute only if element doesn't exist
}
```

### ErrorStrategy

```typescript
type ErrorStrategy = 'continue' | 'fail' | 'skip';
```

### WorkflowDefinition

```typescript
interface WorkflowDefinition {
  version: string;
  actions: WorkflowAction[];
  onError?: WorkflowErrorConfig;
}
```

### WorkflowAction

```typescript
interface WorkflowAction {
  id?: string;
  action: ActionType;
  target?: ActionTarget;
  value?: string | number;
  options?: ActionOptions;
  condition?: ActionCondition;
  onError?: ErrorStrategy;
}
```

### WorkflowResult

```typescript
interface WorkflowResult {
  success: boolean;
  data: Record<string, unknown>;
  errors: string[];
  screenshots?: string[];
}
```

### WorkflowErrorConfig

```typescript
interface WorkflowErrorConfig {
  screenshot?: boolean;
  screenshotPath?: string;
  continue?: boolean;
}
```

### ScraperOptions

```typescript
interface ScraperOptions {
  pipes?: PipeOptions;
}
```

### PipeConfig

```typescript
interface PipeConfig {
  type: CleansingType;
  pattern?: string;
  replacement?: string;
  format?: string;
  primaryPipes?: PipeConfig[];
  fallbackPipes?: PipeConfig[];
  fallbackOn?: 'empty' | 'null' | 'undefined' | 'all';
  flags?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}
```

### CleansingOptions

```typescript
interface CleansingOptions {
  pipes?: PipeConfig[];
  profile?: CleansingProfile;
}
```

### CleansingWithAltOptions

```typescript
interface CleansingWithAltOptions {
  primaryPipes: PipeConfig[];
  fallbackPipes: PipeConfig[];
  fallbackOn?: 'empty' | 'null' | 'undefined' | 'all';
}
```

### ScrapeCleansingOptions

```typescript
interface ScrapeCleansingOptions {
  pipes?: Record<string, PipeConfig[]>;
}
```

### SaveCookieOptions

```typescript
interface SaveCookieOptions {
  overwrite?: boolean;
  metadata?: Record<string, unknown>;
}
```

### LoadCookieOptions

```typescript
interface LoadCookieOptions {
  throwIfNotExists?: boolean;
}
```

### PoolOptions

```typescript
interface PoolOptions {
  min?: number;
  max?: number;
  idleTimeoutMs?: number;
  strategy?: 'round-robin' | 'least-recently-used';
}
```

## Enums

### CleansingType

```typescript
enum CleansingType {
  TRIM = 'trim',
  TO_NUMBER = 'to-number',
  TO_LOWER_CASE = 'to-lower-case',
  TO_UPPER_CASE = 'to-upper-case',
  SANITIZE_TEXT = 'sanitize-text',
  DATE_FORMAT = 'date-format',
  REGEX_REPLACE = 'regex-replace',
  REGEX_EXTRACT = 'regex-extract',
  REMOVE_CURRENCY_SYMBOL = 'remove-currency-symbol',
  REMOVE_SPECIAL_CHARS = 'remove-special-chars',
  NORMALIZE_WHITESPACE = 'normalize-whitespace',
  REMOVE_LINE_BREAKS = 'remove-line-breaks',
  ALT_FLAG = 'alt-flag',
}
```

### CleansingProfile

```typescript
enum CleansingProfile {
  PRICE = 'price',
  PHONE = 'phone',
  EMAIL = 'email',
  DATE = 'date',
  CURRENCY = 'currency',
}
```

## Types

### SelectorMap

```typescript
type SelectorMap = Record<string, string>;
```

Map of selector names to CSS/XPath selector strings.

### PipeOptions

```typescript
type PipeOptions = Record<string, PipeConfig[]>;
```

Map of selector names to pipe arrays.

### ScrapeResult

```typescript
type ScrapeResult = Partial<Record<string, unknown>>;
```

Single-element scraping result. Missing selectors are undefined.

### ScrapeAllResult

```typescript
type ScrapeAllResult = Partial<Record<string, unknown[]>>;
```

Multi-element scraping result. Each selector maps to an array.

### VariableContext

```typescript
type VariableContext = Record<string, unknown>;
```

Variable mapping for workflow interpolation.

### WorkflowResultTyped<T>

```typescript
interface WorkflowResultTyped<T = Record<string, unknown>> {
  success: boolean;
  data: T;
  errors: string[];
  screenshots?: string[];
}
```

Type-safe workflow result.

## Decorators

### @InjectBrowser()

Inject a browser instance (auto-acquired from pool, auto-released).

```typescript
import { InjectBrowser } from '@hanivanrizky/nestjs-browser-action';
import { Browser } from 'puppeteer';

@Injectable()
export class MyService {
  constructor(
    @InjectBrowser()
    private readonly browser: Browser,
  ) {}
}
```

### @InjectPage()

Inject a page instance (auto-created and closed).

```typescript
import { InjectPage } from '@hanivanrizky/nestjs-browser-action';
import { Page } from 'puppeteer';

@Injectable()
export class MyService {
  constructor(
    @InjectPage()
    private readonly page: Page,
  ) {}
}
```

## See Also

- [Method Documentation](../methods) - Detailed method guides
- [Feature Guides](../features) - Feature-specific documentation
- [Workflow Actions](../workflow-actions.md) - Action reference
