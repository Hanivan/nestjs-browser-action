import type { Cookie } from 'puppeteer';

/**
 * Options for saving cookies
 */
export interface CookieSaveOptions<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  cookiesDir?: string;
  overwrite?: boolean;
  metadata?: TMetadata;
}

/**
 * Options for loading cookies
 */
export interface CookieLoadOptions {
  cookiesDir?: string;
  throwIfNotExists?: boolean;
}

/**
 * Saved cookie session data
 */
export interface CookieSession<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string;
  cookies: Cookie[];
  savedAt: Date;
  url?: string;
  metadata?: TMetadata;
}

/**
 * Cookie session info (for listing)
 */
export interface CookieSessionInfo<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string;
  savedAt: Date;
  cookieCount: number;
  url?: string;
  metadata?: TMetadata;
}

/**
 * Cookie session file structure (on disk)
 */
export interface CookieSessionFile<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string;
  cookies: Cookie[];
  savedAt: string;
  url?: string;
  metadata?: TMetadata;
}
