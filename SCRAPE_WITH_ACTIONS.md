# scrapeWithActions - Workflow-Based Browser Automation

The `scrapeWithActions` method provides a powerful, declarative way to automate browser interactions using workflow definitions. This system supports complex scraping scenarios with variable interpolation, conditional execution, and robust error handling.

## Quick Start

```typescript
import { ActionHelpersService } from '@hanivanrizky/nestjs-browser-action';
import type { WorkflowDefinition } from '@hanivanrizky/nestjs-browser-action';

// Define your workflow
const workflow: WorkflowDefinition = {
  version: '1.0',
  actions: [
    {
      action: 'navigate',
      value: 'https://example.com',
    },
    {
      action: 'wait',
      value: 2, // Wait 2 seconds
    },
    {
      id: 'title',
      action: 'extract',
      target: { type: 'css', value: 'h1' },
    },
  ],
};

// Execute the workflow
const result = await actionHelpers.scrapeWithActions<{
  title: string;
}>('https://example.com', workflow);

console.log(result.data.title); // "Example Domain"
```

## Supported Action Types

### 1. **navigate** - Navigate to a URL
```typescript
{
  action: 'navigate',
  value: 'https://example.com', // or use variables: '${baseUrl}'
}
```

### 2. **wait** - Wait for a specified time
```typescript
{
  action: 'wait',
  value: 3, // Wait 3 seconds
}
```

### 3. **waitFor** - Wait for an element to appear
```typescript
{
  action: 'waitFor',
  target: { type: 'css', value: '.my-element' },
  options: { timeout: 10000 } // Optional: timeout in milliseconds
}
```

### 4. **click** - Click on an element
```typescript
{
  action: 'click',
  target: { type: 'css', value: 'button.submit' },
  options: {
    scrollTo: true, // Scroll element into view first
    waitForNavigation: true, // Wait for navigation after click
    navigationTimeout: 30000 // Timeout for navigation
  }
}
```

### 5. **type** - Type text into an input field
```typescript
{
  action: 'type',
  target: { type: 'css', value: 'input[name="search"]' },
  value: '${searchQuery}', // Use variables for dynamic values
  options: {
    delay: 50, // Delay between keystrokes (ms)
    scrollTo: true
  }
}
```

### 6. **select** - Select an option from a dropdown
```typescript
{
  action: 'select',
  target: { type: 'css', value: 'select[name="country"]' },
  value: 'US', // The value to select
  options: { scrollTo: true }
}
```

### 7. **scroll** - Scroll to an element
```typescript
{
  action: 'scroll',
  target: { type: 'css', value: '.content' }
}
```

### 8. **extract** - Extract data from an element
```typescript
{
  id: 'myData', // Store result in this key
  action: 'extract',
  target: { type: 'css', value: '.data' }
}
```

### 9. **screenshot** - Take a screenshot
```typescript
{
  action: 'screenshot',
  value: './screenshot.png' // Path to save screenshot
}
```

### 10. **evaluate** - Execute JavaScript
```typescript
{
  id: 'pageHeight', // Store result in this key
  action: 'evaluate',
  value: '() => document.body.scrollHeight'
}
```

## Advanced Features

### Variable Interpolation

Use variables in your workflow values with `${variableName}` syntax:

```typescript
const workflow: WorkflowDefinition = {
  version: '1.0',
  actions: [
    {
      action: 'navigate',
      value: '${baseUrl}/search', // baseUrl from variables
    },
    {
      action: 'type',
      target: { type: 'css', value: 'input[name="q"]' },
      value: '${searchQuery}', // searchQuery from variables
    },
  ],
};

const result = await actionHelpers.scrapeWithActions(
  'https://google.com',
  workflow,
  {
    baseUrl: 'https://google.com',
    searchQuery: 'NestJS automation',
  }
);
```

### Nested Variables

Access nested object properties and array elements:

