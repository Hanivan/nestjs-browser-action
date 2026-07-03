# Named Browsers & Pages

Persistent, named browser + page pairs — an alternative to the connection
pool for workloads that want a single long-lived page (login sessions,
authenticated crawls, anything where cookies/localStorage/navigation state
should carry over between calls) instead of a fresh page opened and closed
per scrape.

## Overview

- (☆^O^☆) **Named Browsers**: `forRoot({ name })` launches/connects one
  `Browser` and keeps it alive for the app's lifetime, keyed by `name`
- (>\_<) **Named Pages**: `forFeature([...pages], name)` opens one persistent
  `Page` per page name on that browser
- (・\_・) **`PageController`**: full scrape/workflow/pagination/capture API
  bound to a single persistent page — no open/close per call
- (｡•̀ᴗ-)✧ **DI decorators**: `@InjectBrowser`, `@InjectPage`,
  `@InjectPageController` to reach into any named browser/page from any
  provider
- (>\_>) **Auto-recreate**: dead pages/browsers are transparently reopened by
  `PageController` — you never see a closed-page error

This coexists with the pool-based API (`BrowserActionService`,
`BrowserActionModule.forRoot()` without `name`) — pick either per module, or
mix both in the same app.

## `forRoot({ name })`

```typescript
BrowserActionModule.forRoot({
  name: 'stealth', // required to opt into named-browser mode
  cloak: { headless: true }, // same BrowserActionOptions as pool mode
  remote: undefined, // or CDP remote options
  cookies: { enabled: true, cookiesDir: './cookies' },
  logLevel: 'log',
});
```

`options` is the same `BrowserActionOptions` shape used by pool-mode
`forRoot()` — `cloak`, `remote`, `cookies`, `pool` (unused in named mode),
`logLevel`, `debugLogMaxLength`, `customPipes`. The only new field is `name`:

- Presence of `name` routes `forRoot()`/`forRootAsync()` into named-browser
  mode instead of pool mode.
- `name` must be unique per process — a second `forRoot({ name: 'stealth' })`
  throws `BrowserActionModule: a browser with name "stealth" is already
registered.` Each named-browser module is registered `@Global()`, so
  register each name exactly once, app-wide.
- `forRootAsync({ name, useFactory, inject })` works the same way, except
  `name` must be known synchronously at registration time (it's used to
  claim the name before the async factory resolves).
- The browser is launched (or connected, if `remote` is set) lazily via a
  factory provider, and closed/disconnected automatically on
  `onApplicationShutdown` — nothing to clean up manually.

## `forFeature(pages, browserName = 'default')`

```typescript
BrowserActionModule.forFeature(['login', 'search'], 'stealth');
```

For each entry in `pages`, this registers:

- a persistent `Page` (opened once via `browser.newPage()`)
- a `PageController` wrapping that page

Both are exported under tokens derived from `(pageName, browserName)`, so
they can be injected from any module that imports the feature module.
`browserName` defaults to `'default'` — matching a `forRoot({ name:
'default' })` (or a bare `forRoot({ name: 'default', ... })`) registration.

## Decorators

```typescript
import {
  InjectBrowser,
  InjectPage,
  InjectPageController,
} from '@hanivanrizky/nestjs-browser-action';
import type { Browser, Page } from 'puppeteer-core';
import type { PageController } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    @InjectBrowser('stealth') private readonly browser: Browser,
    @InjectPage('login', 'stealth') private readonly loginPage: Page,
    @InjectPageController('login', 'stealth')
    private readonly login: PageController,
  ) {}
}
```

| Decorator                       | Resolves to                               | Default `name` |
| -------------------------------- | ------------------------------------------ | --------------- |
| `InjectBrowser(name?)`           | raw `Browser` registered by `forRoot({name})` | `'default'`     |
| `InjectPage(page, name?)`        | raw `Page` registered by `forFeature`         | `'default'`     |
| `InjectPageController(page, name?)` | `PageController` registered by `forFeature` | `'default'`     |

