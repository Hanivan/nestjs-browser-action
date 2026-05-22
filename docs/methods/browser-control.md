# Browser & Page Control

Low-level control over browser instances and pages using `BrowserManagerService`, `BrowserPoolService`, and `PageService`.

## Services Overview

### BrowserManagerService

Manage browser instances and connection pooling.

```typescript
import { BrowserManagerService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    private readonly browserManager: BrowserManagerService,
  ) {}
}
```

**Methods:**
- `acquireBrowser(): Promise<Browser>` - Acquire browser from pool
- `releaseBrowser(browser: Browser): Promise<void>` - Return browser to pool
- `getPoolStatus(): PoolStatus` - Get pool statistics

### PageService

Manage page lifecycle and navigation.

```typescript
import { PageService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    private readonly pageService: PageService,
  ) {}
}
```

**Methods:**
- `createPage(): Promise<Page>` - Create new page
- `navigateTo(url, options?): Promise<Page>` - Navigate to URL
- `closePage(): Promise<void>` - Close current page
- `getCurrentPage(): Promise<Page>` - Get current page instance
- `getCurrentBrowser(): Promise<Browser>` - Get current browser instance

## BrowserManagerService

### Get Pool Status

```typescript
const status = this.browserManager.getPoolStatus();

console.log('Available:', status.available);  // Available browsers
console.log('Size:', status.size);            // Total pool size
console.log('Waiting:', status.waiting);        // Requests waiting
```

### Manual Browser Acquisition

```typescript
async manualBrowserControl() {
  // Acquire browser from pool
  const browser = await this.browserManager.acquireBrowser();

  try {
    // Create page
    const page = await browser.newPage();

    // Navigate
    await page.goto('https://example.com');

    // Do custom operations
    const title = await page.title();
    console.log('Page title:', title);

    // Cleanup
    await page.close();
  } finally {
    // Always release browser back to pool
    await this.browserManager.releaseBrowser(browser);
  }
}
```

## PageService

### Create and Navigate

```typescript
async createAndNavigate() {
  // Create new page (auto-acquires browser from pool)
  const page = await this.pageService.createPage();

  // Navigate to URL
  await this.pageService.navigateTo('https://example.com');

  // Do operations with page
  await page.click('#button');
  await page.waitForSelector('.result');

  // Close page (releases browser back to pool)
  await this.pageService.closePage();
}
```

### Navigation Options

```typescript
const page = await this.pageService.navigateTo('https://example.com', {
  waitUntil: 'networkidle0',  // Wait until no network connections
  timeout: 30000,             // 30 second timeout
});
```

### Get Current Page/Browser

```typescript
async getCurrentResources() {
  const page = await this.pageService.getCurrentPage();
  const browser = await this.pageService.getCurrentBrowser();

  console.log('Page URL:', page.url());
  console.log('Browser ID:', browser.wsEndpoint());
}
```

## Decorators

### @InjectBrowser()

Inject a browser instance (auto-acquired from pool, auto-released).

```typescript
import { Injectable } from '@nestjs/common';
import { InjectBrowser } from '@hanivanrizky/nestjs-browser-action';
import { Browser } from 'puppeteer';

@Injectable()
export class MyService {
  constructor(
    @InjectBrowser()
    private readonly browser: Browser,
  ) {}

  async myMethod() {
    const page = await this.browser.newPage();
    await page.goto('https://example.com');
    // Browser auto-released when service destroyed
  }
}
```

### @InjectPage()

Inject a page instance (auto-created and closed).

```typescript
import { Injectable } from '@nestjs/common';
import { InjectPage } from '@hanivanrizky/nestjs-browser-action';
import { Page } from 'puppeteer';

@Injectable()
export class MyService {
  constructor(
    @InjectPage()
    private readonly page: Page,
  ) {}

  async myMethod() {
    await this.page.goto('https://example.com');
    // Page auto-closed when service destroyed
  }
}
```

## Advanced Usage

