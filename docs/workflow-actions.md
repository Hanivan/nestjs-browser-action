# Workflow Actions Reference

Complete reference of all workflow action types and their configurations.

## Validation

Workflows are validated before execution. Invalid workflows throw `WorkflowValidationError` with details about the invalid field. See [Workflow Validation](../methods/workflow.md#validation) for full validation rules.

Key points:
- Only known action types are accepted
- `options.retry` is capped at 100
- `options.retryDelay`, `options.timeout`, `options.navigationTimeout` are capped at 300,000 ms
- `options.delay` (keystroke delay) is capped at 60,000 ms
- `navigate.value` must be a valid `http:` or `https:` URL, or a template variable (e.g. `${baseUrl}`) resolved at runtime
- `screenshot.value` must not contain `..` or start with `/`
- `evaluate.value` is limited to 50,000 characters
- `wait.value` is capped at 300,000 ms
- `options.pipes` are validated recursively (ReDoS patterns rejected)

## Action Types

| Action | Description | Category |
|--------|-------------|----------|
| `navigate` | Navigate to URL | Browser |
| `wait` | Wait for specified time (ms) | Browser |
| `waitFor` | Wait for element to appear | Browser |
| `reload` | Reload the current page | Browser |
| `waitForNetwork` | Wait for network to be idle | Browser |
| `click` | Click on element | Interaction |
| `type` | Type text into input | Interaction |
| `select` | Select dropdown option | Interaction |
| `scroll` | Scroll element into view | Interaction |
| `hover` | Hover over element | Interaction |
| `keyPress` | Press keyboard key(s) | Interaction |
| `clear` | Clear input field value | Interaction |
| `extract` | Extract data from element or page | Data |
| `screenshot` | Take screenshot | Data |
| `evaluate` | Execute JavaScript | Data |
| `cleanse` | Cleanse extracted data with pipes | Data |
| `scrapeContainer` | Extract structured list with optional pagination | Data |
| `extractPagination` | Extract pagination links from the page | Data |
| `saveCookies` | Save cookies to file | Cookie |
| `loadCookies` | Load cookies from file | Cookie |
| `clearCookies` | Clear all cookies | Cookie |
| `listCookies` | List all cookie sessions | Cookie |

## Action Definition

All actions share this base structure:

```typescript
interface WorkflowAction {
  id?: string;                    // Store result in context
  action: ActionType;             // Action type (see table above)
  target?: ActionTarget;          // Target selector (for actions that need it)
  value?: string | number;        // Action value
  options?: ActionOptions;        // Action options
  condition?: ActionCondition;     // Conditional execution
  onError?: ErrorStrategy;        // Error handling ('continue', 'fail', 'skip')
}
```

## Browser Actions

### navigate

Navigate to a URL.

```typescript
{
  action: 'navigate',
  value: 'https://example.com',
}
```

**Parameters:**
- `value` (string): URL to navigate to
- `options.waitUntil` (`'load'` | `'domcontentloaded'` | `'networkidle0'` | `'networkidle2'`): When to consider navigation done
- `options.timeout` (number): Navigation timeout (ms)

**Example:**
```typescript
{
  action: 'navigate' as const,
  value: '${baseUrl}/products',  // Can use variables
  options: { waitUntil: 'networkidle0', timeout: 30000 },
}
```

---

### wait

Wait for specified time in milliseconds.

```typescript
{
  action: 'wait',
  value: 2000,  // Wait for 2 seconds
}
```

**Parameters:**
- `value` (number): Milliseconds to wait

**Example:**
```typescript
{
  action: 'wait' as const,
  value: 5000,  // Wait 5 seconds
}
```

---

### waitFor

Wait for an element to appear on the page.

```typescript
{
  action: 'waitFor',
  target: { type: 'css', value: '#button' },
  options: { timeout: 10000 },
}
```

**Parameters:**
- `target` (ActionTarget): Element selector
- `options.timeout` (number): Max wait time in milliseconds (default: 30000ms)

**Example:**
```typescript
{
  action: 'waitFor' as const,
  target: { type: 'css' as const, value: '.loaded' },
  options: { timeout: 5000 },
}
```

---

## Interaction Actions

### click

Click on an element.

```typescript
{
  action: 'click',
  target: { type: 'css', value: '#submit-button' },
  options: {
    scrollTo: true,
    waitForNavigation: true,
    navigationTimeout: 30000,
  },
}
```

**Parameters:**
- `target` (ActionTarget): Element to click
- `options.scrollTo` (boolean): Scroll element into view before clicking
- `options.waitForNavigation` (boolean): Wait for navigation after click
- `options.navigationTimeout` (number): Navigation timeout in milliseconds

**Example:**
```typescript
{
  action: 'click' as const,
  target: { type: 'css' as const, value: 'button[type="submit"]' },
  options: {
    scrollTo: true,
    waitForNavigation: true,
  },
}
```

---

### type

Type text into an input field.

```typescript
{
  action: 'type',
  target: { type: 'css', value: '#input' },
  value: 'Hello World',
  options: {
    delay: 50,           // Delay between keystrokes (ms)
    scrollTo: true,     // Scroll into view before typing
  },
}
```

**Parameters:**
- `target` (ActionTarget): Input element selector
- `value` (string): Text to type
- `options.delay` (number): Delay between keystrokes in milliseconds (default: 0)
- `options.scrollTo` (boolean): Scroll element into view before typing

**Example:**
```typescript
{
  action: 'type' as const,
  target: { type: 'css' as const, value: '#search-input' },
  value: 'NestJS browser automation',
  options: {
    delay: 50,
    scrollTo: true,
  },
}
```

---

### select

Select an option from a dropdown.

```typescript
{
  action: 'select',
  target: { type: 'css', value: '#country' },
  value: 'USA',
}
```

**Parameters:**
- `target` (ActionTarget): Select element selector
- `value` (string): Value to select

**Example:**
```typescript
{
  action: 'select' as const,
  target: { type: 'css' as const, value: '#country' },
  value: 'United States',
}
```

---

### scroll

Scroll to an element.

```typescript
{
  action: 'scroll',
  target: { type: 'css', value: '#footer' },
}
```

**Parameters:**
- `target` (ActionTarget): Element to scroll to

**Example:**
```typescript
{
  action: 'scroll' as const,
  target: { type: 'css' as const, value: '.bottom-of-page' },
}
```

---

### hover

Hover over an element (triggers CSS `:hover` states, dropdowns, tooltips).

```typescript
{
  action: 'hover',
  target: { type: 'css', value: '#menu-item' },
}
```

**Parameters:**
- `target` (ActionTarget): Element to hover over

**Example:**
```typescript
// Hover to reveal a dropdown, then click an item
{ action: 'hover' as const, target: { type: 'css' as const, value: '#nav-products' } },
{ action: 'click' as const, target: { type: 'css' as const, value: '#nav-products .dropdown a' } },
```

---

### keyPress

Press a keyboard key. Useful for submitting forms (Enter), closing modals (Escape), or navigating inputs (Tab).

```typescript
{
  action: 'keyPress',
  value: 'Enter',
}
```

**Parameters:**
- `value` (string): Key name — `'Enter'`, `'Escape'`, `'Tab'`, `'ArrowDown'`, `'ArrowUp'`, `'Backspace'`, etc.

**Example:**
```typescript
{ action: 'type' as const, target: { type: 'css' as const, value: '#search' }, value: 'laptops' },
{ action: 'keyPress' as const, value: 'Enter' },
```

---

### clear

Clear the value of an input or textarea field. Dispatches `input` and `change` events so React/Vue detect the change.

```typescript
{
  action: 'clear',
  target: { type: 'css', value: '#search-input' },
}
```

**Parameters:**
- `target` (ActionTarget): Input or textarea element to clear

**Example:**
```typescript
{ action: 'clear' as const, target: { type: 'css' as const, value: '#email' } },
{ action: 'type' as const, target: { type: 'css' as const, value: '#email' }, value: 'new@email.com' },
```

---

## Browser Actions (Page-Level)

### reload

Reload the current page.

```typescript
{
  action: 'reload',
}
```

**Parameters:**
- `options.waitUntil` (`'load'` | `'domcontentloaded'` | `'networkidle0'` | `'networkidle2'`): When to consider reload done (default: `'load'`)
- `options.timeout` (number): Timeout in ms (default: 30000)

**Example:**
```typescript
{ action: 'reload' as const, options: { waitUntil: 'networkidle0' } },
```

---

### waitForNetwork

Wait until there are no more than 0 in-flight network requests for at least 500ms. Essential for SPAs that load data via fetch/XHR.

```typescript
{
  action: 'waitForNetwork',
}
```

**Parameters:**
- `options.timeout` (number): Max wait time in ms (default: 30000)

**Example:**
```typescript
{ action: 'click' as const, target: { type: 'css' as const, value: '#load-more' } },
{ action: 'waitForNetwork' as const },
{ action: 'extract' as const, id: 'items', target: { type: 'css' as const, value: '.item' }, options: { multiple: true } },
```

---

## Data Actions

### extract

Extract data from element(s) or the entire page.

```typescript
// Text content (default)
{
  action: 'extract',
  target: { type: 'css', value: 'h1' },
  id: 'title',
}

// innerHTML of an element
{
  action: 'extract',
  target: { type: 'css', value: '.article' },
  id: 'articleHtml',
  options: { as: 'html' },
}

// outerHTML of an element
{
  action: 'extract',
  target: { type: 'css', value: '.card' },
  id: 'cardHtml',
  options: { as: 'outerHtml' },
}

// Attribute value
{
  action: 'extract',
  target: { type: 'css', value: 'a.link' },
  id: 'href',
  options: { as: 'attribute', attribute: 'href' },
}

// Entire page HTML (no target)
{
  action: 'extract',
  id: 'pageHtml',
  options: { as: 'outerHtml' },
}

// All matching elements
{
  action: 'extract',
  target: { type: 'css', value: '.card h2' },
  id: 'allTitles',
  options: { multiple: true },
}
```

**Parameters:**
- `target` (ActionTarget): Element selector — omit to extract the entire page HTML
- `id` (string): Context key to store result
- `options.as` (`'text'` | `'html'` | `'outerHtml'` | `'attribute'`): What to extract (default: `'text'`)
- `options.attribute` (string): Attribute name when `as: 'attribute'`
- `options.multiple` (boolean): Extract all matching elements as array (default: false)
- `options.pipes` (PipeConfig[]): Pipes to apply to extracted data

**Examples:**
```typescript
// Single element
{
  id: 'title',
  action: 'extract' as const,
  target: { type: 'css' as const, value: 'h1' },
}

// Multiple elements
{
  id: 'allLinks',
  action: 'extract' as const,
  target: { type: 'css' as const, value: 'a[href]' },
  options: { multiple: true },
}

// With pipes
{
  id: 'price',
  action: 'extract' as const,
  target: { type: 'css' as const, value: '.price' },
  options: {
    pipes: [
      { type: CleansingType.TRIM },
      { type: CleansingType.TO_NUMBER },
    ],
  },
}
```

---

### screenshot

Take a screenshot of the current page.

```typescript
{
  action: 'screenshot',
  value: './screenshot.png',
}
```

**Parameters:**
- `value` (string): File path to save screenshot

**Example:**
```typescript
{
  action: 'screenshot' as const,
  value: './screenshots/capture.png',
}
```

---

### evaluate

Execute JavaScript code in the page context.

```typescript
{
  action: 'evaluate',
  id: 'pageTitle',
  value: 'return document.title',
}

// Arrow function
{
  action: 'evaluate',
  id: 'allLinks',
  value: '() => Array.from(document.querySelectorAll("a")).map(a => a.href)',
}
```

**Parameters:**
- `value` (string): JavaScript code to execute
- `id` (string): Context key to store result

**Examples:**
```typescript
// Simple expression
{
  id: 'title',
  action: 'evaluate' as const,
  value: 'return document.title',
}

// Arrow function (auto-executed)
{
  id: 'allLinks',
  action: 'evaluate' as const,
  value: '() => Array.from(document.querySelectorAll("a")).map(a => a.href)',
}

// Complex operation
{
  id: 'data',
  action: 'evaluate' as const,
  value: `() => {
    const cards = document.querySelectorAll('.card');
    return Array.from(cards).map(card => ({
      title: card.querySelector('h2')?.textContent,
      price: card.querySelector('.price')?.textContent,
    }));
  }`,
}
```

---

### cleanse

Cleanse extracted data using pipes.

```typescript
{
  action: 'cleanse',
  id: 'cleanTitle',
  value: '${rawTitle}',
  options: {
    pipes: [
      { type: 'trim' },
      { type: 'to-upper-case' },
    ],
  },
}
```

**Parameters:**
- `value` (string): Variable reference or literal value to cleanse
- `id` (string): Context key to store result
- `options.pipes` (PipeConfig[]): Pipes to apply

When `value` resolves to an **array** (e.g. from `multiple: true` extraction), the pipes are applied to each item individually and the result is also an array.

**Example — single value:**
```typescript
const workflow = {
  version: '1.0' as const,
  actions: [
    {
      id: 'rawTitle',
      action: 'extract' as const,
      target: { type: 'css' as const, value: 'h1' },
    },
    {
      id: 'title',
      action: 'cleanse' as const,
      value: '${rawTitle}',
      options: {
        pipes: [
          { type: CleansingType.TRIM },
          { type: CleansingType.TO_UPPER_CASE },
        ],
      },
    },
  ],
};
```

**Example — array value (from `multiple: true`):**
```typescript
const workflow = {
  version: '1.0' as const,
  actions: [
    {
      id: 'rawCategories',
      action: 'extract' as const,
      target: { type: 'css' as const, value: '.category' },
      options: { multiple: true },
    },
    {
      id: 'categories',
      action: 'cleanse' as const,
      value: '${rawCategories}',  // array → pipes applied to each item
      options: {
        pipes: [
          { type: CleansingType.TRIM },
          { type: CleansingType.NORMALIZE_WHITESPACE },
        ],
      },
    },
  ],
};
// result.data.categories → ['Electronics', 'Home & Garden', 'Sports']
```

---

### scrapeContainer

Extract a structured list of items from repeating container nodes on the current page. Stores items under `context[action.id]` and (if `pagination` is configured) pagination state under `context[action.id + '_pagination']`.

```typescript
{
  id: 'products',
  action: 'scrapeContainer',
  options: {
    container: '.product-card',     // CSS or XPath to each repeating node
    fields: {
      name:  { selector: 'h2.name' },
      price: { selector: '.price' },
      href:  { selector: 'a', attribute: 'href' },
      tags:  { selector: '.tag', multiple: true },  // → string[]
    },
    pagination: {
      container:     '.pagination',
      linkSelector:  'a',
      labelSelector: 'a',
    },
    currentPage: 1,   // Used to resolve pagination.nextUrl
  },
}
```

**Parameters (inside `options`):**
- `container` (string): CSS or XPath selector for repeating root nodes (required)
- `fields` (Record\<string, FieldDescriptor\>): Field extraction rules (required)
  - `selector` (string): CSS or XPath relative to each container node
  - `attribute` (string): Extract attribute instead of text
  - `multiple` (boolean): Return `string[]` instead of a single string
  - `fallback` (string[]): Alternative selectors if the primary yields empty
- `pagination` (PaginationDescriptor): Optional — finds next-page links
  - `container` (string): CSS selector for pagination wrapper
  - `linkSelector` (string): CSS for anchor elements
  - `labelSelector` (string): CSS for the element providing the page label text
- `currentPage` (number): Current page number (default: 1) for `nextUrl` resolution

**Result stored in context:**
- `context[id]` → `T[]` — the extracted items array
- `context[id + '_pagination']` → `{ pages: [{label, url}], nextUrl: string|null }` (only when `pagination` is set)

**Example:**
```typescript
{
  version: '1.0',
  actions: [
    {
      id: 'products',
      action: 'scrapeContainer',
      options: {
        container: '.product-card',
        fields: {
          name:  { selector: 'h2' },
          price: { selector: '.price' },
        },
        pagination: { container: '.pager', linkSelector: 'a', labelSelector: 'a' },
        currentPage: 1,
      },
    },
  ],
}
// result.data.products         → [{ name, price }, ...]
// result.data.products_pagination → { pages: [...], nextUrl: '...' }
```

---

### extractPagination

Extract pagination links from the page without scraping container fields. Stores a `PaginationResult` under `context[action.id]`.

```typescript
{
  id: 'pages',
  action: 'extractPagination',
  options: {
    container:     'nav.pagination',
    linkSelector:  'a[href]',
    labelSelector: 'a[href]',
    currentPage:   3,   // currently on page 3 → nextUrl resolves to page 4
  },
}
```

**Parameters (inside `options`):**
- `container` (string): CSS selector for the pagination wrapper element (required)
- `linkSelector` (string): CSS for anchor elements with hrefs (required)
- `labelSelector` (string): CSS for elements whose text is the page label (required)
- `currentPage` (number): Current page number (default: 1)

**Result stored in context:**
- `context[id]` → `{ pages: Array<{ label: string; url: string }>, nextUrl: string | null }`

**Example:**
```typescript
const result = await actionHelpers.scrapeWithActions(
  'https://example.com/listings?page=3',
  {
    version: '1.0',
    actions: [
      {
        id: 'paging',
        action: 'extractPagination',
        options: {
          container:     'nav.pagination',
          linkSelector:  'a[href]',
          labelSelector: 'a[href]',
          currentPage:   3,
        },
      },
    ],
  },
);
// result.data.paging.pages   → [{ label: '1', url: '...' }, ...]
// result.data.paging.nextUrl → '...?page=4'
```

---

## Cookie Actions

### saveCookies

Save current cookies to a file.

```typescript
{
  action: 'saveCookies',
  value: 'user-session',
  options: {
    overwrite: true,
    metadata: {
      username: 'user@example.com',
    },
  },
}
```

**Parameters:**
- `value` (string): Session name
- `options.overwrite` (boolean): Overwrite if exists (default: false)
- `options.metadata` (object): Additional metadata to store

**Example:**
```typescript
{
  action: 'saveCookies' as const,
  value: 'my-session',
  options: {
    overwrite: true,
    metadata: {
      username: 'user@example.com',
      loginTime: new Date().toISOString(),
    },
  },
}
```

---

### loadCookies

Load cookies from a file.

```typescript
{
  action: 'loadCookies',
  value: 'user-session',
  onError: 'skip',
}
```

**Parameters:**
- `value` (string): Session name to load
- `onError` (ErrorStrategy): Error handling ('continue', 'fail', 'skip')

**Example:**
```typescript
{
  action: 'loadCookies' as const,
  value: 'user-session',
  onError: 'skip' as const,  // Skip if session doesn't exist
}
```

---

### clearCookies

Delete a cookie session.

```typescript
{
  action: 'clearCookies',
  value: 'user-session',
}
```

**Parameters:**
- `value` (string): Session name to delete

**Example:**
```typescript
{
  action: 'clearCookies' as const,
  value: 'old-session',
}
```

---

### listCookies

List all saved cookie sessions.

```typescript
{
  action: 'listCookies',
  id: 'sessions',
}
```

**Parameters:**
- `id` (string): Context key to store session list

**Example:**
```typescript
{
  action: 'listCookies' as const,
  id: 'allSessions',
}
```

---

## ActionTarget

Defines the target element for actions that need one.

```typescript
interface ActionTarget {
  type: 'css' | 'xpath';     // Selector type
  value?: string;              // Selector expression (omit to extract the shadow root itself)
  shadowHost?: string;         // Shadow DOM host element (for Shadow DOM)
}
```

**Examples:**
```typescript
// CSS selector
{ type: 'css' as const, value: '#button' }
{ type: 'css' as const, value: '.card h2' }
{ type: 'css' as const, value: '[data-id="123"]' }

// XPath selector
{ type: 'xpath' as const, value: '//h2[@class="title"]' }
{ type: 'xpath' as const, value: '(//a)[1]' }

// Shadow DOM — inner element
{
  type: 'css' as const,
  value: '.inner-content',
  shadowHost: 'my-web-component',
}

// Shadow DOM — extract the shadow root itself (no inner selector)
{
  type: 'css' as const,
  shadowHost: 'my-web-component',
}
```

## ActionOptions

Options for action execution.

```typescript
interface ActionOptions {
  timeout?: number;              // Action timeout (ms)
  delay?: number;                // Delay between keystrokes (ms)
  scrollTo?: boolean;            // Scroll element into view
  retry?: number;                // Number of retries
  retryDelay?: number;           // Delay between retries (ms)
  waitForNavigation?: boolean;   // Wait for navigation after action
  navigationTimeout?: number;    // Timeout for navigation (ms)
  overwrite?: boolean;           // Overwrite existing file (cookies)
  metadata?: Record<string, unknown>; // Additional metadata (cookies)
  pipes?: PipeConfig[];          // Pipes for cleanse action
  multiple?: boolean;            // Extract all elements (extract action)
  as?: 'text' | 'html' | 'outerHtml' | 'attribute'; // Extract mode (default: 'text')
  attribute?: string;            // Attribute name when as: 'attribute'
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'; // navigate / reload
  // scrapeContainer options
  container?: string;            // CSS/XPath container selector
  fields?: Record<string, FieldDescriptor>; // Field extraction rules
  pagination?: PaginationDescriptor; // Pagination config
  // extractPagination options (also used by scrapeContainer)
  linkSelector?: string;         // CSS for pagination link anchors
  labelSelector?: string;        // CSS for pagination label elements
  currentPage?: number;          // Current page number (default: 1)
}
```

## ActionCondition

Conditional execution of actions.

```typescript
interface ActionCondition {
  ifExists?: ActionTarget;      // Execute only if element exists
  unlessExists?: ActionTarget;   // Execute only if element doesn't exist
}
```

**Examples:**
```typescript
// Execute only if element exists
{
  action: 'click' as const,
  target: { type: 'css' as const, value: '#button' },
  condition: {
    ifExists: { type: 'css' as const, value: '#button' },
  },
}

// Execute only if element doesn't exist
{
  action: 'navigate' as const,
  value: 'https://example.com/login',
  condition: {
    unlessExists: { type: 'css' as const, value: '.user-profile' },
  },
}
```

## Error Strategies

| Strategy | Description |
|----------|-------------|
| `fail` | Stop workflow and throw error (default) |
| `continue` | Log error and continue to next action |
| `skip` | Skip this action if it fails |

**Global Error Configuration:**
```typescript
const workflow = {
  version: '1.0' as const,
  actions: [...],
  onError: {
    screenshot: true,                // Take screenshot on error
    screenshotPath: './error.png',   // Screenshot file path
    continue: false,                 // Stop workflow on error
  },
};
```

**Action-Level Error Handling:**
```typescript
{
  action: 'extract' as const,
  target: { type: 'css' as const, value: '.maybe-missing' },
  onError: 'continue' as const,  // Continue if this action fails
}
```

## Variable Interpolation

Use variables in action values:

```typescript
const variables = {
  baseUrl: 'https://example.com',
  searchQuery: 'TypeScript automation',
};

const workflow = {
  version: '1.0' as const,
  actions: [
    {
      action: 'navigate' as const,
      value: '${baseUrl}/search',  // Interpolated
    },
    {
      action: 'type' as const,
      target: { type: 'css' as const, value: '#search' },
      value: '${searchQuery}',  // Interpolated
    },
  ],
};

await this.actionHelpers.scrapeWithWorkflow(url, workflow, variables);
```

## XPath Selectors

For `extract`, `waitFor`, and click actions, use XPath:

```typescript
{
  action: 'extract' as const,
  target: {
    type: 'xpath' as const,
    value: '//h2[contains(@class, "title")]',
  },
}
```

## Shadow DOM Support

Access elements inside Shadow DOM:

```typescript
// Extract an element inside the shadow root
{
  action: 'extract' as const,
  target: {
    type: 'css' as const,
    value: '.inner-content',
    shadowHost: 'my-web-component',
  },
}

// Extract the entire shadow root HTML (omit value)
{
  action: 'extract' as const,
  id: 'shadowHtml',
  target: {
    type: 'css' as const,
    shadowHost: 'my-web-component',
  },
  options: { as: 'html' },  // returns shadowRoot.innerHTML
}
```

> **Note:** `as: 'outerHtml'` on a shadow root returns `innerHTML` — shadow roots are document fragments and have no outer HTML.

## Complete Workflow Example

```typescript
const workflow = {
  version: '1.0' as const,
  actions: [
    // Load session
    {
      action: 'loadCookies' as const,
      value: 'user-session',
      onError: 'skip' as const,
    },
    // Check if logged in
    {
      action: 'waitFor' as const,
      target: { type: 'css' as const, value: '.user-profile' },
      options: { timeout: 5000 },
      onError: 'skip' as const,
    },
    // Login if not logged in
    {
      action: 'navigate' as const,
      value: 'https://example.com/login',
      condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
    },
    {
      action: 'type' as const,
      target: { type: 'css' as const, value: '#email' },
      value: 'user@example.com',
      condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
    },
    {
      action: 'click' as const,
      target: { type: 'css' as const, value: '#login-button' },
      options: { waitForNavigation: true },
      condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
    },
    // Save session
    {
      action: 'saveCookies' as const,
      value: 'user-session',
      options: { overwrite: true },
      condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
    },
    // Extract data
    {
      id: 'userName',
      action: 'extract' as const,
      target: { type: 'css' as const, value: '.user-profile .name' },
    },
  ],
  onError: {
    screenshot: true,
    screenshotPath: './errors/login-error.png',
    continue: false,
  },
};
```

## See Also

- [Workflow Documentation](../methods/workflow.md) - Detailed workflow guide
- [Cookie Management](../features/cookies.md) - Cookie persistence
- [Pipe System](../features/pipes.md) - Data transformation
