import { IsOptional, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';
import { normalizeWhitespace } from '../utils/string.util';

/**
 * Removes special characters from strings
 */
export class RemoveSpecialCharsPipe extends CleansingPipe<string, string> {
  readonly type = CleansingType.REMOVE_SPECIAL_CHARS as const;

  @IsOptional()
  @IsString()
  allowedChars?: string;

  private _regex?: RegExp;

  exec(value: string): string {
    if (typeof value !== 'string') {
      return value;
    }

    let result = value;

    if (this.allowedChars) {
      if (!this._regex) {
        const escaped = this.allowedChars
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/-/g, '\\-');
        this._regex = new RegExp(`[^a-zA-Z0-9${escaped}]`, 'g');
      }
      result = result.replace(this._regex, '');
    } else {
      result = result.replace(/[^\p{L}\p{N}\s]/gu, '');
    }

    return normalizeWhitespace(result);
  }
}