### Custom Page Management

```typescript
async customWorkflow() {
  // Create page
  const page = await this.pageService.createPage();

  try {
    // Multiple navigations
    await page.goto('https://example.com/page1');
    const title1 = await page.title();

    await page.goto('https://example.com/page2');
    const title2 = await page.title();

    console.log('Titles:', title1, title2);

  } finally {
    // Always close page
    await this.pageService.closePage();
  }
}
```

### Parallel Processing

```typescript
async parallelScraping() {
  const urls = [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3',
  ];

  const results = await Promise.all(
    urls.map(async (url) => {
      const page = await this.pageService.createPage();
      try {
        await page.goto(url);
        return await page.title();
      } finally {
        await this.pageService.closePage();
      }
    })
  );

  console.log('All titles:', results);
}
```

### Retry Logic

```typescript
async withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Retry ${i + 1}/${maxRetries}`);
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const page = await this.pageService.createPage();
const title = await withRetry(
  () => page.goto('https://example.com').then(() => page.title())
);
await this.pageService.closePage();
```

## Pool Configuration

### Configure Pool Size

```typescript
import { Module } from '@nestjs/common';
import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';

@Module({
  imports: [
    BrowserActionModule.forRoot({
      pool: {
        min: 2,   // Minimum 2 browsers always available
        max: 10,  // Maximum 10 browsers in pool
        idleTimeoutMs: 30000,  // Reap idle browsers down to min after 30s (0 disables)
        acquireTimeoutMs: 30000,  // Reject acquire() if none free in time (0 waits forever)
        strategy: 'round-robin',  // or 'least-recently-used'
      },
    }),
  ],
})
export class AppModule {}
```

### Pool Strategies

**Round Robin (Default):**
```typescript
strategy: 'round-robin'
```
- Distributes requests evenly across all browsers
- Good for balancing load

**Least Recently Used:**
```typescript
strategy: 'least-recently-used'
```
- Reuses browser that hasn't been used recently
- Good for minimizing cold starts

## Connection Pooling Benefits

- ✅ **Performance:** Reuse browser instances (faster than launching new ones)
- ✅ **Resource Efficiency:** Limit maximum concurrent browsers
- ✅ **Automatic Management:** Acquire and release automatically
- ✅ **Scalability:** Handle concurrent requests efficiently
- ✅ **Cleanup:** Idle browsers automatically closed

## Error Handling

```typescript
async safeBrowserUsage() {
  const browser = await this.browserManager.acquireBrowser();

  try {
    const page = await browser.newPage();
    await page.goto('https://example.com');
    // ... operations ...
    await page.close();
  } catch (error) {
    console.error('Browser operation failed:', error);
    throw error;
  } finally {
    // Always release browser, even on error
    await this.browserManager.releaseBrowser(browser);
  }
}
```

## Best Practices

1. **Always release browsers:**
   ```typescript
   const browser = await this.browserManager.acquireBrowser();
   try {
     // ... operations ...
   } finally {
     await this.browserManager.releaseBrowser(browser);
   }
   ```

2. **Close pages when done:**
   ```typescript
   const page = await this.pageService.createPage();
   try {
     // ... operations ...
   } finally {
     await this.pageService.closePage();
   }
   ```

3. **Use decorators for simple cases:**
   ```typescript
   constructor(@InjectPage() private readonly page: Page) {}
   ```

4. **Configure pool appropriately:**
   - Set `min` to expected baseline concurrency
   - Set `max` to maximum acceptable resource usage
   - Use `idleTimeoutMs` to free unused resources

## Related Methods

- [`takeScreenshot()`](./screenshots.md) - Screenshot capture
- [`generatePDF()`](./screenshots.md) - PDF generation
- [`scrape()`](./scrape.md) - High-level scraping (handles page lifecycle)

## See Also

- [Workflow System](../features/workflow.md) - Declarative automation
- [Pool Options](../api-reference.md#pool-options) - Configuration reference