```typescript
const result = await actionHelpers.scrapeWithActions(
  'https://example.com',
  workflow,
  {
    user: {
      name: 'John',
      email: 'john@example.com',
    },
    items: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
  }
);

// In workflow actions:
// ${user.name} → "John"
// ${items[0].name} → "Item 1"
// ${items[1].id} → 2
```

### Conditional Execution

Execute actions based on element existence:

```typescript
{
  action: 'click',
  target: { type: 'css', value: '#accept-cookies' },
  condition: {
    ifExists: { type: 'css', value: '#accept-cookies' }
  },
  onError: 'continue' // Don't fail if element doesn't exist
}
```

### XPath Selectors

Use XPath selectors alongside CSS selectors:

```typescript
{
  id: 'price',
  action: 'extract',
  target: { type: 'xpath', value: '//span[@class="price"]' }
}
```

### Shadow DOM Support

Access elements inside Shadow DOM:

```typescript
{
  action: 'click',
  target: {
    type: 'css',
    value: 'button#action',
    shadowHost: 'my-web-component' // Shadow root host
  }
}
```

### Error Handling

Configure error handling at workflow level:

```typescript
const workflow: WorkflowDefinition = {
  version: '1.0',
  actions: [/* ... */],
  onError: {
    screenshot: true, // Take screenshot on error
    screenshotPath: './error.png', // Custom screenshot path
    continue: false // Stop workflow on error
  }
};
```

### Per-Action Error Handling

Configure error handling for individual actions:

```typescript
{
  action: 'click',
  target: { type: 'css', value: '.maybe-exists' },
  onError: 'continue' // Continue even if this action fails
}
```

Error strategies:
- `'continue'` - Continue to next action
- `'fail'` - Stop workflow and fail (default)
- `'skip'` - Skip this action and continue

### Retry Logic

Add retry logic to actions:

```typescript
{
  action: 'waitFor',
  target: { type: 'css', value: '.dynamic-content' },
  options: {
    timeout: 10000,
    retry: 3, // Retry 3 times on failure
    retryDelay: 2000 // Wait 2 seconds between retries
  }
}
```

## Result Structure

The `scrapeWithActions` method returns a `WorkflowResult` object:

```typescript
interface WorkflowResult {
  success: boolean; // Whether workflow completed successfully
  data: T; // Extracted data with typed results
  errors: string[]; // Array of error messages
  screenshots?: string[]; // Paths to screenshots taken during errors
}
```

## Usage Examples

### Example 1: Form Submission

```typescript
const workflow: WorkflowDefinition = {
  version: '1.0',
  actions: [
    {
      action: 'navigate',
      value: '${baseUrl}',
    },
    {
      action: 'waitFor',
      target: { type: 'css', value: 'form' },
    },
    {
      action: 'type',
      target: { type: 'css', value: 'input[name="email"]' },
      value: '${email}',
      options: { delay: 50 },
    },
    {
      action: 'type',
      target: { type: 'css', value: 'input[name="password"]' },
      value: '${password}',
      options: { delay: 50 },
    },
    {
      action: 'click',
      target: { type: 'css', value: 'button[type="submit"]' },
      options: { waitForNavigation: true },
    },
    {
      action: 'waitFor',
      target: { type: 'css', value: '.dashboard' },
    },
  ],
};

const result = await actionHelpers.scrapeWithActions(
  'https://example.com/login',
  workflow,
  {
    baseUrl: 'https://example.com/login',
    email: 'user@example.com',
    password: 'secret123',
  }
);
```

### Example 2: E-commerce Price Scraping

