import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import type { Browser, LaunchOptions } from 'puppeteer';
import * as puppeteer from 'puppeteer';
import { BROWSER_ACTION_OPTIONS } from '../constants/browser-action.constants';
import type { BrowserActionOptions } from '../interfaces/browser-action-options';
import type { LogLevel } from '@nestjs/common';
import { LoggerWithLevel } from '../helpers/logger.util';

@Injectable()
export class BrowserPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: LoggerWithLevel;
  private pool: Browser[] = [];
  private available: Set<Browser> = new Set();
  private inUse: Set<Browser> = new Set();
  private launchOptions: LaunchOptions = {};
  private minSize: number = 2;
  private maxSize: number = 10;
  private currentIndex: number = 0;

  constructor(
    @Inject(BROWSER_ACTION_OPTIONS)
    private readonly options: BrowserActionOptions,
  ) {
    this.logger = new LoggerWithLevel(
      BrowserPoolService.name,
      options.logLevel || 'log',
    );
  }

  async onModuleInit() {
    this.launchOptions = this.options.launchOptions || {};
    this.minSize = this.options.pool?.min || 2;
    this.maxSize = this.options.pool?.max || 10;

    this.logger.log(
      `Initializing browser pool (min: ${this.minSize}, max: ${this.maxSize})`,
    );

    for (let i = 0; i < this.minSize; i++) {
      const browser = await this.createBrowser();
      this.pool.push(browser);
      this.available.add(browser);
    }

    this.logger.log(
      `Browser pool initialized with ${this.pool.length} browsers`,
    );
  }

  getLogLevel(): LogLevel {
    return this.logger.getLogLevel();
  }

  private async createBrowser(): Promise<Browser> {
    try {
      const browser = await puppeteer.launch(this.launchOptions);
      browser.on('disconnected', () => {
        this.logger.log('Browser disconnected', 'warn');
      });
      return browser;
    } catch (error) {
      this.logger.log('Failed to launch browser', 'error');
      throw error;
    }
  }

  async acquire(): Promise<Browser> {
    if (this.available.size === 0) {
      if (this.pool.length < this.maxSize) {
        const browser = await this.createBrowser();
        this.pool.push(browser);
        this.available.add(browser);
        this.inUse.add(browser);
        return browser;
      }
      await this.waitForAvailable();
    }

    const browser = this.getNextAvailable();
    this.available.delete(browser);
    this.inUse.add(browser);
    return browser;
  }

  private getNextAvailable(): Browser {
    const browsers = Array.from(this.available);
    const browser = browsers[this.currentIndex % browsers.length];
    this.currentIndex++;
    return browser;
  }

  private waitForAvailable(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.available.size > 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  release(browser: Browser): void {
    if (this.inUse.has(browser)) {
      this.inUse.delete(browser);
      this.available.add(browser);
    }
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  getAvailableCount(): number {
    return this.available.size;
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing all browsers in pool');
    await Promise.all(
      this.pool.map(async (browser) => {
        try {
          if (browser.isConnected()) {
            await browser.close();
          }
        } catch {
          this.logger.log('Error closing browser', 'error');
        }
      }),
    );
    this.pool = [];
    this.available.clear();
    this.inUse.clear();
  }
}
