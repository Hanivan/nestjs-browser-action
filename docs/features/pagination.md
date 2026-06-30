# Pagination

`evaluateWebsite()` supports opt-in multi-page extraction via `PaginationOptions`. When `pagination` is set and a container pattern is present (`meta.isContainer: true`), results are accumulated across pages into a single `EvaluateResult`.

## Strategies

| Type | How it advances |
|---|---|
| `infinite-scroll` | Scrolls to bottom (or a sentinel element) after each read; stops when item count stabilises or `endSelector` is found |
| `load-more` | Clicks a "Load more" button after each read; stops when item count stabilises or button disappears |
| `click-next` | Clicks a "Next page" button then waits for navigation; stops when button is absent or `maxPages` reached |
| `url-increment` | Fetches page 1 then replaces `{page}` in `urlTemplate` for each subsequent page; stops on empty response or `maxPages` |

## Options

```ts
interface PaginationOptions {
  type: 'infinite-scroll' | 'load-more' | 'click-next' | 'url-increment';
  selector?: string;      // CSS selector for load-more / click-next button, or scroll sentinel
  endSelector?: string;   // infinite-scroll: stop when this element appears
  urlTemplate?: string;   // url-increment: URL with {page} placeholder
  startPage?: number;     // url-increment: first page number to increment from (default 2)
  maxPages?: number;      // safety cap on iterations (default 10)
  waitAfter?: number;     // ms to wait after each action (default 800)
}
```

`EvaluateResult.totalPages` is set to the number of pages actually scraped.

## Examples

### infinite-scroll

```ts
const result = await service.evaluateWebsite({
  url: 'https://example.com/feed',
  patterns: [
    { key: 'container', patternType: 'css', returnType: 'text', patterns: ['.post'], meta: { isContainer: true } },
    { key: 'title', patternType: 'css', returnType: 'text', patterns: ['.post-title'] },
  ],
  pagination: {
    type: 'infinite-scroll',
    endSelector: '.no-more-posts',
    maxPages: 20,
    waitAfter: 1000,
  },
});
// result.results — all posts across all scroll rounds
// result.totalPages — number of scroll iterations performed
```

### url-increment

```ts
const result = await service.evaluateWebsite({
  url: 'https://forum.example.com/thread/123',
  patterns: [
    { key: 'container', patternType: 'css', returnType: 'text', patterns: ['.reply'], meta: { isContainer: true } },
    { key: 'author', patternType: 'css', returnType: 'text', patterns: ['.author'] },
    { key: 'content', patternType: 'css', returnType: 'text', patterns: ['.body'] },
  ],
  pagination: {
    type: 'url-increment',
    urlTemplate: 'https://forum.example.com/thread/123?page={page}',
    startPage: 2,
    maxPages: 50,
    waitAfter: 500,
  },
});
```

### click-next

```ts
const result = await service.evaluateWebsite({
  url: 'https://example.com/search?q=foo',
  patterns: [
    { key: 'container', patternType: 'css', returnType: 'text', patterns: ['.result'], meta: { isContainer: true } },
    { key: 'title', patternType: 'css', returnType: 'text', patterns: ['h3'] },
  ],
  pagination: {
    type: 'click-next',
    selector: 'a.next-page',
    maxPages: 10,
    waitAfter: 600,
  },
});
```

## Error handling

All strategies gracefully recover from browser/frame closure mid-pagination:

- **`Target closed`** / **`Attempted to use detached Frame`** — breaks the loop and returns whatever was collected so far
- **Navigation `TimeoutError`** (`click-next`) — treated as end-of-pages, returns collected items
- **Unexpected errors** — re-thrown so the caller can handle them

## Tests

26 unit tests cover all four strategies: happy path, `maxPages` cap, `endSelector` early-stop, target-closed recovery, detached-frame recovery, unexpected-error rethrow, and `closePage` cleanup in both success and failure paths. See `src/services/browser-action.pagination.spec.ts`.
