import { IsOptional, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Removes special characters from strings
 */
export class RemoveSpecialCharsPipe extends CleansingPipe<string, string> {
  type = CleansingType.REMOVE_SPECIAL_CHARS;

  @IsOptional()
  @IsString()
  allowedChars?: string;

  exec(value: string): string {
    if (typeof value !== 'string') {
      return value;
    }

    let result = value;

    if (this.allowedChars) {
      // Build a proper character class by escaping all special characters
      const escaped = this.allowedChars
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/-/g, '\\-'); // Escape dash too

      const regex = new RegExp(`[^a-zA-Z0-9${escaped}]`, 'g');
      result = result.replace(regex, '');
    } else {
      // Default: remove all special characters except alphanumeric and spaces
      // Include Unicode letters for international support
      result = result.replace(/[^\p{L}\p{N}\s]/gu, '');
    }

    // Clean up multiple spaces that might result from the replacement
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }
}
