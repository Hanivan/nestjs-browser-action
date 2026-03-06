import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
} from '@nestjs/common';
import type { Browser, LaunchOptions } from 'puppeteer';
import * as puppeteer from 'puppeteer';
import { BROWSER_ACTION_OPTIONS } from '../constants/browser-action.constants';
import type { BrowserActionOptions } from '../interfaces/browser-action-options';
import type { LogLevel } from '@nestjs/common';

@Injectable()
export class BrowserPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name);
  private pool: Browser[] = [];
  private available: Set<Browser> = new Set();
  private inUse: Set<Browser> = new Set();
  private launchOptions: LaunchOptions = {};
  private minSize: number = 2;
  private maxSize: number = 10;
  private currentIndex: number = 0;
  private logLevel: LogLevel = 'log';

  constructor(
    @Inject(BROWSER_ACTION_OPTIONS)
    private readonly options: BrowserActionOptions,
  ) {}

  async onModuleInit() {
    this.launchOptions = this.options.launchOptions || {};
    this.minSize = this.options.pool?.min || 2;
    this.maxSize = this.options.pool?.max || 10;
    this.logLevel = this.options.logLevel || 'log';

    this.log(
      `Initializing browser pool (min: ${this.minSize}, max: ${this.maxSize})`,
      'log',
    );

    for (let i = 0; i < this.minSize; i++) {
      const browser = await this.createBrowser();
      this.pool.push(browser);
      this.available.add(browser);
    }

    this.log(
      `Browser pool initialized with ${this.pool.length} browsers`,
      'log',
    );
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
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

  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  private async createBrowser(): Promise<Browser> {
    try {
      const browser = await puppeteer.launch(this.launchOptions);
      browser.on('disconnected', () => {
        this.logger.warn('Browser disconnected');
      });
      return browser;
    } catch (error) {
      this.logger.error('Failed to launch browser', error);
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

  private async waitForAvailable(): Promise<void> {
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
        } catch (error) {
          this.logger.error('Error closing browser', error);
        }
      }),
    );
    this.pool = [];
    this.available.clear();
    this.inUse.clear();
  }
}
