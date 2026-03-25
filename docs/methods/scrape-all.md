# scrapeAll() - Multi-Element Scraping

Extract all elements matching CSS or XPath selectors from web pages with optional pipe transformations.

## Signature

```typescript
async scrapeAll<T extends SelectorMap>(
  url: string,
  selectors: T,
  options?: ScraperOptions,
): Promise<ScrapeAllResult>
```

## Parameters

### `url: string`
The URL of the web page to scrape.

### `selectors: T`
Object mapping selector names to CSS or XPath selectors. Each selector extracts **all matching elements**.

```typescript
{
  titles: '.card h2',      // All card titles
  links: 'a.card-page-link', // All card links
  prices: '.price',         // All prices
}
```

### `options?: ScraperOptions`
Optional configuration for pipe transformations applied to **each element individually**.

```typescript
{
  pipes: {
    titles: [
      { type: CleansingType.TRIM },
      { type: CleansingType.TO_LOWER_CASE },
    ],
  },
}
```

## Return Type

```typescript
Promise<ScrapeAllResult> // Partial<Record<string, unknown[]>>
```

Returns an object where each selector maps to an **array** of values. Missing selectors are undefined (Partial type).

## Examples

### Basic Usage

```typescript
import { ActionHelpersService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    private readonly actionHelpers: ActionHelpersService,
  ) {}

  async scrapeAllProducts() {
    const data = await this.actionHelpers.scrapeAll(
      'https://example.com/products',
      {
        titles: '.product-card h2',
        prices: '.product-price',
        links: '.product-card a',
      }
    );

    console.log(data.titles);  // ['Product 1', 'Product 2', 'Product 3', ...]
    console.log(data.prices);  // ['$29.99', '$15.50', '$99.00', ...]
    console.log(data.links);   // ['/product/1', '/product/2', '/product/3', ...]
  }
}
```

### With Pipes

```typescript
import { CleansingType } from '@hanivanrizky/nestjs-browser-action';

const data = await this.actionHelpers.scrapeAll(
  'https://example.com/products',
  {
    titles: '.card h2',
    prices: '.price',
    descriptions: '.card p',
  },
  {
    pipes: {
      titles: [
        { type: CleansingType.TRIM },
        { type: CleansingType.NORMALIZE_WHITESPACE },
        { type: CleansingType.TO_LOWER_CASE },
      ],
      prices: [
        { type: CleansingType.TRIM },
        { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
        { type: CleansingType.TO_NUMBER },
      ],
      descriptions: [
        { type: CleansingType.TRIM },
        { type: CleansingType.REMOVE_LINE_BREAKS },
        { type: CleansingType.SANITIZE_TEXT },
      ],
    },
  }
);

// Result:
// {
//   titles: ['product 1', 'product 2', 'product 3'],
//   prices: [29.99, 15.50, 99.00],
//   descriptions: ['Description 1...', 'Description 2...', 'Description 3...']
// }
```

### XPath Selectors

```typescript
const data = await this.actionHelpers.scrapeAll(
  'https://example.com',
  {
    // XPath selectors (auto-detected by // prefix)
    cardTitles: '//h2[contains(@class, "text-xl")]',
    // CSS selectors
    allLinks: 'a[href]',
  },
  {
    pipes: {
      cardTitles: [
        { type: CleansingType.TRIM },
        { type: CleansingType.TO_UPPER_CASE },
      ],
    },
  }
);

// Result:
// {
//   cardTitles: ['ECOMMERCE', 'PAGINATION', 'LOAD MORE'],
//   allLinks: ['/ecommerce', '/pagination', '/button-click', ...]
// }
```

### Type-Safe Selectors

```typescript
interface ProductSelectors extends SelectorMap {
  titles: string[];
  prices: number[];
  descriptions: string[];
}

const result = await this.actionHelpers.scrapeAll<ProductSelectors>(
  'https://example.com/products',
  {
    titles: '.product h2',
    prices: '.product .price',
    descriptions: '.product p',
  },
  {
    pipes: {
      prices: [{ type: CleansingType.TO_NUMBER }],
    },
  }
);

// TypeScript knows:
// result.titles: string[] | undefined
// result.prices: number[] | undefined
// result.descriptions: string[] | undefined
```

