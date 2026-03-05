import { Injectable, Logger } from '@nestjs/common';
import { Browser, Page, WaitForOptions } from 'puppeteer';
import { BrowserManagerService } from './browser-manager.service';

@Injectable()
export class PageService {
  private readonly logger = new Logger(PageService.name);
  private currentBrowser?: Browser;
  private currentPage?: Page;

  constructor(private readonly browserManager: BrowserManagerService) {}

  async createPage(): Promise<Page> {
    this.logger.debug('Creating new page');
    this.currentBrowser = await this.browserManager.getBrowser();
    this.currentPage = await this.currentBrowser.newPage();
    return this.currentPage;
  }

  async navigateTo(url: string, options?: WaitForOptions): Promise<Page> {
    if (!this.currentPage) {
      await this.createPage();
    }
    this.logger.debug(`Navigating to ${url}`);
    if (this.currentPage) {
      await this.currentPage.goto(url, options);
      return this.currentPage;
    }
    throw new Error('Failed to create page');
  }

  async closePage(): Promise<void> {
    if (this.currentPage) {
      await this.currentPage.close();
      this.currentPage = undefined;
    }
    if (this.currentBrowser) {
      this.browserManager.releaseBrowser(this.currentBrowser);
      this.currentBrowser = undefined;
    }
  }

  getCurrentPage(): Page | undefined {
    return this.currentPage;
  }

  getCurrentBrowser(): Browser | undefined {
    return this.currentBrowser;
  }
}
