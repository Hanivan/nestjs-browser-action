import { Injectable, Logger } from '@nestjs/common';
import type { Browser } from 'puppeteer';
import { BrowserPoolService } from './browser-pool.service';
import type { LogLevel } from '@nestjs/common';

@Injectable()
export class BrowserManagerService {
  private readonly logger = new Logger(BrowserManagerService.name);

  constructor(private readonly poolService: BrowserPoolService) {}

  private shouldLog(level: LogLevel): boolean {
    const currentLevel = this.poolService.getLogLevel();
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

  async getBrowser(): Promise<Browser> {
    this.log('Acquiring browser from pool', 'debug');
    return await this.poolService.acquire();
  }

  releaseBrowser(browser: Browser): void {
    this.log('Releasing browser to pool', 'debug');
    this.poolService.release(browser);
  }

  getPoolStatus(): { size: number; available: number } {
    return {
      size: this.poolService.getPoolSize(),
      available: this.poolService.getAvailableCount(),
    };
  }

  getLogLevel(): LogLevel {
    return this.poolService.getLogLevel();
  }
}
