# API Reference

Complete reference of all services, interfaces, and configuration options.

## Table of Contents

- [Services](#services)
- [Configuration](#configuration)
- [Interfaces](#interfaces)
- [Enums](#enums)
- [Types](#types)

## Services

### BrowserActionService

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

##### `scrapeWithWorkflow<T>(url, workflow, variables?): Promise<WorkflowResultTyped<T>>`

Execute workflow-based browser automation.

**See:** [Workflow Documentation](../methods/workflow.md)

---

##### `scrapeAllWithWorkflow<T>(url, workflow, variables?): Promise<WorkflowResultTyped<T>>`

Execute workflow with multi-element extraction support (alias for `scrapeWithWorkflow` with `options.multiple`).

**See:** [Workflow Documentation](../methods/workflow.md)

---

##### `scrapeContainerFields<T>(url, descriptor, options?): Promise<ContainerScrapeResult<T>>`

Extract structured lists from a page using a container descriptor. Each node matched by `descriptor.container` is mapped to an object with the keys in `descriptor.fields`. Optionally resolves the next pagination URL.

```typescript
const { items, pagination } = await service.scrapeContainerFields<Product>(
  'https://example.com/products',
  {
    container: '.product-card',         // CSS or XPath (auto-detected)
    fields: {
      name:  { selector: 'h2.name' },
      price: { selector: '.price' },
      img:   { selector: 'img', attribute: 'src' },
      tags:  { selector: '.tag', multiple: true }, // → string[]
    },
    pagination: {
      container:     '.pagination',
      linkSelector:  'a',
      labelSelector: 'a',
    },
  },
  { currentPage: 1, interceptResource: true, useRandomUserAgent: true },
);

// items[0] = { name: '...', price: '...', img: '...', tags: [...] }
// pagination = { pages: [{label, url},...], nextUrl: '...' } or undefined
```

**Parameters:**
- `url` (string): Page URL to navigate to
- `descriptor` (`ContainerDescriptor<T>`): Container and field definitions
- `options` (`ScraperOptions`): Optional scrape options (`currentPage`, `interceptResource`, `useRandomUserAgent`, `waitUntil`, `timeout`, `cloak`)

**Returns:** `Promise<ContainerScrapeResult<T>>`
- `items` (`T[]`): Extracted list items
- `pagination` (`PaginationResult | undefined`): Pagination state if `descriptor.pagination` is set

---

##### `takeScreenshot(url, path, options?): Promise<Buffer>`

Capture screenshot of web page.

**See:** [Screenshots Documentation](../methods/screenshots.md)

---

##### `generatePDF(url, path, options?): Promise<Buffer>`

Generate PDF of web page.

**See:** [Screenshots Documentation](../methods/screenshots.md)

---

##### `captureTlsFingerprint(path, url?): Promise<TlsFingerprint>`

Navigate to a TLS-inspection endpoint (default `TLS_CAPTURE_URL` = `https://tls.peet.ws/api/all`), parse the browser's own TLS/HTTP fingerprint, save it to `path` as JSON, and return the curated result. The request is made by the browser itself, so the captured ja3/ja4/akamai reflect this browser's handshake. The full upstream payload is preserved under `raw`.

```typescript
const fp = await browserAction.captureTlsFingerprint('./out/tls.json');
// fp.ja3, fp.ja4, fp.headers, fp.akamaiFingerprint, fp.raw, ...
```

---

##### `waitForSelector(url, selector, timeout?): Promise<Page>`

Wait for selector to appear on page.

---

##### `evaluate<T>(url, script: string | (() => unknown)): Promise<T>`

Execute JavaScript in page context. `script` may be a string or a function (functions
are passed directly to `page.evaluate`, preserving normal Puppeteer semantics).

---

### BrowserManagerService

Manage browser pool connections.

#### Methods

##### `acquireBrowser(): Promise<Browser>`

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

##### `hasCookieSession(sessionName): boolean`

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

##### `buildPipes(config: PipeConfig[]): CleansingPipe[]`

Build pipe instances from configuration.

##### `registerPipe(type: string, pipeClass: new () => CleansingPipe): void`

Register a custom pipe so config-driven paths (`scrape` `pipes`, workflow `cleanse` actions, `buildPipes`) can resolve its `type`. Throws if `type` clashes with a builtin or an already-registered custom pipe.

##### `registerPipes(pipes: Record<string, new () => CleansingPipe>): void`

Register multiple custom pipes at once. Equivalent to calling `registerPipe` per entry.

**See:** [Pipe System](../features/pipes.md)

---

## Configuration

### BrowserActionOptions

```typescript
interface BrowserActionOptions {
  // Raw puppeteer-core launch options, forwarded to CloakBrowser's
  // launchOptions passthrough. Use `cloak` for stealth/anti-detect features.
  launchOptions?: LaunchOptions;

  // CloakBrowser stealth options for local launches (ignored when `remote` is set):
  // proxy, humanize, geoip, timezone, locale, stealthArgs, extensionPaths,
  // userDataDir (routes through launchPersistentContext), launchOptions passthrough.
  cloak?: CloakOptions;

  // Browser context options
  contextOptions?: BrowserContextOptions;

  // Connection pool configuration
  pool?: {
    min?: number;              // Minimum pool size (default: 2)
    max?: number;              // Maximum pool size (default: 10)
    idleTimeoutMs?: number;    // Close idle browsers down to min after this (default: 30000ms, 0 disables)
    acquireTimeoutMs?: number; // Reject acquire() if none free within this (default: 30000ms, 0 waits forever)
    strategy?: 'round-robin' | 'least-recently-used'; // Pool selection (default: 'round-robin')
  };

  // Multi-context support
  multiContext?: boolean;

  // Logging
  logLevel?: 'log' | 'error' | 'warn' | 'debug' | 'verbose';

  // Remote Chrome CDP connection
  remote?: {
    browserURL?: string;       // CDP browser URL (e.g., 'http://localhost:9222')
    browserWSEndpoint?: string; // CDP WebSocket endpoint (e.g., 'ws://localhost:9222/devtools/page/abc123')
    retryMax?: number;         // Max connection retry attempts (default: 3)
    retryDelay?: number;       // Delay between retries in ms (default: 1000)
  };

  // Cookie persistence
  cookies?: {
    enabled?: boolean;          // Enable cookie persistence (default: true)
    cookiesDir?: string;        // Cookie directory (default: './cookies')
    autoSave?: boolean;         // Auto-save after workflows
    autoLoad?: boolean;         // Auto-load before workflows
    defaultSessionName?: string; // Default session name (default: 'default')
  };

  // Custom cleansing pipes, keyed by `type`. Registered on CleansingService at
  // startup so config-driven paths (scrape `pipes`, workflow `cleanse`) resolve them.
  customPipes?: Record<string, new () => CleansingPipe>;

  // When true, skip the pool pre-warm on module init — browsers are spawned on the
  // first acquire() call (first scrape / evaluateWebsite). Useful when the app
  // bootstraps but the scraper is not always needed.
  // @default false
  lazyInit?: boolean;
}
```

#### Remote Chrome Configuration

Connect to remote Chrome instances using Chrome DevTools Protocol (CDP). Provide exactly one of:

- **browserURL**: CDP browser URL (e.g., `http://localhost:9222`). Connects to any available tab.
- **browserWSEndpoint**: Direct WebSocket endpoint to a specific tab (e.g., `ws://localhost:9222/devtools/page/abc123`).

**Remote-First Priority:** When both `remote` and `launchOptions` are provided, remote connection takes precedence.

**Retry Logic:** Configure connection retry behavior with `retryMax` (default: 3) and `retryDelay` (default: 1000ms).

**Example:**

```typescript
BrowserActionModule.forRoot({
  remote: {
    browserURL: 'http://localhost:9222',
    retryMax: 5,
    retryDelay: 2000,
  },
  pool: { min: 2, max: 5 },
})
```

**Starting Chrome with Remote Debugging:**

```bash
chrome --remote-debugging-port=9222
# Or
google-chrome --remote-debugging-port=9222
# Or
chromium --remote-debugging-port=9222
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
  | 'wait'               // Delay in ms
  | 'waitFor'            // Wait for selector
  | 'reload'             // Reload current page
  | 'waitForNetwork'     // Wait for network idle
  | 'click'              // Click element
  | 'type'               // Type text
  | 'select'             // Select from dropdown
  | 'scroll'             // Scroll to element
  | 'hover'              // Hover over element
  | 'keyPress'           // Press keyboard key
  | 'clear'              // Clear input field
  | 'extract'            // Extract data
  | 'screenshot'         // Take screenshot
  | 'evaluate'           // Run JavaScript
  | 'cleanse'            // Cleanse extracted data
  | 'scrapeContainer'    // Extract structured list + pagination
  | 'extractPagination'  // Extract pagination links only
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
  as?: 'text' | 'html' | 'outerHtml' | 'attribute'; // Extract mode (default: 'text')
  attribute?: string;            // Attribute name when as: 'attribute'
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'; // navigate / reload
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
  cloak?: CloakOptions;  // Per-call stealth override (off-pool browser; not in remote mode)
  interceptResource?: boolean;  // Abort css/image/media/font requests; keep js (script/xhr/fetch)
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

### TlsFingerprint

Returned by `captureTlsFingerprint()`. Curated TLS/HTTP fingerprint with the full upstream payload under `raw`.

```typescript
interface TlsFingerprint {
  capturedAt: string;          // ISO timestamp of the capture
  ip: string;                  // source IP:port seen by endpoint
  httpVersion: string;         // negotiated HTTP version, e.g. 'h2'
  method: string;              // request method
  userAgent: string;           // User-Agent sent
  ja3: string;
  ja3Hash: string;
  ja4: string;
  ja4_r?: string;
  peetprint: string;
  peetprintHash: string;
  ciphers: string[];           // offered cipher suites
  tlsExtensions: string[];     // TLS extension names, in order
  akamaiFingerprint: string;   // HTTP/2 akamai fingerprint
  akamaiFingerprintHash: string;
  headers: string[];           // request headers from HTTP/2 HEADERS frame
  raw: Record<string, unknown>; // full unmodified upstream response
}
```

### ScraperOptions

```typescript
interface ScraperOptions {
  pipes?: PipeOptions;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'; // Navigation wait
  timeout?: number;              // Navigation timeout (ms)
  cloak?: CloakOptions;          // Per-call stealth override (off-pool browser; not in remote mode)
  interceptResource?: boolean;   // Abort stylesheet/image/media/font requests (keeps script/XHR/fetch)
  useRandomUserAgent?: boolean;  // Pick a random Chrome UA string per call (overrides cloak.userAgent)
  currentPage?: number;          // Current page number for pagination resolution (default: 1)
}
```

### FieldDescriptor

Defines how to extract one named field from each container node.

```typescript
interface FieldDescriptor {
  selector: string;        // CSS or XPath selector (relative to the container node)
  attribute?: string;      // Extract attribute value instead of text content
  returnType?: 'text' | 'html'; // What to extract (default: 'text')
  multiple?: boolean;      // Return all matches as string[] instead of a single string
  fallback?: string[];     // Alternative selectors tried if the primary yields empty
}
```

XPath selectors are auto-detected: a string starting with `//` or `(` is treated as XPath; anything else is CSS.

### PaginationDescriptor

Defines where to find pagination links on the page.

```typescript
interface PaginationDescriptor {
  container: string;      // CSS selector for the pagination wrapper element
  linkSelector: string;   // CSS selector for anchor elements that contain hrefs
  labelSelector: string;  // CSS selector for the element whose text is the page label
}
```

### PaginationResult

Resolved pagination state returned from `scrapeContainerFields()`.

```typescript
interface PaginationResult {
  pages: Array<{ label: string; url: string }>; // All pagination links found
  nextUrl: string | null; // URL of the next page, or null if on the last page
}
```

`nextUrl` resolution: picks the lowest numeric page label greater than `currentPage`. Falls back to the first link whose label contains `next` or `>`.

### ContainerDescriptor\<T\>

Full descriptor passed to `scrapeContainerFields()`.

```typescript
interface ContainerDescriptor<T = Record<string, unknown>> {
  container: string;                            // CSS or XPath to each repeating root node
  fields: Record<string & keyof T, FieldDescriptor>; // Output key → extraction rule
  pagination?: PaginationDescriptor;            // Optional pagination config
}
```

### ContainerScrapeResult\<T\>

Return type of `scrapeContainerFields()`.

```typescript
interface ContainerScrapeResult<T = Record<string, unknown>> {
  items: T[];                      // Extracted list items
  pagination?: PaginationResult;   // Present only when descriptor.pagination is set
}
```

### PipeConfig

```typescript
interface PipeConfig {
  type: CleansingType | string; // string = custom registered pipe type
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
  idleTimeoutMs?: number;    // Reap idle browsers down to min (default: 30000ms, 0 disables)
  acquireTimeoutMs?: number; // Reject acquire() if none free in time (default: 30000ms, 0 waits forever)
  strategy?: 'round-robin' | 'least-recently-used';
}
```

### RemoteOptions

```typescript
interface RemoteOptions {
  browserURL?: string;       // CDP browser URL
  browserWSEndpoint?: string; // CDP WebSocket endpoint
  retryMax?: number;         // Max retry attempts (default: 3)
  retryDelay?: number;       // Delay between retries in ms (default: 1000)
}
```

Remote Chrome connection options via Chrome DevTools Protocol (CDP). Exactly one of `browserURL` or `browserWSEndpoint` must be provided.

### CookieOptions

```typescript
interface CookieOptions {
  enabled?: boolean;          // Enable cookie persistence (default: true)
  cookiesDir?: string;        // Cookie directory (default: './cookies')
  autoSave?: boolean;         // Auto-save after workflows
  autoLoad?: boolean;         // Auto-load before workflows
  defaultSessionName?: string; // Default session name (default: 'default')
}
```

Cookie persistence configuration options.

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
import { Browser } from 'puppeteer-core';

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
import { Page } from 'puppeteer-core';

@Injectable()
export class MyService {
  constructor(
    @InjectPage()
    private readonly page: Page,
  ) {}
}
```

## Validators

### validateWorkflow(workflow, options?)

Validates a `WorkflowDefinition` before execution. Throws `WorkflowValidationError` on invalid fields.

```typescript
import { validateWorkflow, WorkflowValidationError } from '@hanivanrizky/nestjs-browser-action';

try {
  validateWorkflow(workflow);
} catch (error) {
  if (error instanceof WorkflowValidationError) {
    console.log('Invalid field:', error.field);
    console.log('Action:', error.action);
  }
}
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `allowCloakOverride` | `boolean` | `true` | Allow per-workflow cloak override |
| `maxActions` | `number` | `100` | Maximum actions in workflow |
| `maxRetry` | `number` | `100` | Maximum retry count per action |
| `maxRetryDelayMs` | `number` | `300_000` | Maximum retry delay (ms) |
| `maxTimeoutMs` | `number` | `300_000` | Maximum action timeout (ms) |
| `maxWaitMs` | `number` | `300_000` | Maximum wait delay (ms) |
| `maxDelayMs` | `number` | `60_000` | Maximum keystroke delay (ms) |
| `maxNavigationTimeoutMs` | `number` | `300_000` | Maximum navigation timeout (ms) |
| `allowedProtocols` | `string[]` | `['http', 'https']` | Allowed URL protocols |

### validatePipeConfigs(configs, pathPrefix?)

Validates an array of pipe configurations. Checks for required `type`, ReDoS-safe regex patterns, and recursively validates nested `primaryPipes`/`fallbackPipes`.

```typescript
import { validatePipeConfigs } from '@hanivanrizky/nestjs-browser-action';

validatePipeConfigs([
  { type: 'trim' },
  { type: 'regex-extract', pattern: '\\d+' },
]);
```

## Utilities

### sanitizeForLog(value)

Recursively sanitizes values for safe logging. Masks credentials in URLs and redacts sensitive keys.

```typescript
import { sanitizeForLog } from '@hanivanrizky/nestjs-browser-action';

sanitizeForLog({
  server: 'http://user:pass@proxy.com',
  password: 'secret',
});
// { server: 'http://***:***@proxy.com', password: '***' }
```

### sanitizeErrorMessage(message)

Sanitizes an error message string by masking embedded URL credentials.

```typescript
import { sanitizeErrorMessage } from '@hanivanrizky/nestjs-browser-action';

sanitizeErrorMessage('Failed: ws://admin:secret@chrome:9222');
// 'Failed: ws://***:***@chrome:9222'
```

### sanitizeScreenshotPath(input)

Sanitizes screenshot paths to prevent directory traversal. Strips `..` sequences and backslashes, rejects absolute paths.

```typescript
import { sanitizeScreenshotPath } from '@hanivanrizky/nestjs-browser-action';

sanitizeScreenshotPath('screenshots/page.png');
// 'screenshots/page.png'

sanitizeScreenshotPath('../../../etc/passwd.png');
// 'etc/passwd.png'

sanitizeScreenshotPath('/absolute/path.png');
// throws Error: Absolute paths are not allowed for screenshots
```

### isSafeRegex(pattern)

Checks if a regex pattern is safe from catastrophic backtracking (ReDoS). Returns `false` for patterns with nested quantifiers like `(a+)+`.

```typescript
import { isSafeRegex } from '@hanivanrizky/nestjs-browser-action';

isSafeRegex('\\d+');      // true
isSafeRegex('(a+)+');     // false
isSafeRegex('(a*)*');     // false
```

## See Also

- [Method Documentation](../methods) - Detailed method guides
- [Feature Guides](../features) - Feature-specific documentation
- [Workflow Actions](../workflow-actions.md) - Action reference
