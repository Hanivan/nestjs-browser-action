import type { LogLevel } from '@nestjs/common';
import type { BrowserContextOptions, LaunchOptions } from 'puppeteer-core';
import type { LaunchOptions as CloakLaunchOptions } from 'cloakbrowser';
import { PoolOptions } from './pool-options';
import type { CleansingPipe } from '../pipes/cleansing-pipe';

/**
 * CloakBrowser stealth launch options for local browsers.
 * Extends CloakBrowser's launch options with an optional persistent profile dir.
 * `userDataDir` routes the launch through `launchPersistentContext`.
 */
export type CloakOptions = CloakLaunchOptions & {
  userDataDir?: string;
};

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
  /**
   * Raw puppeteer-core launch options, forwarded to CloakBrowser's
   * `launchOptions` passthrough. Use `cloak` for stealth/anti-detect features.
   */
  launchOptions?: LaunchOptions;

  /**
   * CloakBrowser stealth launch options for local browsers: proxy, humanize,
   * geoip, timezone, locale, stealthArgs, extensionPaths, userDataDir, etc.
   * Ignored when `remote` is set (remote uses CDP connect).
   */
  cloak?: CloakOptions;

  contextOptions?: BrowserContextOptions;
  pool?: PoolOptions;
  multiContext?: boolean;
  logLevel?: LogLevel;

  /**
   * Maximum character length for debug log messages before truncation.
   * Useful for keeping logs readable when extracting large HTML or long values.
   * @default 250
   */
  debugLogMaxLength?: number;

  // Remote CDP connection options
  remote?: RemoteOptions;

  // Cookie persistence options
  cookies?: CookieOptions;

  /**
   * Custom cleansing pipes keyed by their `type` string. Registered on the
   * CleansingService at startup so config-driven paths (scrape `pipes`,
   * workflow `cleanse` actions) can resolve these types. A type clashing with
   * a builtin or another custom pipe throws at registration.
   */
  customPipes?: Record<string, new (...args: unknown[]) => CleansingPipe>;
}
