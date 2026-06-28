import { Injectable, Scope } from '@nestjs/common';
import type { Browser, Page } from 'puppeteer-core';
import { BrowserManagerService } from './browser-manager.service';
import type { LogLevel } from '@nestjs/common';
import { LoggerWithLevel } from '../utils/logger.util';
import type { CloakOptions } from '../interfaces/browser-action-options';

export interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
}

@Injectable({ scope: Scope.TRANSIENT })
export class PageService {
  private readonly logger: LoggerWithLevel;
  private currentBrowser?: Browser;
  private currentPage?: Page;
  private dedicated = false;
  private intercepting = false;

  constructor(private readonly browserManager: BrowserManagerService) {
    this.logger = new LoggerWithLevel(
      PageService.name,
      this.browserManager.getLogLevel(),
    );
  }

  async createPage(
    cloak?: CloakOptions,
    interceptResource?: boolean,
  ): Promise<Page> {
    this.logger.debug('Creating new page');
    if (cloak) {
      this.currentBrowser =
        await this.browserManager.createDedicatedBrowser(cloak);
      this.dedicated = true;
    } else {
      this.currentBrowser = await this.browserManager.acquireBrowser();
      this.dedicated = false;
    }
    this.currentPage = await this.currentBrowser.newPage();
    this.intercepting = !!interceptResource;
    if (interceptResource) {
      await this.enableResourceInterception(this.currentPage);
    }
    return this.currentPage;
  }

  private async enableResourceInterception(page: Page): Promise<void> {
    const blocked = new Set(['stylesheet', 'image', 'media', 'font']);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.isInterceptResolutionHandled()) return;
      if (blocked.has(request.resourceType())) {
        void request.abort();
      } else {
        void request.continue();
      }
    });
  }

  async navigateTo(
    url: string,
    options?: NavigateOptions,
    cloak?: CloakOptions,
    interceptResource?: boolean,
  ): Promise<Page> {
    // Security: recreate page if cloak/intercept config changes to prevent
    // information leakage (wrong proxy, wrong stealth profile, wrong interception)
    const needsNewPage =
      !this.currentPage ||
      (cloak !== undefined && !this.dedicated) ||
      (cloak === undefined && this.dedicated) ||
      !!interceptResource !== this.intercepting;
    if (needsNewPage && this.currentPage) {
      await this.closePage();
    }
    if (!this.currentPage) {
      await this.createPage(cloak, interceptResource);
    }
    this.logger.debug(`Navigating to ${url}`);
    if (!this.currentPage) throw new Error('Failed to create page');

    const gotoOptions: {
      waitUntil?: NavigateOptions['waitUntil'];
      timeout?: number;
    } = {};
    if (options?.waitUntil) gotoOptions.waitUntil = options.waitUntil;
    if (options?.timeout !== undefined) gotoOptions.timeout = options.timeout;
    await this.currentPage.goto(
      url,
      Object.keys(gotoOptions).length ? gotoOptions : undefined,
    );
    return this.currentPage;
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
    this.intercepting = false;
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
