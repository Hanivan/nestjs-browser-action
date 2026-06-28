/**
 * Examples for container-based field extraction and pagination
 * Covers: scrapeContainerFields(), scrapeContainer workflow action,
 *         extractPagination workflow action, interceptResource, useRandomUserAgent
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { BrowserActionModule, BrowserActionService } from '../index';
import type { ContainerDescriptor, WorkflowDefinition } from '../index';

@Module({
  imports: [
    BrowserActionModule.forRoot({
      launchOptions: { headless: process.env.HEADLESS !== 'false' },
      pool: { min: 1, max: 1 },
    }),
  ],
})
class AppModule {}

// ---------------------------------------------------------------------------
// Example 1: scrapeContainerFields() — basic list extraction
// ---------------------------------------------------------------------------
async function scrapeProductList(service: BrowserActionService) {
  interface Product {
    name: string;
    price: string;
    link: string;
  }

  const descriptor: ContainerDescriptor<Product> = {
    container: 'li[data-products="item"]',
    fields: {
      name: { selector: '.product-name' },
      price: { selector: '.product-price' },
      link: { selector: '.woocommerce-LoopProduct-link', attribute: 'href' },
    },
  };

  const { items } = await service.scrapeContainerFields<Product>(
    'https://www.scrapingcourse.com/ecommerce/',
    descriptor,
  );

  console.log(`Scraped ${items.length} products:`, items);
}

// ---------------------------------------------------------------------------
// Example 2: scrapeContainerFields() — XPath container with pagination
//
// Hacker News: each story is split across two sibling <tr> rows.
// The title row has class "athing submission"; the very next <tr> holds
// score / author / age / comments in .subtext. XPath lets us walk from the
// container row into its following sibling to reach those fields.
// Pagination: a single "More" link at the bottom (?p=2, ?p=3, …).
// ---------------------------------------------------------------------------
async function scrapeForumThreads(service: BrowserActionService) {
  interface Thread {
    title: string;
    author: string;
    score: string;
    comments: string;
  }

  const descriptor: ContainerDescriptor<Thread> = {
    // One container node per story — the title row
    container:
      '//tr[contains(@class,"athing") and contains(@class,"submission")]',
    fields: {
      // Title link text inside the title row
      title: { selector: './/span[@class="titleline"]/a[1]' },
      // Score, author and comments live in the NEXT sibling <tr>.subtext
      author: {
        selector: './/following-sibling::tr[1]//a[contains(@class,"hnuser")]',
      },
      score: {
        selector: './/following-sibling::tr[1]//span[contains(@class,"score")]',
      },
      comments: {
        selector:
          './/following-sibling::tr[1]//a[contains(@href,"item?id=")][last()]',
      },
    },
  };

  const { items } = await service.scrapeContainerFields<Thread>(
    'https://news.ycombinator.com/',
    descriptor,
    { interceptResource: true },
  );

  console.log(`Scraped ${items.length} HN threads`);
  items.slice(0, 3).forEach((t) => console.log(t));
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
      title: { selector: 'h2' },
      tags: { selector: '.tag', multiple: true }, // returns string[]
      imageUrl: {
        selector: 'img',
        attribute: 'src',
        fallback: ['img[data-src]'], // try data-src if src empty
      },
    },
  };

  const { items } = await service.scrapeContainerFields<Article>(
    'https://www.scrapingcourse.com/ecommerce/',
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
    container: 'li[data-products="item"]',
    fields: {
      title: { selector: '.product-name' },
      url: { selector: '.woocommerce-LoopProduct-link', attribute: 'href' },
    },
  };

  const { items } = await service.scrapeContainerFields<Item>(
    'https://www.scrapingcourse.com/ecommerce/',
    descriptor,
    { interceptResource: true }, // aborts stylesheet, image, media, font
  );

  console.log('Results (fast mode):', items);
}

// ---------------------------------------------------------------------------
// Example 5: useRandomUserAgent — rotate Chrome UA per call
// Table: https://www.scrapingcourse.com/table-parsing
// Rows are <tr class="product-item"> inside #product-catalog tbody
// ---------------------------------------------------------------------------
async function scrapeWithRandomUA(service: BrowserActionService) {
  interface Row {
    id: string;
    name: string;
    category: string;
    price: string;
    inStock: string;
  }

  const descriptor: ContainerDescriptor<Row> = {
    container: '#product-catalog tbody tr.product-item',
    fields: {
      id: { selector: '.product-id' },
      name: { selector: '.product-name' },
      category: { selector: '.product-category' },
      price: { selector: '.product-price' },
      inStock: { selector: '.product-stock' },
    },
  };

  const { items } = await service.scrapeContainerFields<Row>(
    'https://www.scrapingcourse.com/table-parsing',
    descriptor,
    { useRandomUserAgent: true }, // picks a random Chrome UA string each call
  );

  console.log('Table rows:', items);
}

// ---------------------------------------------------------------------------
// Example 6: workflow — scrapeContainer action
// Stores extracted items in context[action.id], pagination in context[id_pagination]
// ---------------------------------------------------------------------------
async function workflowScrapeContainer(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        action: 'waitFor',
        target: { type: 'css', value: 'li[data-products="item"]' },
        options: { timeout: 10000 },
      },
      {
        id: 'products',
        action: 'scrapeContainer',
        options: {
          container: 'li[data-products="item"]',
          fields: {
            name: { selector: '.product-name' },
            price: { selector: '.product-price' },
          },
          pagination: {
            container: 'nav.woocommerce-pagination',
            linkSelector: 'a.page-numbers',
            labelSelector: 'a.page-numbers',
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
  const result = await actionHelpers.scrapeWithWorkflow<{
    products?: unknown[];
    products_pagination?: { pages: unknown[]; nextUrl: string };
    pageTitle?: string;
  }>('https://www.scrapingcourse.com/ecommerce/', workflow);

  console.log('Products:', result.data.products);
  console.log('Next URL:', result.data.products_pagination?.nextUrl);
  console.log('Page title:', result.data.pageTitle);
}

// ---------------------------------------------------------------------------
// Example 7: workflow — extractPagination action (standalone, no container scrape)
// ---------------------------------------------------------------------------
async function workflowExtractPagination(actionHelpers: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    actions: [
      {
        id: 'pages',
        action: 'extractPagination',
        options: {
          container: 'nav.woocommerce-pagination',
          linkSelector: 'a.page-numbers',
          labelSelector: 'a.page-numbers',
          currentPage: 3, // currently on page 3 → nextUrl will be page 4
        },
      },
    ],
  };

  const result = await actionHelpers.scrapeWithWorkflow<{
    pages?: { pages: { label: string; url: string }[]; nextUrl: string };
  }>('https://www.scrapingcourse.com/ecommerce/page/3/', workflow);

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
      href: { selector: 'a', attribute: 'href' },
    },
    pagination: {
      container: 'nav.pager',
      linkSelector: 'a',
      labelSelector: 'a',
    },
  };

  const allItems: Item[] = [];
  let url: string | null = 'https://www.scrapingcourse.com/ecommerce/';
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

// ---------------------------------------------------------------------------
// Example 9: real WooCommerce shop — https://www.scrapingcourse.com/ecommerce/
//
// Products are in <li data-products="item">. Pagination uses a standard
// WooCommerce <nav class="woocommerce-pagination"> with numbered <a> links
// and an "→" next link. scrapeContainerFields() auto-detects the next URL
// via nextUrl when currentPage is supplied.
// ---------------------------------------------------------------------------
async function scrapeEcommerceShop(service: BrowserActionService) {
  interface Product {
    name: string;
    price: string;
    image: string;
    link: string;
  }

  const descriptor: ContainerDescriptor<Product> = {
    container: 'li[data-products="item"]',
    fields: {
      name: { selector: '.product-name' },
      price: { selector: '.product-price' },
      image: { selector: 'img.product-image', attribute: 'src' },
      link: {
        selector: '.woocommerce-LoopProduct-link',
        attribute: 'href',
      },
    },
    pagination: {
      container: 'nav.woocommerce-pagination',
      linkSelector: 'a.page-numbers',
      labelSelector: 'a.page-numbers',
    },
  };

  const allProducts: Product[] = [];
  let url: string | null = 'https://www.scrapingcourse.com/ecommerce/';
  let page = 1;

  while (url) {
    const { items, pagination } = await service.scrapeContainerFields<Product>(
      url,
      descriptor,
      { currentPage: page, interceptResource: true },
    );
    allProducts.push(...items);
    console.log(
      `Page ${page}: ${items.length} products (total: ${allProducts.length})`,
    );
    url = pagination?.nextUrl ?? null;
    page++;
  }

  console.log(
    `ecommerce shop: ${allProducts.length} products across ${page - 1} pages`,
  );
  return allProducts;
}

if (require.main === module) {
  void (async () => {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    const service = await app.resolve(BrowserActionService);
    try {
      await scrapeProductList(service);
      await scrapeForumThreads(service);
      await scrapeArticleTags(service);
      await scrapeWithInterception(service);
      await scrapeWithRandomUA(service);
      await workflowScrapeContainer(service);
      await workflowExtractPagination(service);
      await crawlAllPages(service);
      await scrapeEcommerceShop(service);
    } finally {
      await app.close();
    }
  })();
}
