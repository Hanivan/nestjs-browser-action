/**
 * Comprehensive example of scrapeWithWorkflow workflow system
 * This demonstrates all supported action types and features
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { BrowserActionModule, BrowserActionService } from '../index';
import type { WorkflowDefinition } from '../index';

@Module({
  imports: [
    BrowserActionModule.forRoot({
      launchOptions: { headless: process.env.HEADLESS !== 'false' },
      pool: { min: 1, max: 1 },
    }),
  ],
})
class AppModule {}

// Example 1: Simple data extraction
async function simpleExtraction(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'wait',
        value: 2, // Wait 2 seconds
      },
      {
        id: 'title',
        action: 'extract',
        target: { type: 'css', value: 'h1' },
      },
      {
        id: 'description',
        action: 'extract',
        target: { type: 'css', value: 'p' },
      },
    ],
  };

  const result = await actionHelpers.scrapeWithWorkflow<{
    title: string;
    description: string;
  }>('https://www.scrapingcourse.com/ecommerce/', workflow);

  console.log('Simple extraction result:', result.data);
}

// Example 2: Form automation with variable interpolation
async function formAutomation(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'navigate',
        value: '${baseUrl}', // Variable interpolation
      },
      {
        action: 'wait',
        value: 2,
      },
      {
        action: 'waitFor',
        target: { type: 'css', value: '#search-input' },
        options: { timeout: 10000 },
      },
      {
        action: 'type',
        target: { type: 'css', value: '#search-input' },
        value: '${searchQuery}',
        options: { delay: 50, scrollTo: true },
      },
      {
        action: 'click',
        target: { type: 'css', value: 'button[type="submit"]' },
        options: { scrollTo: true, waitForNavigation: true },
      },
      {
        action: 'waitFor',
        target: { type: 'css', value: '.search-results' },
        options: { timeout: 30000 },
      },
      {
        id: 'firstResult',
        action: 'extract',
        target: { type: 'css', value: '.search-result:first-child h3' },
      },
    ],
    onError: {
      screenshot: true,
      screenshotPath: './error-screenshot.png',
      continue: false,
    },
  };

  const result = await actionHelpers.scrapeWithWorkflow<{
    firstResult: string;
  }>('https://www.scrapingcourse.com/ecommerce/', workflow, {
    baseUrl: 'https://www.scrapingcourse.com/ecommerce/?s=hoodie',
    searchQuery: 'hoodie',
  });

  console.log('Form automation result:', result.data);
}

// Example 3: Complex workflow with conditional actions
async function conditionalWorkflow(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'navigate',
        value: '${baseUrl}',
      },
      {
        action: 'waitFor',
        target: { type: 'css', value: '#cookie-banner' },
        options: { timeout: 5000 },
      },
      // Conditional click - only if element exists
      {
        action: 'click',
        target: { type: 'css', value: '#accept-cookies' },
        condition: {
          ifExists: { type: 'css', value: '#accept-cookies' },
        },
        onError: 'continue', // Don't fail if element doesn't exist
      },
      {
        action: 'waitFor',
        target: { type: 'css', value: '.main-content' },
      },
      {
        action: 'scroll',
        target: { type: 'css', value: '.main-content' },
      },
      {
        id: 'mainHeading',
        action: 'extract',
        target: { type: 'css', value: 'h1' },
      },
      {
        id: 'pageContent',
        action: 'extract',
        target: { type: 'css', value: 'article' },
      },
    ],
  };

  const result = await actionHelpers.scrapeWithWorkflow<{
    mainHeading: string;
    pageContent: string;
  }>('https://www.scrapingcourse.com/ecommerce/', workflow, {
    baseUrl: 'https://www.scrapingcourse.com/ecommerce/',
  });

  console.log('Conditional workflow result:', result.data);
}

// Example 4: XPath selectors
async function xpathSelectors(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'wait',
        value: 1,
      },
      {
        id: 'titleByXPath',
        action: 'extract',
        target: { type: 'xpath', value: '//h1' },
      },
      {
        id: 'allParagraphs',
        action: 'extract',
        target: { type: 'xpath', value: '//p[1]' },
      },
    ],
  };

  const result = await actionHelpers.scrapeWithWorkflow<{
    titleByXPath: string;
    allParagraphs: string;
  }>('https://www.scrapingcourse.com/ecommerce/', workflow);

  console.log('XPath selectors result:', result.data);
}

// Example 5: JavaScript evaluation
async function javascriptEvaluation(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'wait',
        value: 1,
      },
      {
        id: 'pageHeight',
        action: 'evaluate',
        value: '() => document.body.scrollHeight',
      },
      {
        id: 'linkCount',
        action: 'evaluate',
        value: '() => document.querySelectorAll("a").length',
      },
      {
        id: 'currentUrl',
        action: 'evaluate',
        value: '() => window.location.href',
      },
    ],
  };

  const result = await actionHelpers.scrapeWithWorkflow<{
    pageHeight: number;
    linkCount: number;
    currentUrl: string;
  }>('https://www.scrapingcourse.com/ecommerce/', workflow);

  console.log('JavaScript evaluation result:', result.data);
}

// Example 6: Screenshot and debugging
async function screenshotDebugging(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'navigate',
        value: '${baseUrl}',
      },
      {
        action: 'wait',
        value: 2,
      },
      {
        action: 'screenshot',
        value: './debug-screenshot.png',
      },
      {
        id: 'title',
        action: 'extract',
        target: { type: 'css', value: 'h1' },
      },
    ],
  };

  const result = await actionHelpers.scrapeWithWorkflow<{
    title: string;
  }>('https://www.scrapingcourse.com/ecommerce/', workflow, {
    baseUrl: 'https://www.scrapingcourse.com/ecommerce/',
  });

  console.log('Screenshot debugging result:', result.data);
}

// Example 7: Dropdown selection
async function dropdownSelection(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'navigate',
        value: '${baseUrl}',
      },
      {
        action: 'waitFor',
        target: { type: 'css', value: 'select[name="country"]' },
        options: { timeout: 10000 },
      },
      {
        action: 'select',
        target: { type: 'css', value: 'select[name="country"]' },
        value: '${countryCode}',
        options: { scrollTo: true },
      },
      {
        action: 'wait',
        value: 1,
      },
      {
        action: 'screenshot',
        value: './after-selection.png',
      },
    ],
  };

  const result = await actionHelpers.scrapeWithWorkflow<{}>(
    'https://www.scrapingcourse.com/ecommerce/',
    workflow,
    {
      baseUrl: 'https://www.scrapingcourse.com/ecommerce/',
      countryCode: 'US',
    },
  );

  console.log('Dropdown selection completed:', result.success);
}

// Example 8: Shadow DOM support (if needed)
async function shadowDOMSupport(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'navigate',
        value: '${baseUrl}',
      },
      {
        action: 'waitFor',
        target: {
          type: 'css',
          value: 'my-web-component',
          shadowHost: 'my-web-component',
        },
        options: { timeout: 10000 },
      },
      {
        id: 'shadowContent',
        action: 'extract',
        target: {
          type: 'css',
          value: '.shadow-content',
          shadowHost: 'my-web-component',
        },
      },
    ],
  };

  const result = await actionHelpers.scrapeWithWorkflow<{
    shadowContent: string;
  }>('https://www.scrapingcourse.com/ecommerce/', workflow, {
    baseUrl: 'https://www.scrapingcourse.com/ecommerce/',
  });

  console.log('Shadow DOM result:', result.data);
}

// Example 9: Error handling with retry
async function errorHandlingWithRetry(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'navigate',
        value: '${baseUrl}',
      },
      {
        action: 'waitFor',
        target: { type: 'css', value: '.dynamic-content' },
        options: { timeout: 10000, retry: 3, retryDelay: 2000 },
      },
      {
        id: 'content',
        action: 'extract',
        target: { type: 'css', value: '.dynamic-content' },
      },
    ],
    onError: {
      screenshot: true,
      screenshotPath: './error-retry.png',
      continue: false,
    },
  };

  const result = await actionHelpers.scrapeWithWorkflow<{
    content: string;
  }>('https://www.scrapingcourse.com/ecommerce/', workflow, {
    baseUrl: 'https://www.scrapingcourse.com/ecommerce/',
  });

  if (result.success) {
    console.log('Content extracted:', result.data);
  } else {
    console.error('Extraction failed:', result.errors);
  }
}

// Example 10: Real-world e-commerce price scraping
async function ecommercePriceScraping(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'navigate',
        value: '${productUrl}',
      },
      {
        action: 'waitFor',
        target: { type: 'css', value: '.product_title' },
        options: { timeout: 15000 },
      },
      {
        action: 'scroll',
        target: { type: 'css', value: '.product_title' },
      },
      {
        id: 'productName',
        action: 'extract',
        target: { type: 'css', value: 'h1.product_title' },
      },
      {
        id: 'price',
        action: 'extract',
        target: { type: 'css', value: '.product-price' },
      },
      {
        id: 'availability',
        action: 'extract',
        target: { type: 'css', value: '.stock' },
      },
      {
        id: 'sku',
        action: 'extract',
        target: { type: 'css', value: '.sku' },
      },
      {
        action: 'screenshot',
        value: './product-screenshot.png',
      },
    ],
    onError: {
      screenshot: true,
      screenshotPath: './product-error.png',
      continue: false,
    },
  };

  const result = await actionHelpers.scrapeWithWorkflow<{
    productName: string;
    price: string;
    availability: string;
    sku: string;
  }>(
    'https://www.scrapingcourse.com/ecommerce/product/abominable-hoodie/',
    workflow,
    {
      productUrl:
        'https://www.scrapingcourse.com/ecommerce/product/abominable-hoodie/',
    },
  );

  console.log('E-commerce product data:', result.data);
}

if (require.main === module) {
  void (async () => {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    const service = await app.resolve(BrowserActionService);
    try {
      await simpleExtraction(service);
      await formAutomation(service);
      await conditionalWorkflow(service);
      await xpathSelectors(service);
      await javascriptEvaluation(service);
      await screenshotDebugging(service);
      await dropdownSelection(service);
      await shadowDOMSupport(service);
      await errorHandlingWithRetry(service);
      await ecommercePriceScraping(service);
    } finally {
      await app.close();
    }
  })();
}
