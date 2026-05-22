import { Injectable } from '@nestjs/common';
import type { Browser } from 'puppeteer-core';
import { BrowserPoolService } from './browser-pool.service';
import { LoggerWithLevel } from '../helpers/logger.util';
import type { LogLevel } from '@nestjs/common';
import type { CloakOptions } from '../interfaces/browser-action-options';

@Injectable()
export class BrowserManagerService {
  private readonly logger: LoggerWithLevel;

  constructor(private readonly poolService: BrowserPoolService) {
    this.logger = new LoggerWithLevel(
      BrowserManagerService.name,
      this.poolService.getLogLevel(),
    );
  }

  async getBrowser(): Promise<Browser> {
    this.logger.debug('Acquiring browser from pool');
    return await this.poolService.acquire();
  }

  releaseBrowser(browser: Browser): void {
    this.logger.debug('Releasing browser to pool');
    this.poolService.release(browser);
  }

  async getDedicatedBrowser(cloak?: CloakOptions): Promise<Browser> {
    this.logger.debug('Acquiring dedicated browser (per-call cloak override)');
    return await this.poolService.createDedicatedBrowser(cloak);
  }

  async destroyDedicatedBrowser(browser: Browser): Promise<void> {
    this.logger.debug('Destroying dedicated browser');
    await this.poolService.destroyDedicatedBrowser(browser);
  }

  getPoolStatus(): { size: number; available: number } {
    return {
      size: this.poolService.getPoolSize(),
      available: this.poolService.getAvailableCount(),
    };
  }

  getLogLevel(): LogLevel {
    return this.logger.getLogLevel();
  }
}
