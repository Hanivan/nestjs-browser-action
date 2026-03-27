# Workflow Actions Reference

Complete reference of all workflow action types and their configurations.

## Action Types

| Action | Description | Category |
|--------|-------------|----------|
| `navigate` | Navigate to URL | Browser |
| `wait` | Wait for specified time (seconds) | Browser |
| `waitFor` | Wait for element to appear | Browser |
| `click` | Click on element | Interaction |
| `type` | Type text into input | Interaction |
| `select` | Select dropdown option | Interaction |
| `scroll` | Scroll element into view | Interaction |
| `extract` | Extract text from element | Data |
| `screenshot` | Take screenshot | Data |
| `evaluate` | Execute JavaScript | Data |
| `cleanse` | Cleanse extracted data with pipes | Data |
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

**Example:**
```typescript
{
  action: 'navigate' as const,
  value: '${baseUrl}/products',  // Can use variables
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

## Data Actions

### extract

Extract text content from element(s).

```typescript
// Single element
{
  action: 'extract',
  target: { type: 'css', value: 'h1' },
  id: 'title',
}

// All elements
{
  action: 'extract',
  target: { type: 'css', value: '.card h2' },
  id: 'allTitles',
  options: { multiple: true },
}

// With pipes
{
  action: 'extract',
  target: { type: 'css', value: '.price' },
  id: 'price',
  options: {
    multiple: false,
    pipes: [
      { type: 'to-number' },
    ],
  },
}
```

**Parameters:**
- `target` (ActionTarget): Element selector
- `id` (string): Context key to store result
- `options.multiple` (boolean): Extract all matching elements (default: false, first only)
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

**Example:**
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
      value: '${rawTitle}',  // Variable reference
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
  value: string;               // Selector expression
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

// Shadow DOM
{
  type: 'css' as const,
  value: '.inner-content',
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

await this.actionHelpers.scrapeWithActions(url, workflow, variables);
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
{
  action: 'extract' as const,
  target: {
    type: 'css' as const,
    value: '.inner-content',
    shadowHost: 'my-web-component',
  },
}
```

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
