# Workflow-Based Automation

Declarative browser automation using workflows with [`scrapeWithActions()`](#scrapewithactions) and [`scrapeAllWithWorkflow()`](#scrapeallwithworkflow).

## Overview

The workflow system provides a powerful, declarative way to automate complex browser interactions:

- (☆^O^☆) **Declarative:** Describe what to do, not how to do it
- (>_>) **Sequential:** Actions execute in order
- (｡•̀ᴗ-)✧ **Retry Logic:** Built-in retry on failure
- (´｡• ᵕ •｡') **Conditional:** Execute actions based on element existence
- (^_^) **Data Extraction:** Extract and cleanse data seamlessly
- (♡˙︶˙♡) **Cookie Management:** Save/load sessions for persistence
- (・_・) **Type-Safe:** Full TypeScript support with generics

## scrapeWithActions()

Execute a workflow to automate browser interactions and data extraction.

### Signature

```typescript
async scrapeWithActions<T = Record<string, unknown>>(
  url: string,
  workflow: WorkflowDefinition,
  variables?: VariableContext,
): Promise<WorkflowResultTyped<T>>
```

### Parameters

#### `url: string`
Starting URL for the workflow.

#### `workflow: WorkflowDefinition`
Workflow definition with version and actions array.

#### `variables?: VariableContext`
Optional variables for interpolation in the workflow.

### Return Type

```typescript
Promise<WorkflowResultTyped<T>>
// {
//   success: boolean;
//   data: T;
//   errors: string[];
//   screenshots?: string[];
// }
```

## scrapeAllWithWorkflow()

Execute a workflow with multi-element extraction support (alias for `scrapeWithActions` with `options.multiple`).

### Signature

```typescript
async scrapeAllWithWorkflow<T = Record<string, unknown>>(
  url: string,
  workflow: WorkflowDefinition,
  variables?: VariableContext,
): Promise<WorkflowResultTyped<T>>
```

**Note:** This is functionally equivalent to `scrapeWithActions()` - both support single and multi-element extraction via the `options.multiple` flag.

## Workflow Definition

```typescript
interface WorkflowDefinition {
  version: string;                    // Workflow version (e.g., "1.0")
  actions: WorkflowAction[];           // Array of actions to execute
  onError?: WorkflowErrorConfig;      // Global error handling
}

interface WorkflowAction {
  id?: string;                        // Store result in context
  action: ActionType;                 // Action type to execute
  target?: ActionTarget;              // Target selector
  value?: string | number;            // Action value
  options?: ActionOptions;            // Action options
  condition?: ActionCondition;       // Conditional execution
  onError?: ErrorStrategy;            // Action-level error handling
}
```

## Action Types

### Browser Actions

| Action | Description | Example |
|--------|-------------|---------|
| `navigate` | Navigate to URL | `{ action: 'navigate', value: 'https://example.com' }` |
| `wait` | Wait for specified time (ms) | `{ action: 'wait', value: 2000 }` |
| `waitFor` | Wait for element to appear | `{ action: 'waitFor', target: { type: 'css', value: '#button' } }` |
| `click` | Click on element | `{ action: 'click', target: { type: 'css', value: '#submit' } }` |
| `type` | Type text into input | `{ action: 'type', target: { type: 'css', value: '#input' }, value: 'text' }` |
| `select` | Select dropdown option | `{ action: 'select', target: { type: 'css', value: '#country' }, value: 'USA' }` |
| `scroll` | Scroll to element | `{ action: 'scroll', target: { type: 'css', value: '#footer' } }` |

### Data Actions

| Action | Description | Example |
|--------|-------------|---------|
| `extract` | Extract text from element | `{ action: 'extract', target: { type: 'css', value: 'h1' } }` |
| `extract` (multiple) | Extract all matching elements | `{ action: 'extract', target: {...}, options: { multiple: true } }` |
| `evaluate` | Execute JavaScript | `{ action: 'evaluate', value: 'return document.title' }` |
| `cleanse` | Cleanse extracted data with pipes | `{ action: 'cleanse', value: '${raw}', options: { pipes: [...] } }` |
| `screenshot` | Take screenshot | `{ action: 'screenshot', value: './screenshot.png' }` |

### Cookie Actions

| Action | Description | Example |
|--------|-------------|---------|
| `saveCookies` | Save cookies to file | `{ action: 'saveCookies', value: 'session-name' }` |
| `loadCookies` | Load cookies from file | `{ action: 'loadCookies', value: 'session-name' }` |
| `clearCookies` | Delete cookie session | `{ action: 'clearCookies', value: 'session-name' }` |
| `listCookies` | List all cookie sessions | `{ action: 'listCookies', id: 'sessions' }` |

## Examples

### Simple Navigation and Extraction

```typescript
import { ActionHelpersService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    private readonly actionHelpers: ActionHelpersService,
  ) {}

  async scrapeArticle() {
    const workflow = {
      version: '1.0' as const,
      actions: [
        {
          action: 'navigate' as const,
          value: 'https://blog.example.com/article',
        },
        {
          id: 'title',
          action: 'extract' as const,
          target: { type: 'css' as const, value: 'h1.article-title' },
        },
        {
          id: 'content',
          action: 'extract' as const,
          target: { type: 'css' as const, value: '.article-content' },
        },
      ],
    };

    const result = await this.actionHelpers.scrapeWithActions(workflow);

    if (result.success) {
      console.log(result.data.title);    // "Article Title"
      console.log(result.data.content);  // "Article content..."
    }
  }
}
```

### Form Submission with Error Handling

```typescript
async searchWithWorkflow() {
  const workflow = {
    version: '1.0' as const,
    actions: [
      {
        action: 'navigate' as const,
        value: 'https://search.example.com',
      },
      {
        action: 'waitFor' as const,
        target: { type: 'css' as const, value: '#search-input' },
        options: { timeout: 10000 },
      },
      {
        action: 'type' as const,
        target: { type: 'css' as const, value: '#search-input' },
        value: 'NestJS browser automation',
        options: { delay: 50, scrollTo: true },
      },
      {
        action: 'click' as const,
        target: { type: 'css' as const, value: 'button[type="submit"]' },
        options: { scrollTo: true, waitForNavigation: true },
      },
      {
        id: 'firstResult',
        action: 'extract' as const,
        target: { type: 'css' as const, value: '.search-result:first-child h3' },
      },
    ],
    onError: {
      screenshot: true,
      screenshotPath: './error-screenshot.png',
      continue: false,
    },
  };

  const result = await this.actionHelpers.scrapeWithActions<{
    firstResult: string;
  }>('https://search.example.com', workflow);

  console.log(result.data.firstResult);
}
```

### Variable Interpolation

```typescript
async searchDynamic() {
  const workflow = {
    version: '1.0' as const,
    actions: [
      {
        action: 'navigate' as const,
        value: '${baseUrl}',  // Interpolated from variables
      },
      {
        action: 'waitFor' as const,
        target: { type: 'css' as const, value: '#search-input' },
      },
      {
        action: 'type' as const,
        target: { type: 'css' as const, value: '#search-input' },
        value: '${searchQuery}',  // Interpolated
      },
      {
        action: 'click' as const,
        target: { type: 'css' as const, value: '#search-button' },
      },
    ],
  };

  const result = await this.actionHelpers.scrapeWithActions(
    'https://example.com',  // Starting URL
    workflow,
    {
      baseUrl: 'https://search.example.com',
      searchQuery: 'TypeScript automation',
    }
  );
}
```

### Conditional Execution

```typescript
async loginWithConditional() {
  const workflow = {
    version: '1.0' as const,
    actions: [
      {
        action: 'navigate' as const,
        value: 'https://example.com/dashboard',
      },
      {
        // Load existing session
        action: 'loadCookies' as const,
        value: 'user-session',
        onError: 'skip' as const,  // Skip if session doesn't exist
      },
      {
        // Check if already logged in
        action: 'waitFor' as const,
        target: { type: 'css' as const, value: '.user-profile' },
        options: { timeout: 5000 },
        condition: { ifExists: { type: 'css' as const, value: '.user-profile' } },
        onError: 'skip' as const,
      },
      {
        // If not logged in, navigate to login
        action: 'navigate' as const,
        value: 'https://example.com/login',
        condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
      },
      {
        // Perform login
        action: 'type' as const,
        target: { type: 'css' as const, value: '#email' },
        value: 'user@example.com',
        condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
      },
      {
        action: 'type' as const,
        target: { type: 'css' as const, value: '#password' },
        value: 'password123',
        condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
      },
      {
        action: 'click' as const,
        target: { type: 'css' as const, value: '#login-button' },
        condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
      },
      {
        // Save session after login
        action: 'saveCookies' as const,
        value: 'user-session',
        options: { overwrite: true },
        condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
      },
      {
        id: 'userName',
        action: 'extract' as const,
        target: { type: 'css' as const, value: '.user-profile .name' },
      },
    ],
  };

  const result = await this.actionHelpers.scrapeWithActions(workflow);

  if (result.success) {
    console.log('Logged in as:', result.data.userName);
  }
}
```

### Multi-Element Extraction

```typescript
async scrapeAllCards() {
  const workflow = {
    version: '1.0' as const,
    actions: [
      {
        action: 'navigate' as const,
        value: 'https://example.com/products',
      },
      {
        // Extract single element (first card title)
        id: 'firstTitle',
        action: 'extract' as const,
        target: { type: 'css' as const, value: '.card:first-child h2' },
        options: {
          pipes: [
            { type: CleansingType.TRIM },
            { type: CleansingType.TO_UPPER_CASE },
          ],
        },
      },
      {
        // Extract all card titles (multiple elements)
        id: 'allTitles',
        action: 'extract' as const,
        target: { type: 'css' as const, value: '.card h2' },
        options: {
          multiple: true,  // Extract all matching elements
          pipes: [
            { type: CleansingType.TRIM },
            { type: CleansingType.TO_LOWER_CASE },
          ],
        },
      },
      {
        // Count cards
        id: 'cardCount',
        action: 'evaluate' as const,
        value: `() => document.querySelectorAll('.card').length`,
      },
    ],
  };

  const result = await this.actionHelpers.scrapeAllWithWorkflow<{
    firstTitle: string;
    allTitles: string[];
    cardCount: number;
  }>('https://example.com/products', workflow);

  console.log('First title:', result.data.firstTitle);
  console.log('All titles:', result.data.allTitles);
  console.log('Total cards:', result.data.cardCount);
}
```

### Data Cleansing with Pipes

```typescript
async scrapeWithCleanse() {
  const workflow = {
    version: '1.0' as const,
    actions: [
      {
        action: 'navigate' as const,
        value: 'https://example.com/product',
      },
      {
        id: 'rawTitle',
        action: 'extract' as const,
        target: { type: 'css' as const, value: 'h1.product-title' },
      },
      {
        id: 'rawPrice',
        action: 'extract' as const,
        target: { type: 'css' as const, value: '.product-price' },
      },
      {
        // Cleanse title with pipes
        action: 'cleanse' as const,
        id: 'title',
        value: '${rawTitle}',
        options: {
          pipes: [
            { type: CleansingType.TRIM },
            { type: CleansingType.NORMALIZE_WHITESPACE },
            { type: CleansingType.TO_UPPER_CASE },
          ],
        },
      },
      {
        // Cleanse price with pipes
        action: 'cleanse' as const,
        id: 'price',
        value: '${rawPrice}',
        options: {
          pipes: [
            { type: CleansingType.TRIM },
            { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
            { type: CleansingType.TO_NUMBER },
          ],
        },
      },
    ],
  };

  const result = await this.actionHelpers.scrapeWithActions(workflow);

  // Result:
  // {
  //   success: true,
  //   data: {
  //     rawTitle: "  Product Name  ",
  //     rawPrice: "$29.99",
  //     title: "PRODUCT NAME",
  //     price: 29.99
  //   }
  // }
}
```

### XPath Selectors

```typescript
async scrapeWithXPath() {
  const workflow = {
    version: '1.0' as const,
    actions: [
      {
        action: 'navigate' as const,
        value: 'https://example.com',
      },
      {
        id: 'allTitles',
        action: 'extract' as const,
        target: {
          type: 'xpath' as const,
          value: '//h2[contains(@class, "title")]',
        },
        options: { multiple: true },
      },
      {
        id: 'firstLink',
        action: 'extract' as const,
        target: {
          type: 'xpath' as const,
          value: '(//a[@class="link"])[1]',
        },
      },
    ],
  };

  const result = await this.actionHelpers.scrapeWithActions(workflow);
}
```

### Shadow DOM Support

```typescript
async scrapeShadowDOM() {
  const workflow = {
    version: '1.0' as const,
    actions: [
      {
        action: 'navigate' as const,
        value: 'https://example.com/web-component',
      },
      {
        id: 'shadowContent',
        action: 'extract' as const,
        target: {
          type: 'css' as const,
          value: '.shadow-element-content',
          shadowHost: 'my-web-component',  // Shadow DOM host
        },
      },
    ],
  };

  const result = await this.actionHelpers.scrapeWithActions(workflow);
}
```

## Action Options

```typescript
interface ActionOptions {
  timeout?: number;              // Action timeout (ms)
  delay?: number;                // Delay between keystrokes (ms)
  scrollTo?: boolean;            // Scroll element into view
  retry?: number;                // Number of retries
  retryDelay?: number;           // Delay between retries (ms)
  waitForNavigation?: boolean;   // Wait for navigation after action
  navigationTimeout?: number;    // Timeout for navigation wait
  multiple?: boolean;            // Extract all elements (vs first only)
  overwrite?: boolean;           // Overwrite existing file (cookies)
  metadata?: Record<string, unknown>; // Additional metadata (cookies)
  pipes?: PipeConfig[];          // Pipes for cleanse action
}
```

## Error Handling

### Global Error Configuration

```typescript
const workflow = {
  version: '1.0' as const,
  actions: [...],
  onError: {
    screenshot: true,                    // Take screenshot on error
    screenshotPath: './errors.png',      // Screenshot path
    continue: false,                     // Stop on error
  },
};
```

### Action-Level Error Handling

```typescript
const actions = [
  {
    action: 'extract' as const,
    target: { type: 'css' as const, value: '.maybe-missing' },
    onError: 'continue' as const,  // Continue if this action fails
  },
  {
    action: 'extract' as const,
    target: { type: 'css' as const, value: '.also-maybe-missing' },
    onError: 'skip' as const,  // Skip this action on error
  },
];
```

### Error Strategies

| Strategy | Description |
|----------|-------------|
| `continue` | Log error and continue to next action |
| `skip` | Skip this action if it fails |
| `fail` | Stop workflow and throw error (default) |

## Features

- ✅ **Declarative:** Describe workflow in JSON-like structure
- ✅ **Sequential:** Actions execute in order
- ✅ **Variable Interpolation:** Use `${variable}` in values
- ✅ **Conditional Execution:** Execute based on element existence
- ✅ **Retry Logic:** Built-in retry on failure
- ✅ **Multi-Element:** Extract single or all elements
- ✅ **CSS & XPath:** Full selector support
- ✅ **Shadow DOM:** Support for web components
- ✅ **Data Cleansing:** Integrate pipe transformations
- ✅ **Cookie Management:** Save/load sessions
- ✅ **Error Handling:** Screenshot on error
- ✅ **Type-Safe:** Full TypeScript generics

## Related Methods

- [`scrape()`](./scrape.md) - Simple single-element scraping
- [`scrapeAll()`](./scrape-all.md) - Multi-element scraping
- [Cookie Service](../features/cookies.md) - Cookie persistence

## See Also

- [Workflow Actions Reference](../workflow-actions.md)
- [Pipe Documentation](../features/pipes.md)
- [XPath Guide](../features/xpath.md)
