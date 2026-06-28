# scrape() - Single Element Scraping

Extract single elements from web pages using CSS or XPath selectors with optional pipe transformations.

## Signature

```typescript
async scrape<T extends SelectorMap>(
  url: string,
  selectors: T,
  options?: ScraperOptions,
): Promise<ScrapeResult>
```

## Parameters

### `url: string`
The URL of the web page to scrape.

### `selectors: T`
Object mapping selector names to CSS or XPath selectors.

```typescript
{
  title: 'h1',
  description: 'meta[name="description"]@content',
  price: '.product-price',
}
```

**Attribute syntax:** append `@attrName` to a selector to extract an attribute instead
of text content (e.g. `'a.link@href'`, `'meta[name="description"]@content'`). Without
`@attr`, `textContent` is extracted.

### `options?: ScraperOptions`
Optional configuration.

```typescript
{
  pipes: {
    title: [{ type: CleansingType.TRIM }],
    price: [
      { type: CleansingType.TRIM },
      { type: CleansingType.TO_NUMBER },
    ],
  },
  waitUntil: 'networkidle0', // navigation wait condition
  timeout: 30000,            // navigation timeout (ms)
  cloak: { proxy: { server: 'http://proxy:8080' } }, // per-call stealth (off-pool browser)
}
```

## Return Type

```typescript
Promise<ScrapeResult> // Partial<Record<string, unknown>>
```

Returns an object with extracted data. Missing selectors are undefined (Partial type).

## Examples

### Basic Usage

```typescript
import { BrowserActionService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    private readonly actionHelpers: BrowserActionService,
  ) {}

  async scrapeProduct() {
    const data = await this.actionHelpers.scrape(
      'https://example.com/product',
      {
        title: 'h1.product-title',
        price: '.price',
        description: '.description',
      }
    );

    console.log(data.title);      // "Product Name"
    console.log(data.price);      // "$29.99"
    console.log(data.description); // "Product description..."
  }
}
```

### With Pipes

```typescript
import { CleansingType } from '@hanivanrizky/nestjs-browser-action';

const data = await this.actionHelpers.scrape(
  'https://example.com/product',
  {
    title: 'h1',
    price: '.price',
  },
  {
    pipes: {
      title: [
        { type: CleansingType.TRIM },
        { type: CleansingType.TO_UPPER_CASE },
      ],
      price: [
        { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
        { type: CleansingType.TRIM },
        { type: CleansingType.TO_NUMBER },
      ],
    },
  }
);

// Result:
// {
//   title: "PRODUCT NAME",
//   price: 29.99
// }
```

### Type-Safe Selectors

```typescript
interface ProductSelectors extends SelectorMap {
  title: string;
  price: number;
  inStock: boolean;
}

const result = await this.actionHelpers.scrape<ProductSelectors>(
  'https://example.com/product',
  {
    title: 'h1',
    price: '.price',
    inStock: '.stock-status',
  },
  {
    pipes: {
      price: [{ type: CleansingType.TO_NUMBER }],
    },
  }
);

// TypeScript knows:
// result.title: string | undefined
// result.price: number | undefined
// result.inStock: boolean | undefined
```

### Error Handling

```typescript
const data = await this.actionHelpers.scrape(
  'https://example.com',
  {
    // Exists
    title: 'h1',
    // Doesn't exist - will be undefined
    nonexistent: '.missing-element',
  }
);

console.log(data.title);        // "Page Title"
console.log(data.nonexistent);  // undefined (no error thrown)
```

## Selector Types

### CSS Selectors (Default)

```typescript
// Element by tag
{ title: 'h1' }

// Class selector
{ content: '.main-content' }

// ID selector
{ header: '#header' }

// Attribute selector
{ link: 'a[href="https://example.com"]' }

// Descendant selector
{ price: '.product .price' }

// Multiple classes
{ card: '.card.shadow-md.p-4' }
```

### XPath Selectors

```typescript
// XPath selectors start with // or (
{ titles: '//h2[contains(@class, "text-xl")]' }
{ links: '//a[starts-with(@href, "/ecommerce")]' }
{ price: '(//span[@class="price"])[1]' }
```

**Auto-Detection:** Selectors starting with `//` or `(` are automatically treated as XPath.

## Features

- ✅ **CSS Selectors:** Full CSS3 selector support
- ✅ **XPath Support:** Auto-detection for XPath expressions
- ✅ **Pipe Transformations:** Apply data cleansing pipes
- ✅ **Type Safety:** Full TypeScript support with generics
- ✅ **Error Tolerant:** Missing selectors return undefined, no errors thrown
- ✅ **Single Element:** Returns first match only (use `scrapeAll()` for multiple elements)

## Related Methods

