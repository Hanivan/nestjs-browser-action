import { Injectable, Scope } from '@nestjs/common';
import type { Browser, Page, WaitForOptions } from 'puppeteer-core';
import { BrowserManagerService } from './browser-manager.service';
import type { LogLevel } from '@nestjs/common';
import { LoggerWithLevel } from '../utils/logger.util';
import type { CloakOptions } from '../interfaces/browser-action-options';

@Injectable({ scope: Scope.TRANSIENT })
export class PageService {
  private readonly logger: LoggerWithLevel;
  private currentBrowser?: Browser;
  private currentPage?: Page;
  private dedicated = false;

  constructor(private readonly browserManager: BrowserManagerService) {
    this.logger = new LoggerWithLevel(
      PageService.name,
      this.browserManager.getLogLevel(),
    );
  }

  async createPage(cloak?: CloakOptions): Promise<Page> {
    this.logger.debug('Creating new page');
    if (cloak) {
      this.currentBrowser =
        await this.browserManager.getDedicatedBrowser(cloak);
      this.dedicated = true;
    } else {
      this.currentBrowser = await this.browserManager.getBrowser();
      this.dedicated = false;
    }
    this.currentPage = await this.currentBrowser.newPage();
    return this.currentPage;
  }

  async navigateTo(
    url: string,
    options?: WaitForOptions,
    cloak?: CloakOptions,
  ): Promise<Page> {
    if (!this.currentPage) {
      await this.createPage(cloak);
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
      if (this.dedicated) {
        await this.browserManager.destroyDedicatedBrowser(this.currentBrowser);
      } else {
        this.browserManager.releaseBrowser(this.currentBrowser);
      }
      this.currentBrowser = undefined;
      this.dedicated = false;
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
