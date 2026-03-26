import type { LogLevel } from '@nestjs/common';
import type { BrowserContextOptions, LaunchOptions } from 'puppeteer';
import { PoolOptions } from './pool-options';

/**
 * Cookie persistence options
 */
export interface CookieOptions {
  enabled?: boolean;
  cookiesDir?: string;
  autoSave?: boolean;
  autoLoad?: boolean;
  defaultSessionName?: string;
}

/**
 * Remote Chrome CDP connection options
 */
export interface RemoteOptions {
  /**
   * Chrome DevTools Protocol URL (e.g., 'http://localhost:9222')
   * Either browserURL or browserWSEndpoint must be provided
   */
  browserURL?: string;

  /**
   * Chrome DevTools Protocol WebSocket endpoint
   * (e.g., 'ws://localhost:9222/devtools/page/123')
   * Either browserURL or browserWSEndpoint must be provided
   */
  browserWSEndpoint?: string;

  /**
   * Maximum number of connection retry attempts
   * @default 3
   */
  retryMax?: number;

  /**
   * Delay between retry attempts in milliseconds
   * @default 1000
   */
  retryDelay?: number;
}

export interface BrowserActionOptions {
  launchOptions?: LaunchOptions;
  contextOptions?: BrowserContextOptions;
  pool?: PoolOptions;
  multiContext?: boolean;
  logLevel?: LogLevel;

  // Remote CDP connection options
  remote?: RemoteOptions;

  // Cookie persistence options
  cookies?: CookieOptions;
}
