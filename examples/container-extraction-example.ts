/**
 * Examples for container-based field extraction and pagination
 * Covers: scrapeContainerFields(), scrapeContainer workflow action,
 *         extractPagination workflow action, interceptResource, useRandomUserAgent
 */

import { BrowserActionService, ActionHelpersService } from '@hanivanrizky/nestjs-browser-action';
import type {
  ContainerDescriptor,
  WorkflowDefinition,
} from '@hanivanrizky/nestjs-browser-action';

// ---------------------------------------------------------------------------
// Example 1: scrapeContainerFields() — basic list extraction
// ---------------------------------------------------------------------------
async function scrapeProductList(service: BrowserActionService) {
  interface Product {
    name: string;
    price: string;
    rating: string;
  }

  const descriptor: ContainerDescriptor<Product> = {
    container: '.product-card',          // CSS: one node per product
    fields: {
      name:   { selector: 'h2.name' },
      price:  { selector: '.price' },
      rating: { selector: '.stars', attribute: 'data-score' },
    },
  };

  const { items } = await service.scrapeContainerFields<Product>(
    'https://example.com/products',
    descriptor,
  );

  console.log(`Scraped ${items.length} products:`, items);
}

// ---------------------------------------------------------------------------
// Example 2: scrapeContainerFields() — XPath container with pagination
// ---------------------------------------------------------------------------
async function scrapeForumThreads(service: BrowserActionService) {
  interface Thread {
    title: string;
    author: string;
    replies: string;
  }

  const descriptor: ContainerDescriptor<Thread> = {
    container: '//div[@class="thread-row"]',   // XPath container
    fields: {
      title:   { selector: './/a[@class="title"]' },
      author:  { selector: './/span[@class="author"]' },
      replies: { selector: './/span[@class="replies"]' },
    },
    pagination: {
      container:     '.pagination',
      linkSelector:  'a',
      labelSelector: 'a',   // label text is the link itself
    },
  };

  const { items, pagination } = await service.scrapeContainerFields<Thread>(
    'https://example.com/forum',
    descriptor,
    { currentPage: 1 },
  );

  console.log('Threads:', items);
  console.log('Next page URL:', pagination?.nextUrl);   // null when on last page
}

// ---------------------------------------------------------------------------
// Example 3: scrapeContainerFields() — multiple values per field + fallback
// ---------------------------------------------------------------------------
async function scrapeArticleTags(service: BrowserActionService) {
  interface Article {
    title: string;
    tags: string[];
    imageUrl: string;
  }

  const descriptor: ContainerDescriptor<Article> = {
    container: 'article.post',
    fields: {
      title:    { selector: 'h2' },
      tags:     { selector: '.tag', multiple: true },     // returns string[]
      imageUrl: {
        selector: 'img',
        attribute: 'src',
        fallback: ['img[data-src]'],                      // try data-src if src empty
      },
    },
  };

  const { items } = await service.scrapeContainerFields<Article>(
    'https://example.com/blog',
    descriptor,
  );

  items.forEach((a) => console.log(a.title, a.tags));
}

// ---------------------------------------------------------------------------
// Example 4: interceptResource — skip images/fonts/CSS for faster scraping
// ---------------------------------------------------------------------------
async function scrapeWithInterception(service: BrowserActionService) {
  interface Item {
    title: string;
    url: string;
  }

  const descriptor: ContainerDescriptor<Item> = {
    container: 'li.result',
    fields: {
      title: { selector: 'h3' },
      url:   { selector: 'a', attribute: 'href' },
    },
  };

  const { items } = await service.scrapeContainerFields<Item>(
    'https://example.com/search?q=nestjs',
    descriptor,
    { interceptResource: true },   // aborts stylesheet, image, media, font
  );

  console.log('Results (fast mode):', items);
}

