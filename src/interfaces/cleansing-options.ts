import { CleansingProfile } from '../enums/cleansing-profile.enum';
import type { PipeConfig } from './types';

/**
 * Options for single-field cleansing
 */
export interface CleansingOptions {
  pipes?: PipeConfig[];
  profile?: CleansingProfile;
}

/**
 * Options for altFlag (alternative fallback) cleansing
 * Executes fallbackPipes if primaryPipes result is empty/null/undefined
 */
export interface CleansingWithAltOptions {
  primaryPipes: PipeConfig[];
  fallbackPipes: PipeConfig[];
  fallbackOn?: 'empty' | 'null' | 'undefined' | 'all';
}

/**
 * Options for scrape() method with per-field cleansing
 */
export interface ScrapeCleansingOptions {
  pipes?: Record<string, PipeConfig[]>;
}
