import { Injectable } from '@nestjs/common';
import type { Browser, Page, WaitForOptions } from 'puppeteer';
import { BrowserManagerService } from './browser-manager.service';
import type { LogLevel } from '@nestjs/common';
import { LoggerWithLevel } from '../helpers/logger.util';

@Injectable()
export class PageService {
  private readonly logger: LoggerWithLevel;
  private currentBrowser?: Browser;
  private currentPage?: Page;

  constructor(private readonly browserManager: BrowserManagerService) {
    this.logger = new LoggerWithLevel(
      PageService.name,
      this.browserManager.getLogLevel(),
    );
  }

  async createPage(): Promise<Page> {
    this.logger.log('Creating new page', 'debug');
    this.currentBrowser = await this.browserManager.getBrowser();
    this.currentPage = await this.currentBrowser.newPage();
    return this.currentPage;
  }

  async navigateTo(url: string, options?: WaitForOptions): Promise<Page> {
    if (!this.currentPage) {
      await this.createPage();
    }
    this.logger.log(`Navigating to ${url}`, 'debug');
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

  getLogLevel(): LogLevel {
    return this.logger.getLogLevel();
  }
}