```typescript
const workflow: WorkflowDefinition = {
  version: '1.0',
  actions: [
    {
      action: 'navigate',
      value: '${productUrl}',
    },
    {
      action: 'waitFor',
      target: { type: 'css', value: '.product-info' },
      options: { timeout: 15000 },
    },
    {
      id: 'productName',
      action: 'extract',
      target: { type: 'css', value: 'h1.product-title' },
    },
    {
      id: 'price',
      action: 'extract',
      target: { type: 'css', value: '.price-current' },
    },
    {
      id: 'availability',
      action: 'extract',
      target: { type: 'css', value: '.stock-status' },
    },
    {
      action: 'screenshot',
      value: './product.png',
    },
  ],
  onError: {
    screenshot: true,
    screenshotPath: './error.png',
  },
};

const result = await actionHelpers.scrapeWithActions<{
  productName: string;
  price: string;
  availability: string;
}>('https://shop.example.com', workflow, {
  productUrl: 'https://shop.example.com/products/123',
});
```

### Example 3: Multi-Step Data Extraction

```typescript
const workflow: WorkflowDefinition = {
  version: '1.0',
  actions: [
    {
      action: 'navigate',
      value: '${baseUrl}',
    },
    {
      action: 'waitFor',
      target: { type: 'css', value: '.search-box' },
    },
    {
      action: 'type',
      target: { type: 'css', value: '.search-box input' },
      value: '${query}',
    },
    {
      action: 'click',
      target: { type: 'css', value: '.search-button' },
    },
    {
      action: 'waitFor',
      target: { type: 'css', value: '.search-results' },
      options: { timeout: 30000 },
    },
    {
      id: 'resultCount',
      action: 'evaluate',
      value: '() => document.querySelectorAll(".search-result").length',
    },
    {
      id: 'firstResult',
      action: 'extract',
      target: { type: 'css', value: '.search-result:first-child h3' },
    },
  ],
};

const result = await actionHelpers.scrapeWithActions<{
  resultCount: number;
  firstResult: string;
}>('https://example.com', workflow, {
  baseUrl: 'https://example.com/search',
  query: 'browser automation',
});
```

## Best Practices

1. **Use explicit waits**: Always use `waitFor` for dynamic content
2. **Set reasonable timeouts**: Don't wait indefinitely for elements
3. **Handle errors gracefully**: Use `onError: 'continue'` for optional elements
4. **Take screenshots for debugging**: Enable screenshots during development
5. **Use variables**: Keep workflows reusable with variable interpolation
6. **Add delays between actions**: Use `wait` or `delay` options for human-like behavior
7. **Handle dynamic content**: Use retry logic for flaky network conditions

## Type Safety

The method is fully typed. Define your expected result structure:

```typescript
interface SearchResult {
  title: string;
  price: string;
  rating: number;
}

const result = await actionHelpers.scrapeWithActions<SearchResult>(
  url,
  workflow
);

// TypeScript knows the shape of result.data
result.data.title; // string
result.data.price; // string
result.data.rating; // number
```

## Performance Considerations

- Reuse workflow definitions for multiple scraping tasks
- Use appropriate timeouts to avoid unnecessary waiting
- Enable logging with `logLevel` to debug performance issues
- Consider using `pool` options for concurrent scraping

## Troubleshooting

### Workflow fails silently
- Enable debug logging: `logLevel: 'debug'` in module options
- Add screenshot on error: `onError: { screenshot: true }`

### Element not found errors
- Use `waitFor` before interacting with elements
- Increase timeout values
- Check element selectors in browser DevTools

### Extraction returns empty strings
- Verify CSS/XPath selectors are correct
- Ensure element exists before extraction
- Use `waitFor` to ensure content is loaded

### Navigation timing issues
- Use `waitForNavigation: true` after clicks
- Add explicit waits after navigation
- Increase navigation timeout

## Complete Interface Reference

See `src/interfaces/workflow-options.ts` for complete interface definitions.

## More Examples

Check `examples/workflow-example.ts` for comprehensive usage examples including:
- Simple data extraction
- Form automation
- Conditional workflows
- XPath selectors
- JavaScript evaluation
- Dropdown selection
- Shadow DOM support
- Error handling with retry
- Real-world e-commerce scraping
