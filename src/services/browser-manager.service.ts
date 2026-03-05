import { Injectable, Logger } from '@nestjs/common';
import { Browser } from 'puppeteer';
import { BrowserPoolService } from './browser-pool.service';

@Injectable()
export class BrowserManagerService {
  private readonly logger = new Logger(BrowserManagerService.name);

  constructor(private readonly poolService: BrowserPoolService) {}

  async getBrowser(): Promise<Browser> {
    this.logger.debug('Acquiring browser from pool');
    return await this.poolService.acquire();
  }

  releaseBrowser(browser: Browser): void {
    this.logger.debug('Releasing browser to pool');
    this.poolService.release(browser);
  }

  getPoolStatus(): { size: number; available: number } {
    return {
      size: this.poolService.getPoolSize(),
      available: this.poolService.getAvailableCount(),
    };
  }
}
