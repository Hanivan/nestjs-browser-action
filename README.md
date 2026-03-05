# @hanivanrizky/nestjs-browser-action

[![npm version](https://badge.fury.io/js/%40hanivanrizky%2Fnestjs-browser-action.svg)](https://www.npmjs.com/package/@hanivanrizky/nestjs-browser-action)
[![License: MIT](https://img.shandler.com/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A NestJS module that provides Puppeteer-based browser automation with configurable options and connection pooling.

## Installation

### From npm (Recommended)

```bash
npm install @hanivanrizky/nestjs-browser-action puppeteer
# or
yarn add @hanivanrizky/nestjs-browser-action puppeteer
```

### From GitHub Repository

If you want to install directly from GitHub without publishing to npm:

```bash
# Install from main branch
npm install git+https://github.com/hanivanrizky/nestjs-browser-action.git puppeteer
# or
yarn add git+https://github.com/hanivanrizky/nestjs-browser-action.git puppeteer

# Install from specific release tag
npm install git+https://github.com/hanivanrizky/nestjs-browser-action.git#v1.0.0 puppeteer

# Install from specific branch
npm install git+https://github.com/hanivanrizky/nestjs-browser-action.git#develop puppeteer

# Install from specific commit
npm install git+https://github.com/hanivanrizky/nestjs-browser-action.git#a1b2c3d puppeteer

# Install using SSH (requires SSH key setup)
npm install git+ssh://git@github.com:hanivanrizky/nestjs-browser-action.git puppeteer
```

**Note:** When installing from GitHub, the package will be installed as `nestjs-browser-action` instead of `@hanivanrizky/nestjs-browser-action`. Adjust your imports accordingly:

```typescript
import { BrowserActionModule } from 'nestjs-browser-action';
```

## Quick Start

### Synchronous Configuration

```typescript
import { Module } from '@nestjs/common';
import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';

@Module({
  imports: [
    BrowserActionModule.forRoot({
      launchOptions: { headless: true },
      contextOptions: { viewport: { width: 1920, height: 1080 } },
      pool: { min: 2, max: 10 },
    }),
  ],
})
export class AppModule {}
```

### Asynchronous Configuration

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';

@Module({
  imports: [
    BrowserActionModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        launchOptions: {
          headless: config.get('HEADLESS'),
          args: config.get('PUPPETEER_ARGS'),
        },
        pool: {
          min: config.get('POOL_MIN'),
          max: config.get('POOL_MAX'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Usage

### Injecting Services

```typescript
import { Injectable } from '@nestjs/common';
import { BrowserManagerService, PageService, ActionHelpersService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    private readonly browserManager: BrowserManagerService,
    private readonly pageService: PageService,
    private readonly actionHelpers: ActionHelpersService,
  ) {}

  async myMethod() {
    const status = this.browserManager.getPoolStatus();
    console.log(`Pool: ${status.available}/${status.size} available`);
  }
}
```

### Taking Screenshots

```typescript
await this.actionHelpers.takeScreenshot(
  'https://example.com',
  './screenshot.png',
  { fullPage: true }
);
```

### Generating PDFs

```typescript
const pdf = await this.actionHelpers.generatePDF(
  'https://example.com',
  './page.pdf',
  { format: 'A4' }
);
```

### Web Scraping

```typescript
const data = await this.actionHelpers.scrape('https://example.com', {
  title: 'h1',
  description: 'meta[name="description"]@content',
  links: 'a@href',
});
```

### Custom Browser Control

```typescript
// Create page and navigate
const page = await this.pageService.createPage();
await this.pageService.navigateTo('https://example.com');

// Do custom operations
await page.click('#button');
await page.waitForSelector('.result');

// Cleanup
await this.pageService.closePage();
```

## Configuration

### BrowserActionOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| launchOptions | LaunchOptions | { headless: true } | Puppeteer launch options |
| contextOptions | BrowserContextOptions | { viewport: { width: 1920, height: 1080 } } | Browser context options |
| pool.min | number | 2 | Minimum pool size |
| pool.max | number | 10 | Maximum pool size |
| pool.idleTimeoutMs | number | 30000 | Idle timeout in milliseconds |
| pool.strategy | 'round-robin' \| 'least-recently-used' | 'round-robin' | Pool selection strategy |
| multiContext | boolean | false | Enable multi-context support |

## API

### Services

#### BrowserManagerService
- `getBrowser()`: Acquire a browser from the pool
- `releaseBrowser(browser)`: Release a browser back to the pool
- `getPoolStatus()`: Get current pool statistics

#### PageService
- `createPage()`: Create a new page
- `navigateTo(url, options?)`: Navigate to URL
- `closePage()`: Close current page
- `getCurrentPage()`: Get current page instance
- `getCurrentBrowser()`: Get current browser instance

#### ActionHelpersService
- `takeScreenshot(url, path, options?)`: Take screenshot of URL
- `generatePDF(url, path, options?)`: Generate PDF of URL
- `scrape(url, selectors)`: Scrape data from URL
- `waitForSelector(url, selector, timeout?)`: Wait for selector
- `evaluate(url, script)`: Execute JavaScript in page

## Type Safety

This module provides full TypeScript support with proper type inference:

### scrape() Type Inference

```typescript
const data = await actionHelpers.scrape(url, {
  title: 'h1',
  author: '.author',
});
// Type: { title?: string; author?: string }
```

### evaluate() Generic Type

```typescript
// Returns Promise<unknown>
const result = await actionHelpers.evaluate(url, 'return 1 + 1');

// Returns Promise<number>
const num = await actionHelpers.evaluate<number>(url, 'return 42');
```

### Options Autocomplete

```typescript
await actionHelpers.takeScreenshot(url, 'file.png', {
  fullPage: true,     // Full autocomplete
  type: 'png',        // Type-safe options
  quality: 90,
});
```

## Development

### Git Hooks

This project uses Husky for Git hooks:

- **Pre-commit**: Runs ESLint to check code quality
- **Pre-push**:
  - Builds the project (must pass)
  - Runs unit tests (can be skipped)

### Skipping Tests

To skip tests when pushing:

```bash
SKIP_TESTS=true git push
```

### Running Scripts

```bash
# Build
yarn build

# Run tests
yarn test

# Lint code
yarn lint

# Format code
yarn format
```

## License

MIT

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/yourusername/nestjs-browser-action/issues).
