/**
 * Examples for the pipe system (CleanerStepRules / PipeEngine)
 *
 * All pipe configuration uses CleanerStepRules objects:
 *   { trim?, toLowerCase?, toUpperCase?, decode?, replace?, custom? }
 *
 * custom[] entries are plain objects with a required `type` string
 * matching a key in PIPE_REGISTRY.
 */

import {
  BrowserActionService,
  ActionHelpersService,
  CleansingService,
  PipeEngine,
  CleansingPipe,
  CleansingType,
  CleansingProfile,
  PIPE_REGISTRY,
} from '@hanivanrizky/nestjs-browser-action';
import type { CleanerStepRules } from '@hanivanrizky/nestjs-browser-action';

// ─── 1. scrape() with per-field CleanerStepRules ─────────────────────────────

async function scrapeWithPipes(service: BrowserActionService) {
  const data = await service.scrape(
    'https://example.com/product',
    {
      price: '.price',
      title: 'h1',
      description: '.description',
    },
    {
      pipes: {
        price: {
          trim: true,
          custom: [
            { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$', '€', '£', '¥'] },
            { type: CleansingType.REMOVE_SPECIAL_CHARS },
            { type: CleansingType.TO_NUMBER, decimals: 2 },
          ],
        },
        title: { trim: true, toLowerCase: true },
        description: {
          trim: true,
          custom: [
            { type: CleansingType.REMOVE_LINE_BREAKS },
            { type: CleansingType.NORMALIZE_WHITESPACE },
            { type: CleansingType.SANITIZE_TEXT },
          ],
        },
      },
    },
  );

  console.log('price:', data.price);       // e.g. "29.99"
  console.log('title:', data.title);       // e.g. "blue sneakers"
  console.log('description:', data.description);
}

// ─── 2. scrapeAll() with CleanerStepRules ────────────────────────────────────

async function scrapeAllWithPipes(service: BrowserActionService) {
  const data = await service.scrapeAll(
    'https://example.com/products',
    { prices: '.product-card .price' },
    {
      pipes: {
        prices: {
          trim: true,
          custom: [
            { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$'] },
          ],
        },
      },
    },
  );

  console.log('prices:', data.prices); // ['29.99', '15.50', ...]
}

// ─── 3. Workflow cleanse action ───────────────────────────────────────────────

async function workflowCleanse(actionHelpers: ActionHelpersService) {
  const result = await actionHelpers.scrapeWithActions(
    'https://example.com/product',
    {
      version: '1.0',
      actions: [
        {
          id: 'rawPrice',
          action: 'extract',
          target: { type: 'css', value: '.price' },
        },
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
        {
          id: 'rawTitle',
          action: 'extract',
          target: { type: 'css', value: 'h1' },
        },
        {
          id: 'title',
          action: 'cleanse',
          value: '${rawTitle}',
          options: {
            pipes: { trim: true, toLowerCase: true },
          },
        },
      ],
    },
  );

  console.log('price:', result.data.price);   // "29.99"
  console.log('title:', result.data.title);   // "blue sneakers"
}

// ─── 4. Workflow cleanse — array value (maps over each element) ───────────────

async function workflowCleanseArray(actionHelpers: ActionHelpersService) {
  const result = await actionHelpers.scrapeWithActions(
    'https://example.com/shop',
    {
      version: '1.0',
      actions: [
        {
          id: 'rawTags',
          action: 'evaluate',
          value: "() => [...document.querySelectorAll('.tag')].map(el => el.textContent)",
        },
        {
          id: 'tags',
          action: 'cleanse',
          value: '${rawTags}',
          options: {
            // When value is an array, PipeEngine.apply is mapped over each item
            pipes: { trim: true, toLowerCase: true },
          },
        },
      ],
    },
  );

  console.log('tags:', result.data.tags); // ['sale', 'new arrival', ...]
}

// ─── 5. PipeEngine used directly ─────────────────────────────────────────────

function pipeEngineDirectUsage() {
  const engine = new PipeEngine();

  // primitive rules
  const clean = engine.apply('  HELLO WORLD  ', { trim: true, toLowerCase: true });
  console.log(clean); // 'hello world'

  // replace rules
  const replaced = engine.apply('foo bar foo', {
    replace: [{ from: 'foo', to: 'baz' }],
  });
  console.log(replaced); // 'baz bar baz'

  // custom pipe
  const price = engine.apply('$29.99', {
    trim: true,
    custom: [
      { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$'] },
    ],
  });
  console.log(price); // '29.99'

  // with baseUrl for URL-aware pipes (e.g. parse-as-url)
  const url = engine.apply('/products/123', {
    custom: [{ type: 'parse-as-url' }],
  }, 'https://example.com');
  console.log(url); // 'https://example.com/products/123'
}

// ─── 6. CleansingService — buildPipes / cleanse (PipeConfig[] format) ─────────

function cleansingServiceUsage(cleansingService: CleansingService) {
  // buildPipes + cleanse still works for custom pipe chains
  const pipes = cleansingService.buildPipes([
    { type: CleansingType.TRIM },
    { type: CleansingType.NORMALIZE_WHITESPACE },
    { type: CleansingType.TO_LOWER_CASE },
  ]);
  const result = cleansingService.cleanse('  HELLO    WORLD  ', pipes);
  console.log(result); // 'hello world'
}

// ─── 7. Using predefined cleansing profiles ──────────────────────────────────

function cleansingProfiles(cleansingService: CleansingService) {
  const price = cleansingService.cleanseWithProfile('  $29.99  ', CleansingProfile.PRICE);
  console.log(price); // '29.99'

  const email = cleansingService.cleanseWithProfile('  User@EXAMPLE.com  ', CleansingProfile.EMAIL);
  console.log(email); // 'user@example.com'
}

// ─── 8. Custom pipe registration ─────────────────────────────────────────────

class ExclamationPipe extends CleansingPipe<string, string> {
  type = 'exclaim';
  exec(value: string): string { return `${String(value)}!`; }
}

function registerCustomPipe(cleansingService: CleansingService) {
  // Via CleansingService (adds to shared PIPE_REGISTRY)
  cleansingService.registerPipe('exclaim', ExclamationPipe);

  const pipes = cleansingService.buildPipes([{ type: 'exclaim' }]);
  console.log(cleansingService.cleanse('hello', pipes)); // 'hello!'
}

function registerOnPipeEngine() {
  // Via PipeEngine (adds to shared PIPE_REGISTRY)
  const engine = new PipeEngine();
  engine.register('exclaim', ExclamationPipe);

  const result = engine.apply('hello', { custom: [{ type: 'exclaim' }] });
  console.log(result); // 'hello!'
}

function registerViaPipeRegistry() {
  // Directly mutate PIPE_REGISTRY (used at module level)
  PIPE_REGISTRY['exclaim'] = ExclamationPipe;
}

// ─── 9. CleanerStepRules reused across multiple scrapes ──────────────────────

const priceRules: CleanerStepRules = {
  trim: true,
  custom: [
    { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$', '€', '£', '¥'] },
    { type: CleansingType.TO_NUMBER, decimals: 2 },
  ],
};

const titleRules: CleanerStepRules = { trim: true, toLowerCase: true };

async function reuseRules(service: BrowserActionService) {
  const product = await service.scrape(
    'https://example.com/product/1',
    { price: '.price', title: 'h1' },
    { pipes: { price: priceRules, title: titleRules } },
  );
  console.log(product);
}

// ─── 10. HTML entity decoding ─────────────────────────────────────────────────

async function decodeHtmlEntities(service: BrowserActionService) {
  const data = await service.scrape(
    'https://example.com',
    { text: '.encoded' },
    {
      pipes: {
        text: { decode: true, trim: true },
      },
    },
  );
  // '&lt;b&gt;Hello&lt;/b&gt;' → '<b>Hello</b>'
  console.log(data.text);
}

export {
  scrapeWithPipes,
  scrapeAllWithPipes,
  workflowCleanse,
  workflowCleanseArray,
  pipeEngineDirectUsage,
  cleansingServiceUsage,
  cleansingProfiles,
  registerCustomPipe,
  registerOnPipeEngine,
  registerViaPipeRegistry,
  reuseRules,
  decodeHtmlEntities,
};