// ---------------------------------------------------------------------------
// Example 5: useRandomUserAgent — rotate Chrome UA per call
// ---------------------------------------------------------------------------
async function scrapeWithRandomUA(service: BrowserActionService) {
  interface Row {
    name: string;
    value: string;
  }

  const descriptor: ContainerDescriptor<Row> = {
    container: 'table tr',
    fields: {
      name:  { selector: 'td:nth-child(1)' },
      value: { selector: 'td:nth-child(2)' },
    },
  };

  const { items } = await service.scrapeContainerFields<Row>(
    'https://example.com/data',
    descriptor,
    { useRandomUserAgent: true },   // picks a random Chrome UA string each call
  );

  console.log('Table rows:', items);
}

// ---------------------------------------------------------------------------
// Example 6: workflow — scrapeContainer action
// Stores extracted items in context[action.id], pagination in context[id_pagination]
// ---------------------------------------------------------------------------
async function workflowScrapeContainer(actionHelpers: ActionHelpersService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'waitFor',
        target: { type: 'css', value: '.product-card' },
        options: { timeout: 10000 },
      },
      {
        id: 'products',
        action: 'scrapeContainer',
        options: {
          container: '.product-card',
          fields: {
            name:  { selector: 'h2.name' },
            price: { selector: '.price' },
          },
          pagination: {
            container:     '.pagination',
            linkSelector:  'a',
            labelSelector: 'a',
          },
          currentPage: 1,
        },
      },
      {
        id: 'pageTitle',
        action: 'extract',
        target: { type: 'css', value: 'h1' },
      },
    ],
  };

  // context.products      → extracted items array
  // context.products_pagination → { pages, nextUrl }
  const result = await actionHelpers.scrapeWithActions(
    'https://example.com/shop',
    workflow,
  );

  console.log('Products:', result.data.products);
  console.log('Next URL:', result.data.products_pagination?.nextUrl);
  console.log('Page title:', result.data.pageTitle);
}

// ---------------------------------------------------------------------------
// Example 7: workflow — extractPagination action (standalone, no container scrape)
// ---------------------------------------------------------------------------
async function workflowExtractPagination(actionHelpers: ActionHelpersService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        id: 'pages',
        action: 'extractPagination',
        options: {
          container:     'nav.pagination',
          linkSelector:  'a[href]',
          labelSelector: 'a[href]',
          currentPage:   3,   // currently on page 3 → nextUrl will be page 4
        },
      },
    ],
  };

  const result = await actionHelpers.scrapeWithActions(
    'https://example.com/listings?page=3',
    workflow,
  );

  // result.data.pages = { pages: [{label, url}, ...], nextUrl: '...?page=4' }
  console.log('All pages:', result.data.pages?.pages);
  console.log('Next page:', result.data.pages?.nextUrl);
}

// ---------------------------------------------------------------------------
// Example 8: combine all options — multi-page crawl loop
// ---------------------------------------------------------------------------
async function crawlAllPages(service: BrowserActionService) {
  interface Item {
    title: string;
    href: string;
  }

  const descriptor: ContainerDescriptor<Item> = {
    container: 'ul.listings li',
    fields: {
      title: { selector: 'a' },
      href:  { selector: 'a', attribute: 'href' },
    },
    pagination: {
      container:     'nav.pager',
      linkSelector:  'a',
      labelSelector: 'a',
    },
  };

  const allItems: Item[] = [];
  let url: string | null = 'https://example.com/listings';
  let page = 1;

  while (url) {
    const { items, pagination } = await service.scrapeContainerFields<Item>(
      url,
      descriptor,
      { currentPage: page, interceptResource: true, useRandomUserAgent: true },
    );
    allItems.push(...items);
    url = pagination?.nextUrl ?? null;
    page++;
  }

  console.log(`Crawled ${allItems.length} items across ${page - 1} pages`);
}

export {
  scrapeProductList,
  scrapeForumThreads,
  scrapeArticleTags,
  scrapeWithInterception,
  scrapeWithRandomUA,
  workflowScrapeContainer,
  workflowExtractPagination,
  crawlAllPages,
};
