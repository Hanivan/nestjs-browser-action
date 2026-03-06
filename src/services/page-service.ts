import { Injectable, Logger } from '@nestjs/common';
import type { Browser, Page, WaitForOptions } from 'puppeteer';
import { BrowserManagerService } from './browser-manager.service';
import type { LogLevel } from '@nestjs/common';

@Injectable()
export class PageService {
  private readonly logger = new Logger(PageService.name);
  private currentBrowser?: Browser;
  private currentPage?: Page;

  constructor(private readonly browserManager: BrowserManagerService) {}

  private shouldLog(level: LogLevel): boolean {
    const currentLevel = this.browserManager.getLogLevel();
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

  async createPage(): Promise<Page> {
    this.log('Creating new page', 'debug');
    this.currentBrowser = await this.browserManager.getBrowser();
    this.currentPage = await this.currentBrowser.newPage();
    return this.currentPage;
  }

  async navigateTo(url: string, options?: WaitForOptions): Promise<Page> {
    if (!this.currentPage) {
      await this.createPage();
    }
    this.log(`Navigating to ${url}`, 'debug');
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
    return this.browserManager.getLogLevel();
  }
}
