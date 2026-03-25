import { CleansingProfile } from '../enums/cleansing-profile.enum';

/**
 * Options for single-field cleansing
 */
export interface CleansingOptions {
  pipes?: any[];
  profile?: CleansingProfile;
}

/**
 * Options for altFlag (alternative fallback) cleansing
 * Executes fallbackPipes if primaryPipes result is empty/null/undefined
 */
export interface CleansingWithAltOptions {
  primaryPipes: any[];
  fallbackPipes: any[];
  fallbackOn?: 'empty' | 'null' | 'undefined' | 'all';
}

/**
 * Options for scrape() method with per-field cleansing
 */
export interface ScrapeCleansingOptions {
  pipes?: Record<string, any[]>;
}
