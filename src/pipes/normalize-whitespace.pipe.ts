import { IsOptional } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Normalizes whitespace in strings
 */
export class NormalizeWhitespacePipe extends CleansingPipe<string, string> {
  type = CleansingType.NORMALIZE_WHITESPACE;

  @IsOptional()
  preserveTabs?: boolean;

  @IsOptional()
  preserveLineBreaks?: boolean;

  exec(value: string): string {
    if (typeof value !== 'string' || !value) {
      return value;
    }

    let result = value;

    // Convert all whitespace to spaces first
    if (!this.preserveTabs) {
      result = result.replace(/\t/g, ' ');
    }

    // Convert Unicode spaces to regular spaces
    result = result.replace(
      /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g,
      ' ',
    );

    if (!this.preserveLineBreaks) {
      // Normalize line breaks to spaces
      result = result.replace(/[\r\n\v\f\x85\u2028\u2029]/g, ' ');
    } else {
      // Normalize line breaks but preserve them
      result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    // Collapse consecutive spaces into single spaces
    result = result.replace(/\s+/g, ' ');

    // Trim leading and trailing whitespace
    result = result.trim();

    return result;
  }
}
