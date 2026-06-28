# Pipe System

Comprehensive data transformation pipes for cleansing and normalizing scraped data.

## Overview

The pipe system provides a powerful, chainable way to transform scraped data:

- (・_・) **Built-in Pipes:** 30+ ready-to-use transformations (original + xpath-parser ports)
- (>_>) **Chainable:** Combine multiple pipes in sequence via `CleanerStepRules`
- (>_>) **Reusable:** Define once, use everywhere
- (☆^O^☆) **Type-Safe:** Full TypeScript support
- (｡•̀ᴗ-)✧ **Profiles:** Pre-configured pipe combinations

## The `CleanerStepRules` Interface

All pipe configuration is done through a single `CleanerStepRules` object:

```typescript
interface CleanerStepRules {
  trim?: boolean;                          // trim leading/trailing whitespace
  toLowerCase?: boolean;                   // convert to lowercase
  toUpperCase?: boolean;                   // convert to uppercase
  decode?: boolean;                        // decode HTML entities
  replace?: Array<{ from: string; to: string }>;  // regex replace rules (applied globally)
  merge?: boolean | 'with space' | 'with comma';  // merge array values
  custom?: Array<Record<string, unknown>>; // custom pipe chain by type string
}
```

`PipeEngine.apply(value, rules, url?)` runs the rules in this order:
`decode → toLowerCase → toUpperCase → trim → replace[] → custom[] → collapse whitespace`

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
      title: { trim: true, toLowerCase: true },
      price: {
        trim: true,
        custom: [
          { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$', '€', '£'] },
          { type: CleansingType.TO_NUMBER, decimals: 2 },
        ],
      },
    },
  }
);
```

### With Workflows (cleanse action)

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
        pipes: { trim: true, toUpperCase: true },
      },
    },
    {
      id: 'rawPrice',
      action: 'extract' as const,
      target: { type: 'css' as const, value: '.price' },
    },
    {
      action: 'cleanse' as const,
      id: 'cleanPrice',
      value: '${rawPrice}',
      options: {
        pipes: {
          trim: true,
          custom: [
            { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$'] },
            { type: CleansingType.TO_NUMBER, decimals: 2 },
          ],
        },
      },
    },
  ],
};
```

### Direct with CleansingService

`CleansingService.buildPipes()` + `cleanse()` is still available for custom pipe chains using the `PipeConfig[]` format:

```typescript
import { CleansingService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(private readonly cleansingService: CleansingService) {}

  cleanText() {
    const pipes = this.cleansingService.buildPipes([
      { type: CleansingType.TRIM },
      { type: CleansingType.NORMALIZE_WHITESPACE },
      { type: CleansingType.TO_LOWER_CASE },
    ]);

    return this.cleansingService.cleanse('  HELLO    WORLD  ', pipes);
    // "hello world"
  }
}
```

Alternatively, use `PipeEngine` directly:

```typescript
import { PipeEngine } from '@hanivanrizky/nestjs-browser-action';

const engine = new PipeEngine();
const result = engine.apply('  HELLO    WORLD  ', { trim: true, toLowerCase: true });
// "hello world"
```

## Built-in Pipes

### Primitive rules (CleanerStepRules flags)

| Rule | Type | Effect |
|------|------|--------|
| `trim` | `boolean` | Remove leading/trailing whitespace |
| `toLowerCase` | `boolean` | Convert to lowercase |
| `toUpperCase` | `boolean` | Convert to uppercase |
| `decode` | `boolean` | Decode HTML entities (`&amp;` → `&`) |
| `replace` | `CleanerRule[]` | Apply regex replacements globally |

### Text Transformation (custom pipe types)

#### TRIM
```typescript
{ type: CleansingType.TRIM }
// '  Hello World  ' → 'Hello World'
```

#### NORMALIZE_WHITESPACE
```typescript
{ type: CleansingType.NORMALIZE_WHITESPACE }
// 'Hello    World' → 'Hello World'
```

#### TO_LOWER_CASE
```typescript
{ type: CleansingType.TO_LOWER_CASE }
// 'Hello World' → 'hello world'
```

#### TO_UPPER_CASE
```typescript
{ type: CleansingType.TO_UPPER_CASE }
// 'hello world' → 'HELLO WORLD'
```

#### SANITIZE_TEXT
Removes dangerous HTML tags, event handlers, and `javascript:` links.
```typescript
{ type: CleansingType.SANITIZE_TEXT }
// '<script>alert(1)</script>Hello' → 'Hello'
```

#### REMOVE_LINE_BREAKS
```typescript
{ type: CleansingType.REMOVE_LINE_BREAKS }
// 'Line 1\nLine 2' → 'Line 1Line 2'
```

