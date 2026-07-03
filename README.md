# @hanivanrizky/nestjs-browser-action

<p align="center">
  <a href="http://nestjs.com/" target="_blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">A NestJS module for stealth browser automation using CloakBrowser + puppeteer-core with support for proxy rotation, connection pooling, cookie persistence, and flexible data extraction.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@hanivanrizky/nestjs-browser-action" target="_blank"><img src="https://img.shields.io/npm/v/@hanivanrizky/nestjs-browser-action.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/@hanivanrizky/nestjs-browser-action" target="_blank"><img src="https://img.shields.io/npm/l/@hanivanrizky/nestjs-browser-action.svg" alt="Package License" /></a>
  <a href="https://www.npmjs.com/package/@hanivanrizky/nestjs-browser-action" target="_blank"><img src="https://img.shields.io/npm/dm/@hanivanrizky/nestjs-browser-action.svg" alt="NPM Downloads" /></a>
  <img src="https://img.shields.io/badge/tests-481%20passed-brightgreen.svg" alt="Tests: 481 passed" />
</p>

> **⚠️ Status: Experimental** — personal use only; API subject to change.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Quick Examples](#quick-examples)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- **(☆^O^☆) Pattern-Based Extraction**: Define extraction patterns with `PatternField` — API-compatible with `nestjs-xpath-parser`
- **(.\_.) Container Extraction**: Extract lists of items from repeating DOM nodes with pagination
- **(>\_<) Workflow Automation**: Declarative step-by-step browser automation (navigate, click, fill, extract, screenshot…)
- **(・\_・) Data Cleaning Pipes**: 33 built-in transformations (trim, case, replace, decode HTML, number, regex, jsonpath, clean-html…)
- **(☆^O^☆) Custom Pipes**: Extensible pipe registry — `PIPE_REGISTRY['my-type'] = MyPipe`
- **(>\_<) Connection Pooling**: Efficient browser instance reuse with configurable min/max/idle/acquire timeouts
- **(.\_.) Cookie Persistence**: Save/load browser sessions for authentication flows
- **(o_o) Stealth**: CloakBrowser Chromium with proxy, humanize, geoip, timezone/locale spoofing, and anti-detect flags
- **(.\_.) Remote Chrome**: Connect to remote Chrome instances via CDP (browserURL / browserWSEndpoint)
- **(>\_<) TLS Fingerprint**: Capture the browser's own TLS/HTTP handshake (ja3/ja4, ciphers, http2 akamai, headers) for use with `nestjs-xpath-parser`'s CycleTLS engine
- **(☆^O^☆) TypeScript Generics**: Full generic type support for type-safe results
- **(o_o) Fully Tested**: 463 tests across 51 suites
- **(☆^O^☆) Named Browsers & Pages (v0.22+)**: persistent named browser/page pairs with `PageController` — cookies/state carry over across calls, no open/close per scrape

## Installation

```bash
pnpm add @hanivanrizky/nestjs-browser-action
# or
yarn add @hanivanrizky/nestjs-browser-action
# or
npm install @hanivanrizky/nestjs-browser-action
```

## Quick Start

Two ways to use this library — pick whichever fits your workload. Both are
fully supported; neither is deprecated.

- **[Named Browser + Pages](#option-a-named-browser--pages)** — persistent
  browser/page pairs. Cookies, localStorage, and navigation state carry over
  between calls. Best for login sessions and authenticated crawls.
- **[Browser Pool](#option-b-browser-pool)** — a pool of browsers, each
  `scrape()` call opens and closes a fresh page. Best for one-shot,
  stateless scraping.

### Option A: Named Browser + Pages

```typescript
import { Module } from '@nestjs/common';
import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';

@Module({
  imports: [
    BrowserActionModule.forRoot({ name: 'stealth', cloak: { headless: true } }),
    BrowserActionModule.forFeature(['products'], 'stealth'),
  ],
})
export class AppModule {}
```

```typescript
import { Injectable } from '@nestjs/common';
import {
  InjectPageController,
  PageController,
} from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class YourService {
  constructor(
    @InjectPageController('products', 'stealth')
    private readonly products: PageController,
  ) {}

  async scrapeProducts() {
    const result = await this.products.evaluateWebsite({
      url: 'https://www.scrapingcourse.com/ecommerce/',
      patterns: [
        {
          key: 'container',
          patternType: 'css',
          returnType: 'text',
          patterns: ['.product'],
          meta: { isContainer: true },
        },
        {
          key: 'name',
          patternType: 'css',
          returnType: 'text',
          patterns: ['h2.woocommerce-loop-product__title'],
          pipes: { trim: true },
        },
      ],
    });

    return result.results;
  }
}
```

Async config, cookies, and the `maxPages` page-count guard are covered in
[Named Browsers & Pages](docs/features/named-browsers.md), along with
decorators, auto-recreate semantics, and a pool ↔ controller migration table.

### Option B: Browser Pool

A pool of browsers; each `scrape()`/`scrapeAll()`/`evaluateWebsite()` call
opens a fresh page and closes it when done. No persistent navigation state
between calls.

```typescript
import { Module } from '@nestjs/common';
import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';

@Module({
  imports: [
    BrowserActionModule.forRoot({ pool: { min: 2, max: 10 } }),
  ],
})
export class AppModule {}
```

```typescript
import { Injectable } from '@nestjs/common';
import { BrowserActionService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class YourService {
  constructor(private readonly browserAction: BrowserActionService) {}

  async scrapeProducts() {
    const result = await this.browserAction.evaluateWebsite({
      url: 'https://www.scrapingcourse.com/ecommerce/',
      patterns: [
        {
          key: 'container',
          patternType: 'css',
          returnType: 'text',
          patterns: ['.product'],
          meta: { isContainer: true },
        },
        {
          key: 'name',
          patternType: 'css',
          returnType: 'text',
          patterns: ['h2.woocommerce-loop-product__title'],
          pipes: { trim: true },
        },
      ],
    });

    return result.results;
  }
}
```

> `BrowserActionModule.forRoot()`/`forRootAsync()` without a `name` gives
> you pool mode; pass `name` for named-browser mode (Option A). Async config
> and cookies work the same way on both — see the
> [migration table](docs/features/named-browsers.md#migration-pool-method--controller-method)
> if you're moving code between the two.

## Documentation

### Features

- [Pattern-Based Extraction](docs/methods/scrape.md#evaluatewebsite---unified-xpath-parser-compatible-api) - `evaluateWebsite()` with `PatternField` patterns
- [Container-Based Extraction](docs/methods/scrape.md#evaluatewebsite---unified-xpath-parser-compatible-api) - Extract lists with `meta.isContainer`
- [Data Cleaning Pipes](docs/features/pipes.md) - Transform extracted data with pipes
- [Cookie Management](docs/features/cookies.md) - Session persistence
- [Workflow Actions](docs/methods/workflow.md) - Declarative step-by-step automation
- [Named Browsers & Pages](docs/features/named-browsers.md) - Persistent named browser/page pairs with `PageController`

### Reference

- [API Reference](docs/api-reference.md) - Complete service API documentation
- [Workflow Actions Reference](docs/workflow-actions.md) - All action types
- [Browser & Page Control](docs/methods/browser-control.md) - Low-level control

## Quick Examples

### Simple Product Scraping

```typescript
interface Product {
  name: string;
  price: string;
}

const result = await browserAction.evaluateWebsite<Product>({
  url: 'https://example.com/products',
  patterns: [
    {
      key: 'container',
      patternType: 'css',
      returnType: 'text',
      patterns: ['.product-card'],
      meta: { isContainer: true },
    },
    {
      key: 'name',
      patternType: 'css',
      returnType: 'text',
      patterns: ['h2.name'],
      pipes: { trim: true },
    },
    {
      key: 'price',
      patternType: 'css',
      returnType: 'text',
      patterns: ['.price'],
      pipes: {
        trim: true,
        replace: [{ from: '$', to: '' }],
      },
    },
  ],
});
```

### Article Extraction with Fallbacks

```typescript
const result = await browserAction.evaluateWebsite({
  url: 'https://example.com/article',
  patterns: [
    {
      key: 'title',
      patternType: 'css',
      returnType: 'text',
      patterns: ['meta[property="og:title"]'],
      meta: {
        alterPattern: ['h1', 'title'],
      },
      pipes: { trim: true },
    },
    {
      key: 'description',
      patternType: 'css',
      returnType: 'text',
      patterns: ['meta[name="description"]'],
      pipes: { trim: true, decode: true },
    },
  ],
});
```

### XPath Extraction

```typescript
const result = await browserAction.evaluateWebsite({
  url: 'https://example.com/sitemap.xml',
  patterns: [
    {
      key: 'container',
      patternType: 'xpath',
      returnType: 'text',
      patterns: ['//url'],
      meta: { isContainer: true },
    },
    {
      key: 'loc',
      patternType: 'xpath',
      returnType: 'text',
      patterns: ['.//loc/text()'],
    },
  ],
});
```

### Workflow Automation

```typescript
const result = await browserAction.scrapeWithWorkflow({
  version: '1.0',
  actions: [
    { action: 'navigate', value: 'https://example.com/login' },
    { action: 'fill', target: { type: 'css', value: '#username' }, value: 'user' },
    { action: 'fill', target: { type: 'css', value: '#password' }, value: 'pass' },
    { action: 'click', target: { type: 'css', value: '[type=submit]' } },
    { action: 'saveCookies', value: 'user-session', options: { overwrite: true } },
    { id: 'title', action: 'extract', target: { type: 'css', value: 'h1' } },
  ],
});
```

### Stealth (CloakBrowser)

```typescript
BrowserActionModule.forRoot({
  cloak: {
    proxy: { server: 'http://host:port', username: 'user', password: 'pass' },
    humanize: true,
    geoip: true,
    timezone: 'America/New_York',
    locale: 'en-US',
    stealthArgs: true,
  },
  pool: { min: 2, max: 5 },
})
```

### TLS Fingerprint Capture

Capture the browser's own TLS fingerprint for use with `nestjs-xpath-parser`'s CycleTLS engine:

```typescript
const fingerprint = await browserAction.captureTlsFingerprint('./fingerprint.json');
// fingerprint.json can be passed to ScraperHtmlModule.forRoot({ fingerprint: './fingerprint.json' })
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test
pnpm test
pnpm test:cov

# Lint
pnpm lint
pnpm format
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/yourusername/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/yourusername/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

The [Named Browsers & Pages](#option-a-named-browser--pages) DI pattern
(`forRoot({ name })` + `forFeature(pages, name)` +
`@InjectBrowser`/`@InjectPage`/`@InjectPageController`) was inspired by
[oblakstudio/nestjs-puppeteer](https://github.com/oblakstudio/nestjs-puppeteer).
Thanks to the maintainers for the clean named-instance design.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