**Prefer `@InjectPageController` over `@InjectPage` for scraping.** A raw
`@InjectPage` reference is a **static snapshot** — it's the `Page` instance
that existed at DI-resolution time. If that page later closes/crashes and
`PageController` transparently recreates it (see below), your injected `Page`
reference still points at the dead one. `PageController.page` is always a
live getter that returns the current page, recreating it on demand — use it
(or the controller's methods, which call it internally) instead of holding
onto a raw `Page`.

## `PageController`

Full public method list (all delegate to the shared extraction/container/
workflow/pagination/capture operators used by `BrowserActionService`):

| Method | Signature |
| --- | --- |
| `scrape` | `scrape<T>(url, selectors, options?): Promise<ScrapeResult>` |
| `extract` | `extract<T>(selectors, options?): Promise<ScrapeResult>` — no navigation, extracts from current page |
| `scrapeAll` | `scrapeAll<T>(url, selectors, options?): Promise<ScrapeAllResult>` |
| `scrapeContainerFields` | `scrapeContainerFields<T>(url, descriptor, options?): Promise<ContainerScrapeResult<T>>` |
| `evaluateWebsite` | `evaluateWebsite<T>(options): Promise<EvaluateResult<T>>` |
| `takeScreenshot` | `takeScreenshot(url, path, options?, scraperOptions?): Promise<Buffer>` |
| `generatePDF` | `generatePDF(url, path, options?, scraperOptions?): Promise<Buffer>` |
| `captureTlsFingerprint` | `captureTlsFingerprint(path, url?): Promise<TlsFingerprint>` |
| `waitForSelector` | `waitForSelector(url, selector, timeout?, scraperOptions?): Promise<Page>` |
| `evaluate` | `evaluate<T>(url, script, options?): Promise<T>` |
| `scrapeWithWorkflow` | `scrapeWithWorkflow<T>(url, workflow, variables?): Promise<WorkflowResultTyped<T>>` |
| `scrapeAllWithWorkflow` | alias of `scrapeWithWorkflow` |
| `goto` | `goto(url, options?): Promise<void>` — navigate without extracting |
| `close` | `close(): Promise<void>` — close the underlying page |
| `page` (getter) | live `Page` — always current, recreated on demand |
| `browser` (getter) | live `Browser` |

### `ControllerScraperOptions` — no `cloak` / no `useRandomUserAgent`

```typescript
export type ControllerScraperOptions = Omit<
  ScraperOptions,
  'cloak' | 'useRandomUserAgent'
>;
```

Every `PageController` method that accepts scraper options uses
`ControllerScraperOptions`, not the full `ScraperOptions` used by
`BrowserActionService`. **`cloak` and `useRandomUserAgent` are not
available per-call** — a persistent page is bound to a single
browser/fingerprint for its entire lifetime, so per-call cloak/UA overrides
that make sense for the pool's open-new-page-per-call model don't apply
here. Configure stealth once, at `forRoot({ name, cloak: {...} })` time.

## Auto-recreate semantics

`PageSession` (the internal state holder behind `PageController`) checks
page/browser liveness before every operation:

- If the page is closed but the browser is still connected: a **fresh blank
  page** is opened via `browser.newPage()`. No attempt is made to restore
  the closed page's URL, cookies, localStorage, or in-page state — the next
  `scrape()`/`goto()` call navigates it from scratch.
- If the browser itself has died (crashed, disconnected): the browser is
  relaunched (local) or reconnected (remote) per the original
  `BrowserActionOptions`, then a fresh page is opened on it.
- This recovery is transparent — you never see a "Target closed" or
  "Session closed" error from `PageController` methods; they resolve a live
  page first, every time.

Consequence: **raw `@InjectPage` references are static snapshots that can go
stale** the moment a recreate happens (see the decorators section above).
Always go through `PageController` (its `page` getter or its methods) if
recreation matters to you.

## Cookie & state persistence across calls

Because `PageController` never closes the underlying page between calls
(unlike the pool, which opens/closes a page per `scrape()`), **cookies,
localStorage, sessionStorage, and any other in-page state persist
automatically across consecutive calls on the same controller** — this is
by design, not a side effect. A `login` page controller that runs a login
workflow once, then serves subsequent `scrape()` calls, stays authenticated
without re-running the login flow each time — as long as the page itself
isn't recreated (see above; a recreate starts from a blank page with no
carried-over state).

