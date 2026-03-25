import { IsBoolean, IsOptional } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Removes line breaks from strings
 */
export class RemoveLineBreaksPipe extends CleansingPipe<string, string> {
  type = CleansingType.REMOVE_LINE_BREAKS;

  @IsOptional()
  @IsBoolean()
  replaceWithSpace?: boolean;

  exec(value: string): string {
    if (typeof value !== 'string' || !value) {
      return value;
    }

    let result = value;

    // Replace different types of line breaks
    if (this.replaceWithSpace) {
      // Replace with space
      result = result.replace(/\r\n|\n|\r|\v|\f|\u2028|\u2029/g, ' ');
    } else {
      // Remove completely
      result = result.replace(/\r\n|\n|\r|\v|\f|\u2028|\u2029/g, '');
    }

    // Clean up multiple spaces that might result from the replacement
    if (this.replaceWithSpace) {
      result = result.replace(/\s+/g, ' ').trim();
    }

    return result;
  }
}
