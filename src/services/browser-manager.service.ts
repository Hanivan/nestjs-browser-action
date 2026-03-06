import { Injectable } from '@nestjs/common';
import type { Browser } from 'puppeteer';
import { BrowserPoolService } from './browser-pool.service';
import { LoggerWithLevel } from '../helpers/logger.util';
import type { LogLevel } from '@nestjs/common';

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
    this.logger.log('Acquiring browser from pool', 'debug');
    return await this.poolService.acquire();
  }

  releaseBrowser(browser: Browser): void {
    this.logger.log('Releasing browser to pool', 'debug');
    this.poolService.release(browser);
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