#### REMOVE_SPECIAL_CHARS
```typescript
{ type: CleansingType.REMOVE_SPECIAL_CHARS }
// 'Hello@#$ World!' → 'Hello World'
```

### Number & Currency

#### TO_NUMBER
```typescript
{ type: CleansingType.TO_NUMBER, decimals: 2 }
// '29.99' → 29.99
```

#### REMOVE_CURRENCY_SYMBOL
```typescript
{ type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$', '€', '£', '¥'] }
// '$29.99' → '29.99'
```

### Regular Expressions

#### REGEX_REPLACE
```typescript
{
  type: CleansingType.REGEX_REPLACE,
  pattern: '\\d+',
  replacement: '',
  flags: 'g',   // default 'g'; use 'gi' for case-insensitive, '' for first match only
}
// 'Price: $29.99' → 'Price: $'
```

#### REGEX_EXTRACT
```typescript
{
  type: CleansingType.REGEX_EXTRACT,
  pattern: '\\d+',
}
// 'Order #12345 confirmed' → '12345'
```

### Date Formatting

#### DATE_FORMAT
```typescript
{
  type: CleansingType.DATE_FORMAT,
  format: 'yyyy-MM-dd',
  timezone: 'UTC',   // optional
  locale: 'en',      // optional
}
// 'January 15, 2024' → '2024-01-15'
```

Special `format` values: `'relative'` → `"2 hours ago"`, `'X'` → Unix timestamp, `'LL'` → locale long date.

### Advanced

#### ALT_FLAG
Alternative fallback pipe — executes fallback pipes if primary result is empty/null/undefined.
```typescript
{
  type: CleansingType.ALT_FLAG,
  primaryPipes: [{ type: CleansingType.REGEX_EXTRACT, pattern: '\\d+' }],
  fallbackPipes: [{ type: CleansingType.TRIM }],
  fallbackOn: 'empty',   // 'empty' | 'null' | 'undefined' | 'all'
}
```

### Ported from xpath-parser

| Type string | Description |
|-------------|-------------|
| `num-normalize` | Normalize number strings |
| `url-resolve` | Resolve relative URLs |
| `extract-email` | Extract email address |
| `regex` | Apply regex replacement rules |
| `parse-as-url` | Parse URL (uses `baseUrl` if set) |
| `clean-html` | Strip HTML via libxmljs2 |
| `regex-extraction` | Regex extraction |
| `regex-extraction--page` | Regex extraction (page context) |
| `regex-extraction--url` | Regex extraction (URL context) |
| `regex-replace-x` | Regex replace (xpath variant) |
| `regex-replace--page` | Regex replace (page context) |
| `regex-replace--url` | Regex replace (URL context) |
| `extract-url-params` | Extract URL query params |
| `media-filter` | Filter media URLs |
| `query-append` | Append query string params |
| `json-path` | JSONPath extraction |
| `query-remover` | Remove query params |
| `query-remover--page` | Remove query params (page context) |
| `query-remover--url` | Remove query params (URL context) |
| `date-format-special` | Special date format handling |

## PipeConfig parameters (for custom[] entries)

```typescript
// Each entry in CleanerStepRules.custom is a plain object with a required `type` field:
{
  type: string;               // required — must match a PIPE_REGISTRY key
  // ... pipe-specific fields (flat on the object, not nested under params):
  pattern?: string;           // REGEX_REPLACE, REGEX_EXTRACT
  replacement?: string;       // REGEX_REPLACE
  flags?: string;             // REGEX_REPLACE
  format?: string;            // DATE_FORMAT
  timezone?: string;          // DATE_FORMAT
  locale?: string;            // DATE_FORMAT
  symbols?: string[];         // REMOVE_CURRENCY_SYMBOL
  decimals?: number;          // TO_NUMBER
  primaryPipes?: object[];    // ALT_FLAG
  fallbackPipes?: object[];   // ALT_FLAG
  fallbackOn?: string;        // ALT_FLAG
  [key: string]: unknown;     // any pipe-specific field
}
```

## Predefined Profiles

Pre-configured `CleanerStepRules` for common use cases:

```typescript
import { CleansingProfile } from '@hanivanrizky/nestjs-browser-action';

const result = await this.cleansingService.cleanseWithProfile(
  '  $29.99  ',
  CleansingProfile.PRICE
);
```

### Available Profiles

| Profile | Input example | Output |
|---------|--------------|--------|
| `PRICE` | `'  $29.99  '` | `'29.99'` |
| `PHONE` | `'+1 (555) 123-4567'` | `'+15551234567'` |
| `EMAIL` | `'  User@EXAMPLE.com  '` | `'user@example.com'` |
| `DATE` | `'January 15, 2024'` | `'2024-01-15'` |
| `CURRENCY` | `'$29.99'` | `'29.99'` |

