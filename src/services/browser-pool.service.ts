import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import type { Browser, LaunchOptions } from 'puppeteer';
import * as puppeteer from 'puppeteer';
import {
  AVAILABILITY_CHECK_INTERVAL_MS,
  BROWSER_ACTION_OPTIONS,
  DEFAULT_POOL_OPTIONS,
  DEFAULT_REMOTE_OPTIONS,
  ERROR_MESSAGES,
} from '../constants/browser-action.constants';
import type {
  BrowserActionOptions,
  RemoteOptions,
} from '../interfaces/browser-action-options';
import type { LogLevel } from '@nestjs/common';
import { LoggerWithLevel } from '../helpers/logger.util';
import { delay } from '../helpers/delay.util';

@Injectable()
export class BrowserPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: LoggerWithLevel;
  private pool: Browser[] = [];
  private available: Set<Browser> = new Set();
  private inUse: Set<Browser> = new Set();
  private disconnectListeners = new Map<Browser, () => void>();
  private launchOptions: LaunchOptions = {};
  private minSize: number = DEFAULT_POOL_OPTIONS.min;
  private maxSize: number = DEFAULT_POOL_OPTIONS.max;
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
    this.minSize = this.options.pool?.min || DEFAULT_POOL_OPTIONS.min;
    this.maxSize = this.options.pool?.max || DEFAULT_POOL_OPTIONS.max;

    // Validate remote options
    this.validateRemoteOptions(this.options.remote);

    const remote = this.options.remote;
    if (remote?.browserURL) {
      this.logger.log(
        `Browser mode: Remote CDP (browserURL: ${remote.browserURL})`,
      );
    } else if (remote?.browserWSEndpoint) {
      this.logger.log(
        `Browser mode: Remote CDP (WebSocket: ${remote.browserWSEndpoint})`,
      );
    } else {
      this.logger.log('Browser mode: Local Puppeteer');
    }

    this.logger.warn(
      'Call app.enableShutdownHooks() in main.ts to ensure graceful browser cleanup on Ctrl+C',
    );

    this.logger.log(
      `Initializing browser pool (min: ${this.minSize}, max: ${this.maxSize})`,
    );

    // Create browsers in parallel for faster initialization
    const browsers = await Promise.all(
      Array.from({ length: this.minSize }, () => this.createBrowser()),
    );

    browsers.forEach((browser) => {
      this.pool.push(browser);
      this.available.add(browser);
    });

    this.logger.log(
      `Browser pool initialized with ${this.pool.length} browsers`,
    );
  }

  getLogLevel(): LogLevel {
    return this.logger.getLogLevel();
  }

  private validateRemoteOptions(remote?: RemoteOptions): void {
    if (!remote) return;

    const hasURL = !!remote.browserURL;
    const hasWSEndpoint = !!remote.browserWSEndpoint;

    if (hasURL && hasWSEndpoint) {
      throw new Error(ERROR_MESSAGES.REMOTE_BOTH_PROVIDED);
    }

    if (!hasURL && !hasWSEndpoint) {
      throw new Error(ERROR_MESSAGES.REMOTE_NONE_PROVIDED);
    }
  }

  private async createBrowser(): Promise<Browser> {
    if (this.options.remote) {
      return await this.connectWithRetry(this.options.remote);
    }

    const browser = await puppeteer.launch(this.launchOptions);
    const disconnectHandler = () => {
      this.logger.warn('Browser disconnected');
    };
    browser.on('disconnected', disconnectHandler);
    this.disconnectListeners.set(browser, disconnectHandler);
    return browser;
  }

  private async connectWithRetry(
    remoteOptions: RemoteOptions,
  ): Promise<Browser> {
    const {
      browserURL,
      browserWSEndpoint,
      retryMax = DEFAULT_REMOTE_OPTIONS.retryMax,
      retryDelay = DEFAULT_REMOTE_OPTIONS.retryDelay,
    } = remoteOptions;

    const connectOptions: { browserURL?: string; browserWSEndpoint?: string } =
      {};
    if (browserURL) {
      connectOptions.browserURL = browserURL;
    } else if (browserWSEndpoint) {
      connectOptions.browserWSEndpoint = browserWSEndpoint;
    }

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryMax; attempt++) {
      try {
        this.logger.debug(
          `Connecting to remote Chrome (attempt ${attempt}/${retryMax})`,
        );

        const browser = await puppeteer.connect(connectOptions);

        const disconnectHandler = () => {
          this.logger.warn('Remote Chrome disconnected');
        };
        browser.on('disconnected', disconnectHandler);
        this.disconnectListeners.set(browser, disconnectHandler);

        this.logger.debug('Successfully connected to remote Chrome');
        return browser;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Connection attempt ${attempt}/${retryMax} failed: ${lastError.message}`,
        );

        if (attempt < retryMax) {
          await delay(retryDelay);
        }
      }
    }

    throw new Error(
      `Failed to connect to remote Chrome after ${retryMax} attempts: ${lastError?.message}`,
    );
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
      }, AVAILABILITY_CHECK_INTERVAL_MS);
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
    const isRemote = !!this.options.remote;
    this.logger.log(
      isRemote
        ? 'Disconnecting all remote CDP browsers'
        : 'Closing all local browsers',
    );

    await Promise.all(
      this.pool.map(async (browser) => {
        try {
          const handler = this.disconnectListeners.get(browser);
          if (handler) {
            browser.off('disconnected', handler);
            this.disconnectListeners.delete(browser);
          }

          if (browser.connected) {
            if (isRemote) {
              // CDP: disconnect only — do not kill the remote Chrome process
              await browser.disconnect();
            } else {
              // Local: close the browser and all its pages
              await browser.close();
            }
          }
        } catch {
          this.logger.error('Error during browser cleanup');
        }
      }),
    );

    this.pool = [];
    this.available.clear();
    this.inUse.clear();
    this.disconnectListeners.clear();
    this.logger.log('Browser pool shut down');
  }
}