- [`scrapeAll()`](./scrape-all.md) - Extract multiple elements
- [`scrapeWithWorkflow()`](./workflow.md) - Workflow-based automation
- [`waitForSelector()`](./browser-control.md) - Wait for elements before scraping

## See Also

- [Pipe Documentation](../features/pipes.md)
- [Workflow Actions](../workflow-actions.md)
- [XPath Guide](../features/xpath.md)

---

# evaluateWebsite() - Unified xpath-parser-compatible API

Drop-in compatible with `nestjs-xpath-parser`'s `EvaluateOptions` / `PatternField` shape. Developers can switch between the two libraries with zero API changes.

## Signature

```typescript
async evaluateWebsite<T = Record<string, unknown>>(
  options: EvaluateOptions,
): Promise<EvaluateResult<T>>
```

## Parameters

### `options: EvaluateOptions`

```typescript
{
  url: string;               // required — page to scrape
  patterns: PatternField[];  // field definitions (see below)
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
  cloak?: CloakOptions;
  interceptResource?: boolean;
  useRandomUserAgent?: boolean;
  pagination?: PaginationOptions; // optional — accumulate results across pages
}
```

### `PaginationOptions`

```typescript
{
  type: 'click-next' | 'load-more' | 'infinite-scroll' | 'url-increment';
  selector?: string;       // CSS selector for next button / load-more / sentinel element
  maxPages?: number;       // maximum pages to scrape (default: 10)
  waitAfter?: number;      // ms to wait after each page action (default: 800)
  // url-increment only:
  urlTemplate?: string;    // URL template with {page} placeholder, e.g. 'https://site.com/page/{page}'
  startPage?: number;      // page number to start url-increment from (default: 2)
  // infinite-scroll only:
  endSelector?: string;    // CSS selector — stop scrolling when this element appears
}
```

**Strategies:**
- `click-next`: clicks `selector` after each scrape, waits for navigation, stops when selector is gone
- `load-more`: clicks `selector` after each scrape (no navigation), stops when selector hidden/gone
- `infinite-scroll`: scrolls `selector` into view after each scrape, stops when item count stops growing or `endSelector` appears
- `url-increment`: navigates `urlTemplate` with incrementing `{page}` values, stops when page yields no new items or `maxPages` is reached

### `PatternField`

```typescript
{
  key: string;                          // output field name
  patternType: 'css' | 'xpath';        // selector language
  returnType: 'text' | 'rawHTML' | 'html'; // rawHTML is an alias for html
  patterns: string[];                   // [0] = primary, [1..n] = fallbacks
  meta?: PatternMeta;
  pipes?: CleanerStepRules;            // same object as CleanerStepRules from pipe-engine
}
```

### `PatternMeta`

```typescript
{
  isContainer?: boolean;     // marks this pattern as the container selector
  multiple?: boolean | string;
  multiline?: boolean;
  alterPattern?: string[];   // extra fallback selectors (appended after patterns[1..n])
  isPage?: boolean;
  pageUrlKey?: string;
  pageTextKey?: string;
}
```

## Return Type

```typescript
interface EvaluateResult<T = Record<string, unknown>> {
  results: T[];
  totalPages?: number; // set when pagination is used
}
```

Always returns an array. For flat (non-container) pages, `results` has one element. When `pagination` is set, `results` accumulates items from all pages and `totalPages` reports how many pages were scraped.

## Routing Logic

| Condition | Path | Returns |
|-----------|------|---------|
| Any pattern has `meta.isContainer: true` | `scrapeContainerFields()` | `results: items[]` |
| No container pattern | `scrape()` | `results: [singleObject]` |

## Examples

### Flat page extraction

```typescript
import {
  BrowserActionService,
  EvaluateOptions,
} from '@hanivanrizky/nestjs-browser-action';

const options: EvaluateOptions = {
  url: 'https://example.com/product',
  patterns: [
    { key: 'title', patternType: 'css', returnType: 'text', patterns: ['h1'] },
    {
      key: 'price',
      patternType: 'css',
      returnType: 'text',
      patterns: ['.price'],
      pipes: { trim: true },
    },
  ],
};

const { results } = await service.evaluateWebsite(options);
// results[0] = { title: 'Product Name', price: '$29.99' }
```

### Container / list extraction

```typescript
const options: EvaluateOptions = {
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
      patterns: ['h2', 'h3'],            // h3 is fallback
      meta: { alterPattern: ['.title'] }, // additional fallback
    },
    {
      key: 'price',
      patternType: 'css',
      returnType: 'text',
      patterns: ['.price'],
      pipes: { trim: true },
    },
  ],
};

const { results } = await service.evaluateWebsite(options);
// results = [{ name: 'Item A', price: '$10' }, { name: 'Item B', price: '$20' }, ...]
```
