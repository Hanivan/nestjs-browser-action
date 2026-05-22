import { IsBoolean, IsOptional } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';
import { normalizeWhitespace } from '../utils/string.util';

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

    if (this.replaceWithSpace) {
      result = result.replace(/\r\n|\n|\r|\v|\f|\u2028|\u2029/g, ' ');
      result = normalizeWhitespace(result);
    } else {
      result = result.replace(/\r\n|\n|\r|\v|\f|\u2028|\u2029/g, '');
    }

    return result;
  }
}