## Creating Custom Pipes

Extend `CleansingPipe` and implement `exec()` plus a unique `type` string:

```typescript
import { CleansingPipe } from '@hanivanrizky/nestjs-browser-action';

export class ShoutPipe extends CleansingPipe<string, string> {
  type = 'shout';
  exec(value: string): string {
    return String(value).toUpperCase();
  }
}
```

Register it so it's resolvable by type string:

**Via module options (startup):**
```typescript
BrowserActionModule.forRoot({
  customPipes: { shout: ShoutPipe },
});
```

**Via CleansingService (programmatic):**
```typescript
this.cleansingService.registerPipe('shout', ShoutPipe);
// or bulk:
this.cleansingService.registerPipes({ shout: ShoutPipe, other: OtherPipe });
```

**Via PipeEngine (per-instance):**
```typescript
const engine = new PipeEngine();
engine.register('shout', ShoutPipe);
engine.apply('hello', { custom: [{ type: 'shout' }] }); // 'HELLO'
```

Registration silently overwrites an existing type (no throw).

Once registered, use it like any builtin:

```typescript
// In scrape():
{ pipes: { title: { custom: [{ type: 'shout' }] } } }

// In workflow cleanse action:
{ options: { pipes: { custom: [{ type: 'shout' }] } } }
```

## Security

### ReDoS Prevention

Regex pipes (`REGEX_REPLACE`, `REGEX_EXTRACT`) validate `pattern` against a ReDoS check. Patterns with nested quantifiers like `(a+)+` are rejected before compilation.

### Validation

Pipe configs are validated by `validatePipeConfigs()` when used in workflows:
- `type` must be present and a string
- `pattern` (if present) passes the ReDoS check
- Nested `primaryPipes`/`fallbackPipes` are validated recursively

## Examples

### E-commerce Price Cleansing

```typescript
const { price } = await this.actionHelpers.scrape(
  'https://shop.example.com/product',
  { price: '.product-price' },
  {
    pipes: {
      price: {
        trim: true,
        custom: [
          { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$', '€', '£'] },
          { type: CleansingType.TO_NUMBER, decimals: 2 },
        ],
      },
    },
  }
);
```

### Text Normalization

```typescript
const { content } = await this.actionHelpers.scrape(
  url,
  { content: '.content' },
  {
    pipes: {
      content: {
        trim: true,
        custom: [
          { type: CleansingType.REMOVE_LINE_BREAKS },
          { type: CleansingType.NORMALIZE_WHITESPACE },
          { type: CleansingType.SANITIZE_TEXT },
        ],
      },
    },
  }
);
```

### URL List Extraction

```typescript
const { links } = await this.actionHelpers.scrapeAll(
  url,
  { links: 'a[href]' },
  {
    pipes: {
      links: {
        trim: true,
        custom: [
          { type: CleansingType.REGEX_EXTRACT, pattern: '^/products/[\\w-]+' },
        ],
      },
    },
  }
);
```

### Regex Replace via replace rule

```typescript
const { text } = await this.actionHelpers.scrape(
  url,
  { text: '.content' },
  {
    pipes: {
      text: {
        trim: true,
        replace: [
          { from: '\\s+', to: ' ' },    // collapse whitespace
          { from: '[^\\w ]', to: '' },   // strip non-word chars
        ],
        toLowerCase: true,
      },
    },
  }
);
```

### Workflow: extract then cleanse

```typescript
const result = await this.actionHelpers.scrapeWithWorkflow(
  'https://example.com',
  {
    version: '1.0',
    actions: [
      { id: 'rawPrice', action: 'extract', target: { type: 'css', value: '.price' } },
      {
        id: 'price',
        action: 'cleanse',
        value: '${rawPrice}',
        options: {
          pipes: {
            trim: true,
            custom: [
              { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$'] },
              { type: CleansingType.TO_NUMBER, decimals: 2 },
            ],
          },
        },
      },
    ],
  }
);
// result.data.price → 29.99 (as string from PipeEngine; cast to Number() if needed)
```

## Related

- [`scrape()`](../methods/scrape.md) - With pipe options
- [`scrapeAll()`](../methods/scrape-all.md) - Multi-element with pipes
- [`CleansingService`](../api-reference.md#cleansingservice) - Direct pipe usage
- [Workflow Actions](../workflow-actions.md#cleanse-action) - Cleanse in workflows
- [CleansingType Enum](../api-reference.md#cleansingtype) - All pipe type strings
