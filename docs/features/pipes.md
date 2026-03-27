# Pipe System

Comprehensive data transformation pipes for cleansing and normalizing scraped data.

## Overview

The pipe system provides a powerful, chainable way to transform scraped data:

- (・_・) **14 Built-in Pipes:** Ready-to-use transformations
- (>_>) **Chainable:** Combine multiple pipes in sequence
- (>_>) **Reusable:** Define once, use everywhere
- (☆^O^☆) **Type-Safe:** Full TypeScript support
- (｡•̀ᴗ-)✧ **Profiles:** Pre-configured pipe combinations

## Usage

### With scrape() and scrapeAll()

```typescript
import { CleansingType } from '@hanivanrizky/nestjs-browser-action';

const data = await this.actionHelpers.scrape(
  'https://example.com',
  {
    title: 'h1',
    price: '.price',
  },
  {
    pipes: {
      title: [
        { type: CleansingType.TRIM },
        { type: CleansingType.TO_LOWER_CASE },
      ],
      price: [
        { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
        { type: CleansingType.TO_NUMBER },
      ],
    },
  }
);
```

### With Workflows

```typescript
const workflow = {
  version: '1.0' as const,
  actions: [
    {
      id: 'rawTitle',
      action: 'extract' as const,
      target: { type: 'css' as const, value: 'h1' },
    },
    {
      action: 'cleanse' as const,
      id: 'cleanTitle',
      value: '${rawTitle}',
      options: {
        pipes: [
          { type: CleansingType.TRIM },
          { type: CleansingType.TO_UPPER_CASE },
        ],
      },
    },
  ],
};
```

### Direct with CleansingService

```typescript
import { CleansingService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    private readonly cleansingService: CleansingService,
  ) {}

  async cleanText() {
    const pipes = this.cleansingService.loadPipes([
      { type: CleansingType.TRIM },
      { type: CleansingType.NORMALIZE_WHITESPACE },
      { type: CleansingType.TO_LOWER_CASE },
    ]);

    const result = this.cleansingService.cleanse(
      '  HELLO    WORLD  ',
      pipes
    );  // "hello world"
  }
}
```

## Built-in Pipes

### Text Transformation

#### TRIM
Removes leading and trailing whitespace.

```typescript
{ type: CleansingType.TRIM }

'  Hello World  ' → 'Hello World'
'   ' → ''
```

#### NORMALIZE_WHITESPACE
Collapses multiple whitespace characters into single space.

```typescript
{ type: CleansingType.NORMALIZE_WHITESPACE }

'Hello    World' → 'Hello World'
'Text   with    spaces' → 'Text with spaces'
```

#### TO_LOWER_CASE
Converts text to lowercase.

```typescript
{ type: CleansingType.TO_LOWER_CASE }

'Hello World' → 'hello world'
'HELLO' → 'hello'
```

#### TO_UPPER_CASE
Converts text to uppercase.

```typescript
{ type: CleansingType.TO_UPPER_CASE }

'Hello World' → 'HELLO WORLD'
'hello' → 'HELLO'
```

#### SANITIZE_TEXT
Removes dangerous HTML tags (script, iframe, form, etc.), event handler attributes (onclick, onerror, etc.), javascript: protocol links, and remaining HTML tags. Normalizes whitespace in the result.

```typescript
{ type: CleansingType.SANITIZE_TEXT }

'<script>alert(1)</script>Hello World' → 'Hello World'
'<b onclick="evil()">Text</b>' → 'Text'
'<p>Hello   World</p>' → 'Hello World'
```

#### REMOVE_LINE_BREAKS
Removes line breaks (`\n`, `\r\n`, `\r`).

```typescript
{ type: CleansingType.REMOVE_LINE_BREAKS }

'Line 1\nLine 2\nLine 3' → 'Line 1Line 2Line 3'
'Text\r\nWith\nBreaks' → 'TextWithBreaks'
```

#### REMOVE_SPECIAL_CHARS
Removes special characters (keeps alphanumeric and spaces).

```typescript
{ type: CleansingType.REMOVE_SPECIAL_CHARS }

'Hello@#$ World!' → 'Hello World'
'Price: $29.99' → 'Price 2999'
```

### Number & Currency

#### TO_NUMBER
Converts string to number.

```typescript
{ type: CleansingType.TO_NUMBER }

'29.99' → 29.99
'$100' → 100 (if preceded by remove-currency-symbol)
'abc' → NaN
```

#### REMOVE_CURRENCY_SYMBOL
Removes common currency symbols.

```typescript
{ type: CleansingType.REMOVE_CURRENCY_SYMBOL }

'$29.99' → '29.99'
'€50.00' → '50.00'
'¥1000' → '1000'
'USD 25.00' → 'USD 25.00'
```

