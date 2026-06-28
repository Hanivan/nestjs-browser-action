/**
 * Pagination examples using evaluateWebsite()
 *
 * Targets:
 *   https://www.scrapingcourse.com/pagination        — url-increment / click-next
 *   https://www.scrapingcourse.com/button-click      — load-more
 *   https://www.scrapingcourse.com/infinite-scrolling — infinite-scroll
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { BrowserActionModule, BrowserActionService } from '../index';
import type { EvaluateOptions } from '../index';

@Module({
  imports: [
    BrowserActionModule.forRoot({
      launchOptions: { headless: process.env.HEADLESS !== 'false' },
      pool: { min: 1, max: 1 },
    }),
  ],
})
class AppModule {}

interface Product {
  name: string;
  price: string;
}

// ---------------------------------------------------------------------------
// Example 1: url-increment — navigate each page URL directly (recommended)
// The base URL is page 1; urlTemplate takes over from startPage (default: 2).
// ---------------------------------------------------------------------------
async function scrapeWithUrlIncrement(service: BrowserActionService) {
  const options: EvaluateOptions = {
    url: 'https://www.scrapingcourse.com/pagination',
    patterns: [
      {
        key: 'CONTAINER',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-item'],
        meta: { isContainer: true },
      },
      {
        key: 'name',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-name'],
        pipes: { trim: true },
      },
      {
        key: 'price',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-price'],
        pipes: { trim: true },
      },
    ],
    waitUntil: 'domcontentloaded',
    interceptResource: true,
    pagination: {
      type: 'url-increment',
      urlTemplate: 'https://www.scrapingcourse.com/pagination/{page}',
      startPage: 2,
      maxPages: 13,
      waitAfter: 500,
    },
  };

  const { results, totalPages } =
    await service.evaluateWebsite<Product>(options);
  console.log(
    `url-increment: ${results.length} products across ${totalPages} pages`,
  );
  return results;
}

// ---------------------------------------------------------------------------
// Example 2: click-next — click the "Next page" link after each scrape
// The .next-page anchor exists on every page except the last.
// ---------------------------------------------------------------------------
async function scrapeWithClickNext(service: BrowserActionService) {
  const options: EvaluateOptions = {
    url: 'https://www.scrapingcourse.com/pagination',
    patterns: [
      {
        key: 'CONTAINER',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-item'],
        meta: { isContainer: true },
      },
      {
        key: 'name',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-name'],
        pipes: { trim: true },
      },
      {
        key: 'price',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-price'],
        pipes: { trim: true },
      },
    ],
    waitUntil: 'domcontentloaded',
    interceptResource: true,
    pagination: {
      type: 'click-next',
      selector: 'a.next-page', // present on all pages except the last
      maxPages: 13,
      waitAfter: 800,
    },
  };

  const { results, totalPages } =
    await service.evaluateWebsite<Product>(options);
  console.log(
    `click-next: ${results.length} products across ${totalPages} pages`,
  );
  return results;
}

// ---------------------------------------------------------------------------
// Example 3: load-more — https://www.scrapingcourse.com/button-click
//
// The page starts with 12 items in #product-grid. Clicking #load-more-btn
// fetches more via /ajax/products?offset=N and appends them in-place.
// The button hides itself (display:none) when there are no more items.
// load-more scrapes the full accumulated DOM after each click, collecting
// only the net-new items beyond what was already gathered.
// ---------------------------------------------------------------------------
async function scrapeWithLoadMore(service: BrowserActionService) {
  const options: EvaluateOptions = {
    url: 'https://www.scrapingcourse.com/button-click',
    patterns: [
      {
        key: 'CONTAINER',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-item'],
        meta: { isContainer: true },
      },
      {
        key: 'name',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-name'],
        pipes: { trim: true },
      },
      {
        key: 'price',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-price'],
        pipes: { trim: true },
      },
    ],
    waitUntil: 'domcontentloaded',
    interceptResource: true,
    pagination: {
      type: 'load-more',
      selector: '#load-more-btn', // hides itself (display:none) when exhausted
      maxPages: 20,
      waitAfter: 1000, // wait for AJAX to append new HTML
    },
  };

  const { results, totalPages } =
    await service.evaluateWebsite<Product>(options);
  console.log(
    `load-more: ${results.length} products after ${totalPages} click(s)`,
  );
  return results;
}

// ---------------------------------------------------------------------------
// Example 4: infinite-scroll — https://www.scrapingcourse.com/infinite-scrolling
//
// An IntersectionObserver watches #sentinel (a skeleton-card placeholder) and
// #end-of-page. When either enters the viewport, it fetches more products and
// appends them to #product-grid, then hides #sentinel again.
//
// Strategy: scroll to #sentinel each iteration so it enters the viewport and
// triggers the observer. Stop when item count stops growing (the observer
// unregisters itself and #sentinel stays hidden, so no new items arrive).
// ---------------------------------------------------------------------------
async function scrapeWithInfiniteScroll(service: BrowserActionService) {
  const options: EvaluateOptions = {
    url: 'https://www.scrapingcourse.com/infinite-scrolling',
    patterns: [
      {
        key: 'CONTAINER',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-item'],
        meta: { isContainer: true },
      },
      {
        key: 'name',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-name'],
        pipes: { trim: true },
      },
      {
        key: 'price',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product-price'],
        pipes: { trim: true },
      },
    ],
    waitUntil: 'domcontentloaded',
    interceptResource: true,
    pagination: {
      type: 'infinite-scroll',
      selector: '#sentinel', // scroll this into view to trigger IntersectionObserver
      maxPages: 30,
      waitAfter: 1200, // wait for fetch + DOM append after scroll
    },
  };

  const { results, totalPages } =
    await service.evaluateWebsite<Product>(options);
  console.log(
    `infinite-scroll: ${results.length} products after ${totalPages} scroll(s)`,
  );
  return results;
}

if (require.main === module) {
  void (async () => {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    const service = await app.resolve(BrowserActionService);
    try {
      await scrapeWithUrlIncrement(service);
      await scrapeWithClickNext(service);
      await scrapeWithLoadMore(service);
      await scrapeWithInfiniteScroll(service);
    } finally {
      await app.close();
    }
  })();
}
