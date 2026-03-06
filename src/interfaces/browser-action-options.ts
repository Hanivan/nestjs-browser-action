import type { LogLevel } from '@nestjs/common';
import type { BrowserContextOptions, LaunchOptions } from 'puppeteer';
import { PoolOptions } from './pool-options';

export interface BrowserActionOptions {
  launchOptions?: LaunchOptions;
  contextOptions?: BrowserContextOptions;
  pool?: PoolOptions;
  multiContext?: boolean;
  logLevel?: LogLevel;
}
