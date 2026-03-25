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

### `options?: ScraperOptions`
Optional configuration for pipe transformations.

```typescript
{
  pipes: {
    title: [{ type: CleansingType.TRIM }],
    price: [
      { type: CleansingType.TRIM },
      { type: CleansingType.TO_NUMBER },
    ],
  },
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
import { ActionHelpersService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    private readonly actionHelpers: ActionHelpersService,
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
- [`scrapeWithActions()`](./workflow.md) - Workflow-based automation
- [`waitForSelector()`](./browser-control.md) - Wait for elements before scraping

## See Also

- [Pipe Documentation](../features/pipes.md)
- [Workflow Actions](../workflow-actions.md)
- [XPath Guide](../features/xpath.md)