### Regular Expressions

#### REGEX_REPLACE
Replace text matching regex pattern.

```typescript
{
  type: CleansingType.REGEX_REPLACE,
  pattern: '\\d+',   // Regex pattern
  replacement: '',   // Replacement string
  flags: 'g',        // Regex flags (default: 'g'). Use 'gi' for case-insensitive, '' for first match only
}

'Price: $29.99' → 'Price: $'  // flags: 'g' removes all digits
'Hello WORLD' → 'Hello Earth' // flags: 'gi' for case-insensitive replace
'test test test' → 'x test test' // flags: '' replaces first match only
```

#### REGEX_EXTRACT
Extract text matching regex pattern.

```typescript
{
  type: CleansingType.REGEX_EXTRACT,
  pattern: '\\d+',      // Regex pattern
}

'Price: $29.99' → '29'
'Order #12345 confirmed' → '12345'
'a1b2c3' → ['1', '2', '3'] (global pattern returns all matches)
```

### Date Formatting

#### DATE_FORMAT
Parse and reformat dates using [Luxon](https://moment.github.io/luxon/#/formatting) format tokens.

```typescript
{
  type: CleansingType.DATE_FORMAT,
  format: 'yyyy-MM-dd',  // Output format (Luxon tokens)
  timezone: 'UTC',       // Optional
  locale: 'en',          // Optional
}

'January 15, 2024' → '2024-01-15'
'15/01/2024' → '2024-01-15'
```

Special `format` values: `'relative'` → `"2 hours ago"`, `'X'` → Unix timestamp seconds, `'LL'` → locale-aware long date.

### Advanced

#### ALT_FLAG
Alternative fallback pipe - executes fallback pipes if primary result is empty/null/undefined.

```typescript
{
  type: CleansingType.ALT_FLAG,
  primaryPipes: [
    { type: CleansingType.REGEX_EXTRACT, pattern: '\\d+' },
  ],
  fallbackPipes: [
    { type: CleansingType.TRIM },
  ],
  fallbackOn: 'empty',  // 'empty' | 'null' | 'undefined' | 'all'
}

'Price: $29.99' → '29'       // Primary extracts digits
'No price available' → 'No price available'  // Fallback to trim
```

## Parameters

Some pipes accept parameters as flat fields on the config object:

```typescript
interface PipeConfig {
  type: CleansingType;
  pattern?: string;           // REGEX_REPLACE, REGEX_EXTRACT
  replacement?: string;       // REGEX_REPLACE
  flags?: string;             // REGEX_REPLACE — 'g' (default), 'gi', 'i', '' etc.
  format?: string;            // DATE_FORMAT
  timezone?: string;          // DATE_FORMAT
  locale?: string;            // DATE_FORMAT
  primaryPipes?: PipeConfig[];   // ALT_FLAG
  fallbackPipes?: PipeConfig[];  // ALT_FLAG
  fallbackOn?: 'empty' | 'null' | 'undefined' | 'all';  // ALT_FLAG
  [key: string]: unknown;     // allows additional custom fields
}
```

### Regex Replace Parameters

```typescript
{
  type: CleansingType.REGEX_REPLACE,
  pattern: '\\s+',   // Pattern to match
  replacement: '-',  // Replacement string
  flags: 'g',        // Regex flags — 'g' (default), 'gi', 'i', '' etc.
}
```

### Regex Extract Parameters

```typescript
{
  type: CleansingType.REGEX_EXTRACT,
  pattern: '[A-Z0-9]+',     // Pattern to extract
}
```

### Date Format Parameters

```typescript
{
  type: CleansingType.DATE_FORMAT,
  format: 'yyyy-MM-dd',     // Output date format (Luxon tokens: yyyy=year, MM=month, dd=day)
  timezone: 'UTC',          // Optional timezone (e.g. 'America/New_York')
  locale: 'en',             // Optional locale for output formatting
}
```

Common Luxon tokens: `yyyy` year · `MM` month · `dd` day · `HH` hour · `mm` minute · `ss` second.
Special values: `'relative'` · `'X'` (Unix seconds) · `'LL'` (locale long date).

### Alt Flag Parameters

```typescript
{
  type: CleansingType.ALT_FLAG,
  primaryPipes: [...],
  fallbackPipes: [...],
  fallbackOn: 'empty',        // When to use fallback
}
```

## Predefined Profiles

Pre-configured pipe combinations for common use cases.

### Usage

```typescript
import { CleansingProfile } from '@hanivanrizky/nestjs-browser-action';

const result = await this.cleansingService.cleanseWithProfile(
  '  $29.99  ',
  CleansingProfile.PRICE
);
// Result: 29.99
```

### Available Profiles

#### PRICE
Cleanses price strings with currency symbols and converts to number.

```typescript
CleansingProfile.PRICE

'  $29.99  ' → 29.99
'€15.50' → 15.50
```

**Pipes used:**
1. Trim
2. Remove currency symbol
3. Remove special characters
4. To number

#### PHONE
Cleanses phone number formats.

```typescript
CleansingProfile.PHONE

'+1 (555) 123-4567' → '+15551234567'
'(555) 123-4567' → '5551234567'
```

#### EMAIL
Cleanses and normalizes email addresses.

```typescript
CleansingProfile.EMAIL

'  user@EXAMPLE.com  ' → 'user@example.com'
```

#### DATE
Parses and formats dates.

```typescript
CleansingProfile.DATE

'January 15, 2024' → '2024-01-15'
'15/01/2024' → '2024-01-15'
```

#### CURRENCY
Handles currency symbols and formatting.

```typescript
CleansingProfile.CURRENCY

'$29.99' → '29.99'
'€1,234.56' → '1234.56'
```

## Chaining Pipes

Pipes execute in sequence, output of one becomes input of next:

```typescript
const pipes = [
  { type: CleansingType.TRIM },                      // '  HELLO  '
  { type: CleansingType.NORMALIZE_WHITESPACE },     // ' HELLO'
  { type: CleansingType.TO_LOWER_CASE },             // 'hello'
];

const result = this.cleansingService.cleanse(
  '  HELLO    WORLD  ',
  pipes
);  // 'hello world'
```

## Creating Custom Pipes

Create custom pipes by extending `CleansingPipe`:

```typescript
import { CleansingPipe } from '@hanivanrizky/nestjs-browser-action';

export class CustomPipe extends CleansingPipe<string, string> {
  async transform(data: string): Promise<string> {
    // Your transformation logic
    return data.toUpperCase();
  }
}
```

Then register in `CleansingService`:

```typescript
private readonly PIPE_TYPE_MAP = {
  // ... existing pipes ...
  'custom': CustomPipe,
};
```

## Examples

### E-commerce Price Cleansing

```typescript
const price = await this.actionHelpers.scrape(
  'https://shop.example.com/product',
  { price: '.product-price' },
  {
    pipes: {
      price: [
        { type: CleansingType.TRIM },
        { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
        { type: CleansingType.TO_NUMBER },
      ],
    },
  }
);
```

### Text Normalization

```typescript
const text = await this.actionHelpers.scrape(
  url,
  { content: '.content' },
  {
    pipes: {
      content: [
        { type: CleansingType.TRIM },
        { type: CleansingType.NORMALIZE_WHITESPACE },
        { type: CleansingType.REMOVE_LINE_BREAKS },
        { type: CleansingType.SANITIZE_TEXT },
      ],
    },
  }
);
```

### URL Extraction

```typescript
const urls = await this.actionHelpers.scrapeAll(
  url,
  { links: 'a[href]' },
  {
    pipes: {
      links: [
        { type: CleansingType.TRIM },
        {
          type: CleansingType.REGEX_EXTRACT,
          pattern: '^/products/[\\w-]+',
        },
      ],
    },
  }
);
```

### Conditional Data Cleaning

```typescript
const data = await this.actionHelpers.scrape(
  url,
  { price: '.price' },
  {
    pipes: {
      price: [
        // Try to extract digits
        {
          type: CleansingType.ALT_FLAG,
          primaryPipes: [
            { type: CleansingType.REGEX_EXTRACT, pattern: '\\d+\\.\\d{2}' },
          ],
          // Fallback: just trim and remove currency
          fallbackPipes: [
            { type: CleansingType.TRIM },
            { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
          ],
          fallbackOn: 'empty',
        },
      ],
    },
  }
);
```

## Performance

- **Pipe Caching:** Pipe instances are cached for reuse
- **Efficient Chaining:** Minimal overhead per pipe
- **Lazy Evaluation:** Pipes only execute when data is extracted

## Best Practices

1. **Order matters:** Place expensive operations last
2. **Validate first:** Use regex to validate before conversion
3. **Use profiles:** Leverage predefined profiles for common patterns
4. **Handle edge cases:** Use alt-flag for conditional logic
5. **Test pipes:** Verify output with various input formats

## Related Methods

- [`scrape()`](../methods/scrape.md) - With pipe options
- [`scrapeAll()`](../methods/scrape-all.md) - Multi-element with pipes
- [`CleansingService`](../api-reference.md#cleansingservice) - Direct pipe usage
- [Workflow Actions](../workflow-actions.md#cleanse-action) - Cleanse in workflows

## See Also

- [CleansingType Enum](../api-reference.md#cleansingtype) - All pipe types
- [Profiles Reference](./profiles.md) - Predefined profiles
- [Custom Pipes Guide](./custom-pipes.md) - Creating custom pipes
