import { Injectable, Logger } from '@nestjs/common';
import { Page, ScreenshotOptions, PDFOptions } from 'puppeteer';
import { PageService } from '../services/page-service';

@Injectable()
export class ActionHelpersService {
  private readonly logger = new Logger(ActionHelpersService.name);

  constructor(private readonly pageService: PageService) {}

  async takeScreenshot(
    url: string,
    path: string,
    options?: ScreenshotOptions,
  ): Promise<Buffer> {
    this.logger.debug(`Taking screenshot of ${url}`);
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
    this.logger.debug(`Generating PDF for ${url}`);
    const page = await this.pageService.navigateTo(url);
    const pdf = await page.pdf({ path, ...options });
    await this.pageService.closePage();
    return pdf;
  }

  async scrape<T extends Record<string, string>>(
    url: string,
    selectors: T,
  ): Promise<Partial<Record<keyof T, string>>> {
    this.logger.debug(`Scraping ${url}`);
    const page = await this.pageService.navigateTo(url);

    const result: Partial<Record<keyof T, string>> = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        const value = await page.$eval(selector, (el) => el.textContent);
        (result as Record<string, string>)[key] = value;
      } catch {
        this.logger.warn(`Failed to scrape ${selector}`);
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
    this.logger.debug(`Waiting for ${selector} on ${url}`);
    const page = await this.pageService.navigateTo(url);
    await page.waitForSelector(selector, { timeout });
    return page;
  }

  async evaluate<T = unknown>(
    url: string,
    script: string | (() => any),
  ): Promise<T> {
    this.logger.debug(`Evaluating script on ${url}`);
    const page = await this.pageService.navigateTo(url);
    const result = await page.evaluate(script as string);
    await this.pageService.closePage();
    return result as T;
  }
}