If you need cookies to survive process restarts (not just consecutive calls
within one run), combine this with [cookie persistence](./cookies.md) via
the `cookies` option on `forRoot({ name, cookies: {...} })`.

## Tab focus & concurrency

Chromium throttles rAF-driven in-page work (e.g. humanized typing in
workflows) on unfocused tabs — even with the backgrounding-disable launch
flags — which stalls workflows on any tab that isn't the browser's active
one. To keep every page running unattended, `PageSession.goto()` enables
CDP **focus emulation** (`Emulation.setFocusEmulationEnabled`) on the page
before navigating: the page believes it's focused without stealing real
focus from other tabs.

Because emulation is per-page (unlike `bringToFront()`, which is exclusive
per browser window), **multiple pages on the same browser can run
workflows concurrently** — headed or headless — with no focus contention.

Focus emulation is applied once per live page and reapplied automatically
after an auto-recreate. If the CDP call fails (some remote browsers), the
session falls through without emulation rather than erroring.

## Multi-browser example

Two independently configured named browsers — e.g. one stealth profile for
login flows, one lightweight profile for high-volume scraping:

```typescript
import { Module } from '@nestjs/common';
import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';

@Module({
  imports: [
    BrowserActionModule.forRoot({
      name: 'stealth',
      cloak: { headless: true, humanize: true },
    }),
    BrowserActionModule.forFeature(['login', 'account'], 'stealth'),

    BrowserActionModule.forRoot({
      name: 'fast',
      cloak: { headless: true },
    }),
    BrowserActionModule.forFeature(['search', 'listing'], 'fast'),
  ],
})
export class AppModule {}
```

```typescript
@Injectable()
export class CrawlerService {
  constructor(
    @InjectPageController('login', 'stealth')
    private readonly login: PageController,
    @InjectPageController('search', 'fast')
    private readonly search: PageController,
  ) {}

  async run() {
    await this.login.scrapeWithWorkflow('https://example.com/login', {
      version: '1.0',
      actions: [
        /* ...fill + submit... */
      ],
    });

    // 'login' page keeps its session cookies; 'search' runs on the
    // separate 'fast' browser, unauthenticated.
    return this.search.scrapeContainerFields('https://example.com/results', {
      container: '.result',
      fields: { title: { selector: 'h3', returnType: 'text' } },
    });
  }
}
```

## Lifecycle hardening

Named-browser mode includes four opt-in-where-applicable safety nets around
process lifecycle:

### Shutdown-hook reminder

Every local named browser logs a one-time warning on launch:

```
Call app.enableShutdownHooks() in main.ts to ensure graceful browser cleanup on Ctrl+C
```

`NamedBrowserShutdown.onApplicationShutdown()` (the hook that actually closes
the browser) only fires if the host app calls `app.enableShutdownHooks()` in
`main.ts` — Nest does not enable this by default. Skipped for `remote`
browsers (no local process to warn about).

### Liveness health check (opt-in)

```typescript
BrowserActionModule.forRoot({
  name: 'stealth',
  healthCheck: { intervalMs: 30000 }, // ping browser.version() every 30s
});
```

On ping failure, logs a warning only — `[HEALTH:stealth] browser
unreachable: <error>`. This is **passive observability**, not proactive
recovery: it does not call `relaunch()` itself. The existing reactive
recovery (a dead browser is relaunched on the next real `ensureAlive()` call
via `PageController`) is unchanged. Off by default — no `healthCheck` option
means no timer runs.

### Page-count guard

```typescript
BrowserActionModule.forRoot({ name: 'stealth', maxPages: 5 }); // default: 5
```

If the total pages registered via `forFeature(pages, 'stealth')` calls
exceeds `maxPages`, a warning is logged at module init:

