import { PuppeteerNodeLaunchOptions, BrowserContextOptions } from 'puppeteer';
import { PoolOptions } from './pool-options';

export interface BrowserActionOptions {
  launchOptions?: PuppeteerNodeLaunchOptions;
  contextOptions?: BrowserContextOptions;
  pool?: PoolOptions;
  multiContext?: boolean;
}