### Empty Results

```typescript
const data = await this.actionHelpers.scrapeAll(
  'https://example.com',
  {
    // No matching elements
    titles: '.nonexistent .title',
    // Multiple elements found
    existing: '.card h2',
  }
);

console.log(data.titles);     // [] (empty array, no error)
console.log(data.existing);  // ['Title 1', 'Title 2', ...]
```

### Error Handling

```typescript
const data = await this.actionHelpers.scrapeAll(
  'https://example.com',
  {
    // Invalid selector - returns undefined
    badSelector: '???invalid???',
    // Valid selector
    titles: '.card h2',
  }
);

console.log(data.badSelector);  // undefined (no error thrown)
console.log(data.titles);      // ['Title 1', 'Title 2', ...]
```

## Selector Validation

Empty selectors throw an error:

```typescript
// ❌ Throws error
await this.actionHelpers.scrapeAll(url, {
  titles: '',  // Empty selector
});

// Error: Selector for 'titles' cannot be empty
```

## XPath vs CSS Auto-Detection

The method **automatically detects** XPath selectors based on prefix:

| Pattern | Type | Example |
|---------|------|---------|
| Starts with `//` | XPath | `//h2[@class="title"]` |
| Starts with `(` | XPath | `(//h2)[1]` |
| Anything else | CSS | `.card h2`, `#header`, `a[href]` |

```typescript
const data = await this.actionHelpers.scrapeAll(
  'https://example.com',
  {
    // XPath (starts with //)
    allTitles: '//h2[contains(@class, "title")]',
    // CSS (no special prefix)
    allLinks: 'a[href]',
    // XPath (starts with ()
    firstTitle: '(//h2)[1]',
  }
);
```

## Performance

- **XPath:** Uses `page.evaluate()` with `document.evaluate()` and iterator (more efficient for large result sets)
- **CSS:** Uses `page.$$eval()` for direct element access
- **Pipe Caching:** Pipe instances are cached for repeated use across selectors

## Features

- ✅ **Multi-Element:** Extract all matching elements (not just first)
- ✅ **CSS Selectors:** Full CSS3 selector support
- ✅ **XPath Support:** Auto-detection with `//` or `(` prefix
- ✅ **Pipe Transformations:** Apply pipes to each element individually
- ✅ **Type Safety:** Full TypeScript support with generics
- ✅ **Error Tolerant:** Invalid selectors return undefined
- ✅ **Empty Arrays:** No matches return empty arrays `[]`

## Use Cases

### E-commerce Product Lists

```typescript
const products = await this.actionHelpers.scrapeAll(
  'https://shop.example.com/products',
  {
    names: '.product-name',
    prices: '.product-price',
    images: '.product-image@src',
    ratings: '.rating@data-rating',
  }
);
```

### Blog Articles

```typescript
const articles = await this.actionHelpers.scrapeAll(
  'https://blog.example.com',
  {
    titles: '.article h2',
    authors: '.author-name',
    dates: '.publish-date',
    excerpts: '.article-excerpt',
  }
);
```

### Search Results

```typescript
const results = await this.actionHelpers.scrapeAll(
  'https://search.example.com?q=test',
  {
    titles: '.result-title',
    urls: 'a.result-link@href',
    snippets: '.result-snippet',
  }
);
```

## Related Methods

- [`scrape()`](./scrape.md) - Extract single elements
- [`scrapeAllWithWorkflow()`](./workflow.md) - Multi-element with workflow
- [`scrapeWithActions()`](./workflow.md) - Workflow-based automation

## See Also

- [Pipe Documentation](../features/pipes.md)
- [XPath Guide](../features/xpath.md)
- [Workflow System](../features/workflow.md)
