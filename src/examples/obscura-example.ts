/**
 * Obscura backend: connect the pool to a self-managed Obscura CDP server.
 * Start it first:  obscura serve --port 9222 --stealth
 * Then run:        pnpm test:examples <n>   (OBSCURA_WS overrides the endpoint)
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { BrowserActionModule, BrowserActionService } from '../index';
import type { WorkflowDefinition } from '../index';

const endpoint =
  process.env.OBSCURA_WS ?? 'ws://127.0.0.1:9222/devtools/browser';

@Module({
  imports: [
    BrowserActionModule.forRoot({
      // Each pool slot is its own CDP connection to the same server.
      remote: { browserWSEndpoint: endpoint },
      pool: { min: 3, max: 3 },
    }),
  ],
})
class AppModule {}

// Example 1: concurrent scrapes — one server, three connections.
async function concurrentScrape(service: BrowserActionService) {
  const urls = [
    'https://quotes.toscrape.com/',
    'https://quotes.toscrape.com/page/2/',
    'https://books.toscrape.com/',
    'https://example.com/',
  ];
  const started = Date.now();
  // networkidle* never resolves on Obscura — use load/domcontentloaded.
  const results = await Promise.all(
    urls.map((url) =>
      service.scrapeAll(url, { title: 'title' }, { waitUntil: 'load' }),
    ),
  );
  urls.forEach((url, i) => console.log(url, '→', results[i].title?.[0]));
  console.log(`Concurrent scrape: ${Date.now() - started}ms`);
}

// Example 2: workflow with ghost cursor clicks.
async function checkboxWorkflow(service: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    cursor: 'ghost',
    actions: [
      { action: 'waitFor', target: { type: 'css', value: '#myCheckbox' } },
      { action: 'click', target: { type: 'css', value: '#myCheckbox' } },
      {
        id: 'checked',
        action: 'evaluate',
        value: `() => document.querySelector('#myCheckbox').checked`,
      },
    ],
  };

  const result = await service.scrapeWithWorkflow<{ checked: boolean }>(
    'https://qaautomationlabs.com/testing/checkbox.php',
    workflow,
  );
  console.log('Checkbox checked:', result.data.checked);
}

if (require.main === module) {
  void (async () => {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    const service = await app.resolve(BrowserActionService);
    try {
      await concurrentScrape(service);
      await checkboxWorkflow(service);
    } finally {
      // Remote mode disconnects only — the Obscura server keeps running.
      await app.close();
    }
  })();
}