```
Named browser "stealth" has 7 registered pages, exceeding the configured
maxPages (5). This is a sanity warning, not an enforced limit — review your
forFeature() calls.
```

This is a **registration-time sanity check, not a runtime cap** — named-mode
pages are fixed at DI-build time (see `forFeature` above), so there is no
way to "block" registration; the warning exists to catch accidental page
sprawl (e.g. registering `forFeature` per-entity instead of per-workflow).

### Orphan-process kill on abnormal exit

Every local named browser registers a `process.on('exit')` handler that
force-kills the underlying Chromium child process if it's still alive. This
covers uncaught exceptions, unhandled rejections, and explicit
`process.exit()` calls — all of which bypass Nest's `onApplicationShutdown`
lifecycle entirely (only a normal `app.close()` or a signal with
`enableShutdownHooks()` enabled goes through that path). It does **not**
cover `SIGKILL` of the Node process itself — no user-land code runs on
`SIGKILL`, by design in Node/POSIX. Skipped for `remote` browsers
(`browser.process()` returns `null` for CDP connections — nothing local to
kill).

## Migration: pool method → controller method

`BrowserActionService` (pool mode) and `PageController` (named mode) share
the same method names and semantics, minus cloak overrides. To migrate a
call site from the pool to a named page controller:

| Pool (`BrowserActionService`) | Named (`PageController`) | Notes |
| --- | --- | --- |
| `browserAction.scrape(url, selectors, options)` | `controller.scrape(url, selectors, options)` | drop `cloak`/`useRandomUserAgent` from `options` |
| `browserAction.scrapeAll(url, selectors, options)` | `controller.scrapeAll(url, selectors, options)` | same |
| `browserAction.scrapeContainerFields(url, descriptor, options)` | `controller.scrapeContainerFields(url, descriptor, options)` | same |
| `browserAction.evaluateWebsite(options)` | `controller.evaluateWebsite(options)` | `options` type also drops `cloak`/`useRandomUserAgent` |
| `browserAction.takeScreenshot(url, path, options, scraperOptions)` | `controller.takeScreenshot(url, path, options, scraperOptions)` | same |
| `browserAction.generatePDF(url, path, options, scraperOptions)` | `controller.generatePDF(url, path, options, scraperOptions)` | same |
| `browserAction.captureTlsFingerprint(path, url)` | `controller.captureTlsFingerprint(path, url)` | same |
| `browserAction.waitForSelector(url, selector, timeout, scraperOptions)` | `controller.waitForSelector(url, selector, timeout, scraperOptions)` | same |
| `browserAction.evaluate(url, script, options)` | `controller.evaluate(url, script, options)` | same |
| `browserAction.scrapeWithWorkflow(url, workflow, variables)` | `controller.scrapeWithWorkflow(url, workflow, variables)` | same |
| `browserAction.scrapeAllWithWorkflow(url, workflow, variables)` | `controller.scrapeAllWithWorkflow(url, workflow, variables)` | same |
| n/a (pool always opens fresh) | `controller.extract(selectors, options)` | new — extract from the page's current URL without navigating |
| n/a (pool always opens fresh) | `controller.goto(url, options)` | new — navigate without extracting |
| n/a (pool closes page after every call) | `controller.close()` | new — explicitly close the persistent page (e.g. on module teardown) |
| n/a | `controller.page` / `controller.browser` | new — live getters for the underlying `Page`/`Browser` |

Behavioral differences to account for when migrating:

1. **No per-call `cloak`/`useRandomUserAgent`.** Configure stealth once at
   `forRoot({ name, cloak })`.
2. **State persists across calls** (cookies, localStorage, current URL) —
   pool mode's `scrape()` always starts from a fresh page; controller mode
   does not, unless the page was recreated after a crash.
3. **No pool sizing options** (`pool.min/max/idle/acquire`) — one page per
   `forFeature` entry, no queueing/reuse semantics to configure.
4. Remember to call `controller.close()` yourself if you need to release
   the page before app shutdown; otherwise it stays open for the process
   lifetime (a small number of fixed pages, not a growing pool).
