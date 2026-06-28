import { CleansingProfile } from '../enums/cleansing-profile.enum';
import type { CleanerStepRules } from '../pipes/pipe-engine';

/**
 * Options for single-field cleansing
 */
export interface CleansingOptions {
  pipes?: CleanerStepRules;
  profile?: CleansingProfile;
}

/**
 * Options for scrape() method with per-field cleansing
 */
export interface ScrapeCleansingOptions {
  pipes?: Record<string, CleanerStepRules>;
}
