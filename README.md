# @hanivanrizky/nestjs-browser-action

[![npm version](https://badge.fury.io/js/%40hanivanrizky%2Fnestjs-browser-action.svg)](https://www.npmjs.com/package/@hanivanrizky/nestjs-browser-action)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **⚠️ Status: Experimental**
>
> This project is currently in **experimental** stage and intended for **personal use only**. The API is subject to change, and production use is not recommended.

A NestJS module that provides stealth browser automation (CloakBrowser + puppeteer-core) with configurable options, connection pooling, and data cleansing capabilities.

## Features

- (・_・) **Browser Automation**: Declarative workflow-based browser automation
- (☆^O^☆) **Data Scraping**: Single and multi-element scraping with CSS/XPath selectors
- (>_>) **Connection Pooling**: Efficient browser instance management
- (♡˙︶˙♡) **Cookie Persistence**: Save/load browser sessions for authentication
- (｡•̀ᴗ-)✧ **Data Cleansing**: 14 built-in transformation pipes
- (°_°)! **Shadow DOM**: Support for web components
- (^_^) **Type-Safe**: Full TypeScript support with generics
- (^^) **Remote Chrome**: Connect to remote Chrome instances via CDP (browserURL/browserWSEndpoint)
- (•̀ᴗ•́) **Stealth**: Local launches use CloakBrowser stealth Chromium (proxy, humanize, geoip, timezone/locale spoofing)

## Installation

### From npm

```bash
npm install @hanivanrizky/nestjs-browser-action
# or
yarn add @hanivanrizky/nestjs-browser-action
# or
pnpm add @hanivanrizky/nestjs-browser-action
```

### From GitHub

```bash
npm install https://github.com/Hanivan/nestjs-browser-action.git
# or
pnpm add https://github.com/Hanivan/nestjs-browser-action.git
# or using SSH
pnpm add git@github.com:Hanivan/nestjs-browser-action.git
```

## Quick Start

### 1. Configure Module

```typescript
import { Module } from '@nestjs/common';
import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';

@Module({
  imports: [
    BrowserActionModule.forRoot({
      pool: { min: 2, max: 10 },
      cookies: { enabled: true },
    }),
  ],
})
export class AppModule {}
```

### 2. Inject Service

```typescript
import { Injectable } from '@nestjs/common';
import { ActionHelpersService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    private readonly actionHelpers: ActionHelpersService,
  ) {}

  async scrapeData() {
    const result = await this.actionHelpers.scrape(
      'https://example.com',
      {
        title: 'h1',
        description: 'meta[name="description"]@content',
      }
    );

    console.log(result.title);       // "Example Domain"
    console.log(result.description); // "This domain is for use in..."
  }
}
```

## Documentation

### (^_^) Method Documentation

| Method | Description |
|--------|-------------|
| [`scrape()`](./docs/methods/scrape.md) | Extract single elements |
| [`scrapeAll()`](./docs/methods/scrape-all.md) | Extract multiple elements |
| [`scrapeWithActions()`](./docs/methods/workflow.md) | Workflow-based automation |
| [`scrapeAllWithWorkflow()`](./docs/methods/workflow.md) | Workflow with multi-element |
| [`takeScreenshot()`](./docs/methods/screenshots.md) | Capture screenshots |
| [`generatePDF()`](./docs/methods/screenshots.md) | Generate PDFs |
| [Browser & Page Control](./docs/methods/browser-control.md) | Low-level control |

### (☆^O^☆) Feature Guides

| Feature | Description |
|---------|-------------|
| [Cookie Management](./docs/features/cookies.md) | Session persistence |
| [Pipe System](./docs/features/pipes.md) | Data transformation |
| [Workflow Actions](./docs/workflow-actions.md) | All action types reference |

### (^_^) API Reference

- [API Reference](./docs/api-reference.md) - Complete API documentation
- [Configuration](./docs/api-reference.md#configuration) - All options
- [Types](./docs/api-reference.md#types) - TypeScript interfaces

## Quick Examples

### Simple Scraping

```typescript
const data = await this.actionHelpers.scrape('https://example.com', {
  title: 'h1',
  price: '.price',
});
```

### Multi-Element Scraping

```typescript
const data = await this.actionHelpers.scrapeAll('https://example.com', {
  titles: '.card h2',
  links: '.card a',
});
```

### Workflow Automation

```typescript
const workflow = {
  version: '1.0' as const,
  actions: [
    { action: 'navigate' as const, value: 'https://example.com' },
    { id: 'title', action: 'extract' as const, target: { type: 'css' as const, value: 'h1' } },
    { action: 'click' as const, target: { type: 'css' as const, value: '#button' } },
  ],
};

const result = await this.actionHelpers.scrapeWithActions(workflow);
```

### With Data Cleansing

```typescript
import { CleansingType } from '@hanivanrizky/nestjs-browser-action';

const data = await this.actionHelpers.scrape('https://example.com', {
  price: '.price',
}, {
  pipes: {
    price: [
      { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
      { type: CleansingType.TO_NUMBER },
    ],
  },
});
```

### Cookie Persistence

```typescript
const workflow = {
  version: '1.0' as const,
  actions: [
    { action: 'loadCookies' as const, value: 'user-session', onError: 'skip' as const },
    { action: 'navigate' as const, value: 'https://example.com/dashboard' },
    { action: 'saveCookies' as const, value: 'user-session', options: { overwrite: true } },
  ],
};
```

### Stealth (CloakBrowser)

Local browsers launch through CloakBrowser stealth Chromium. Configure anti-detect
features via the `cloak` option:

```typescript
BrowserActionModule.forRoot({
  cloak: {
    proxy: { server: 'http://host:port', username: 'user', password: 'pass' },
    humanize: true,                 // human-like mouse/typing
    geoip: true,                    // spoof geolocation from proxy IP
    timezone: 'America/New_York',   // spoof timezone
    locale: 'en-US',                // spoof locale
    stealthArgs: true,              // anti-detect Chromium flags
    extensionPaths: ['/path/ext'],  // load unpacked extensions
    userDataDir: './profile',       // persistent profile (launchPersistentContext)
    launchOptions: { headless: true, args: ['--no-sandbox'] }, // raw puppeteer-core passthrough
  },
  pool: { min: 2, max: 5 },
})
```

`launchOptions` (top-level) is also forwarded to CloakBrowser's `launchOptions`
passthrough for backward compatibility. `cloak` is ignored when `remote` is set
(remote uses plain CDP connect).

**Per-call cloak override (proxy/UA rotation):** pass `cloak` per request to launch a
dedicated off-pool browser with its own stealth config — useful for rotating proxies or
fingerprints across requests. Not supported in remote CDP mode.

```typescript
// scrape / scrapeAll
await actions.scrape(url, { title: 'h1' }, {
  cloak: { proxy: { server: 'http://rotating-proxy:8080' } },
});

// workflow
await actions.scrapeWithActions(url, {
  version: '1.0',
  cloak: { proxy: { server: 'http://rotating-proxy:8080' } },
  actions: [...],
});
```

### Remote Chrome Connection

Connect to remote Chrome instances via Chrome DevTools Protocol (CDP):

```typescript
BrowserActionModule.forRoot({
  remote: {
    browserURL: 'http://localhost:9222',  // Or use browserWSEndpoint
    retryMax: 3,                          // Connection retry attempts
    retryDelay: 1000,                     // Delay between retries (ms)
  },
  pool: { min: 2, max: 5 },
})
```

**Using browserWSEndpoint:**

```typescript
BrowserActionModule.forRoot({
  remote: {
    browserWSEndpoint: 'ws://localhost:9222/devtools/page/abc123',
  },
})
```

**Remote-first priority:** When both `remote` and `launchOptions` are provided, remote connection takes precedence.

**See:** [Remote Chrome Configuration](./docs/api-reference.md#remote-chrome-configuration) for details.

## Services

| Service | Description |
|---------|-------------|
| **ActionHelpersService** | High-level automation methods (scrape, screenshot, PDF, workflows) |
| **BrowserManagerService** | Browser pool management |
| **PageService** | Page lifecycle and navigation |
| **CookieService** | Cookie persistence |
| **CleansingService** | Data cleansing with pipes |

## Configuration

### Basic Configuration

```typescript
BrowserActionModule.forRoot({
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMs: 30000,    // reap idle browsers down to min (0 disables)
    acquireTimeoutMs: 30000, // reject acquire() if none free in time (0 waits forever)
    strategy: 'round-robin',
  },
  cookies: {
    enabled: true,
    cookiesDir: './cookies',
  },
  logLevel: 'log',
})
```

### All Options

See [Configuration Reference](./docs/api-reference.md#configuration) for complete options.

## Type Safety

Full TypeScript support with generics:

```typescript
// Type-safe selectors
interface ProductSelectors {
  title: string;
  price: number;
}

const result = await this.actionHelpers.scrape<ProductSelectors>(url, {
  title: 'h1',
  price: '.price',
});

// Type-safe workflow results
const workflow = await this.actionHelpers.scrapeWithActions<{
  title: string;
  price: number;
}>(url, workflow);
```

## Development

### Scripts

```bash
# Build
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

### Git Hooks

- **Pre-commit**: Runs ESLint
- **Pre-push**: Runs build and tests

## License

MIT

## Support

For issues and questions, please use [GitHub Issues](https://github.com/Hanivan/nestjs-browser-action/issues).

## Examples

Check out the test project for complete examples: [test-browser-action](https://github.com/Hanivan/test-browser-action)

---

**Documentation:**
- [Methods](./docs/methods) - Method-specific guides
- [Features](./docs/features) - Feature guides
- [API Reference](./docs/api-reference.md) - Complete API
- [Workflow Actions](./docs/workflow-actions.md) - Action reference
