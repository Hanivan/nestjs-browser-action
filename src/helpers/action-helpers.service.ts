import { Injectable, Logger } from '@nestjs/common';
import type { Page, ScreenshotOptions, PDFOptions } from 'puppeteer';
import { PageService } from '../services/page-service';
import type { LogLevel } from '@nestjs/common';

@Injectable()
export class ActionHelpersService {
  private readonly logger = new Logger(ActionHelpersService.name);

  constructor(private readonly pageService: PageService) {}

  private shouldLog(level: LogLevel): boolean {
    const currentLevel = this.pageService.getLogLevel();
    const levels: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose'];
    const currentLevelIndex = levels.indexOf(currentLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex <= currentLevelIndex;
  }

  private log(message: string, level: LogLevel = 'log'): void {
    if (this.shouldLog(level)) {
      switch (level) {
        case 'error':
          this.logger.error(message);
          break;
        case 'warn':
          this.logger.warn(message);
          break;
        case 'debug':
          this.logger.debug(message);
          break;
        case 'verbose':
          this.logger.verbose(message);
          break;
        default:
          this.logger.log(message);
      }
    }
  }

  async takeScreenshot(
    url: string,
    path: string,
    options?: ScreenshotOptions,
  ): Promise<Buffer> {
    this.log(`Taking screenshot of ${url}`, 'debug');
    const page = await this.pageService.navigateTo(url);
    const result = await page.screenshot({ path, ...options });
    await this.pageService.closePage();
    return result as unknown as Buffer;
  }

  async generatePDF(
    url: string,
    path: string,
    options?: PDFOptions,
  ): Promise<Buffer> {
    this.log(`Generating PDF for ${url}`, 'debug');
    const page = await this.pageService.navigateTo(url);
    const pdf = await page.pdf({ path, ...options });
    await this.pageService.closePage();
    return Buffer.from(pdf);
  }

  async scrape<T extends Record<string, string>>(
    url: string,
    selectors: T,
  ): Promise<Partial<Record<keyof T, string>>> {
    this.log(`Scraping ${url}`, 'debug');
    const page = await this.pageService.navigateTo(url);

    const result: Partial<Record<keyof T, string>> = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        const value = await page.$eval(selector, (el) => el.textContent);
        (result as Record<string, string>)[key] = value;
      } catch {
        this.log(`Failed to scrape ${selector}`, 'warn');
        // Property remains undefined (optional in Partial type)
      }
    }

    await this.pageService.closePage();
    return result;
  }

  async waitForSelector(
    url: string,
    selector: string,
    timeout?: number,
  ): Promise<Page> {
    this.log(`Waiting for ${selector} on ${url}`, 'debug');
    const page = await this.pageService.navigateTo(url);
    await page.waitForSelector(selector, { timeout });
    return page;
  }

  async evaluate<T = unknown>(
    url: string,
    script: string | (() => any),
  ): Promise<T> {
    this.log(`Evaluating script on ${url}`, 'debug');
    const page = await this.pageService.navigateTo(url);
    const result = await page.evaluate(script as string);
    await this.pageService.closePage();
    return result as T;
  }
}
