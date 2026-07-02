import { NestFactory } from '@nestjs/core';
import { Injectable, Logger, Module } from '@nestjs/common';
import {
  BrowserActionModule,
  InjectPageController,
  PageController,
} from '../index';

/**
 * Example: Named browser + pages with PageController
 *
 * Demonstrates the v0.22+ recommended setup (vs. the deprecated pool):
 * 1. Register one named browser with `forRoot({ name })`
 * 2. Register two persistent pages on it with `forFeature`
 * 3. Inject each page's `PageController` and reuse it across calls —
 *    cookies/navigation state carry over, no open/close per scrape
 * 4. Run both pages CONCURRENTLY on the same browser — per-page CDP focus
 *    emulation means tabs don't contend for focus, so `Promise.all` works
 */
@Injectable()
class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    @InjectPageController('login', 'stealth')
    private readonly login: PageController,
    @InjectPageController('products', 'stealth')
    private readonly products: PageController,
  ) {}

  async run() {
    this.logger.log(
      'Starting run — browser: "stealth", pages: login, products',
    );

    const loginResult = await this.runLogin();
    const products = await this.runProductsScrape();
    const title = await this.runCurrentPageExtract();
    const concurrent = await this.runConcurrent();

    this.logger.log('Run complete');
    return { loginResult, products, title, concurrent };
  }

  /**
   * Both pages driven at the same time on ONE browser — the login page
   * re-runs its workflow while the products page scrapes. Per-page focus
   * emulation keeps both tabs active, so neither stalls waiting for focus.
   */
  private async runConcurrent() {
    this.logger.log(
      '[concurrent] login workflow + products scrape in parallel',
    );
    const startedAt = Date.now();

    try {
      const [loginResult, products] = await Promise.all([
        this.runLogin(),
        this.runProductsScrape(),
      ]);

      this.logger.log(
        `[concurrent] both done in ${Date.now() - startedAt}ms — login: "${loginResult.data.username}", products: ${products.results.length}`,
      );
      return { loginResult, products };
    } catch (err) {
      this.logger.error(
        `[concurrent] failed after ${Date.now() - startedAt}ms`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  private async runLogin() {
    this.logger.log('[login] navigating + running login workflow');
    const startedAt = Date.now();

    try {
      const loginResult = await this.login.scrapeWithWorkflow<{
        username: string;
      }>('https://www.scrapingcourse.com/login', {
        version: '1.0',
        actions: [
          {
            action: 'type',
            target: { type: 'css', value: '#email' },
            value: 'admin@example.com',
          },
          {
            action: 'type',
            target: { type: 'css', value: '#password' },
            value: 'password',
          },
          {
            action: 'click',
            target: { type: 'css', value: 'button[type="submit"]' },
            options: { waitForNavigation: true },
          },
          {
            id: 'username',
            action: 'extract',
            target: { type: 'css', value: 'span.text-lg.font-semibold' },
          },
        ],
      });

      this.logger.log(
        `[login] logged in as "${loginResult.data.username}" (${Date.now() - startedAt}ms)`,
      );
      return loginResult;
    } catch (err) {
      this.logger.error(
        `[login] workflow failed after ${Date.now() - startedAt}ms`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  private async runProductsScrape() {
    this.logger.log('[products] scraping product listing');
    const startedAt = Date.now();

    try {
      const products = await this.products.evaluateWebsite({
        url: 'https://www.scrapingcourse.com/ecommerce/',
        patterns: [
          {
            key: 'container',
            patternType: 'css',
            returnType: 'text',
            patterns: ['.product'],
            meta: { isContainer: true },
          },
          {
            key: 'name',
            patternType: 'css',
            returnType: 'text',
            patterns: ['h2.woocommerce-loop-product__title'],
            pipes: { trim: true },
          },
          {
            key: 'price',
            patternType: 'css',
            returnType: 'text',
            patterns: ['.price'],
            pipes: { trim: true },
          },
        ],
      });

      this.logger.log(
        `[products] found ${products.results.length} products (${Date.now() - startedAt}ms)`,
      );
      this.logger.debug(
        `[products] results: ${JSON.stringify(products.results, null, 2)}`,
      );
      return products;
    } catch (err) {
      this.logger.error(
        `[products] scrape failed after ${Date.now() - startedAt}ms`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  private async runCurrentPageExtract() {
    // Extract again from the SAME page without navigating — url unchanged
    this.logger.log(
      '[products] extracting <h1> from current page (no navigation)',
    );

    try {
      const title = await this.products.extract({ h1: 'h1' });
      this.logger.log(`[products] current page title: "${title.h1}"`);
      return title;
    } catch (err) {
      this.logger.error(
        '[products] extract failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}

@Module({
  imports: [
    BrowserActionModule.forRoot({
      name: 'stealth',
      // No backgrounding-disable launch flags needed — PageSession enables
      // per-page CDP focus emulation, so unfocused/background tabs never
      // throttle workflow execution.
      cloak: {
        headless: process.env.HEADLESS !== 'false',
      },
    }),
    BrowserActionModule.forFeature(['login', 'products'], 'stealth'),
  ],
  providers: [CrawlerService],
})
class AppModule {}

if (require.main === module) {
  void (async () => {
    const bootstrapLogger = new Logger('Bootstrap');
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });
    const crawler = app.get(CrawlerService);
    try {
      await crawler.run();
    } catch (err) {
      bootstrapLogger.error(
        'Run aborted',
        err instanceof Error ? err.stack : String(err),
      );
      process.exitCode = 1;
    } finally {
      await app.close();
    }
  })();
}
