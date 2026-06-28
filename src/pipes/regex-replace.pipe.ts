import { IsOptional, Matches, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Replaces text using regex patterns
 */
export class RegexReplacePipe extends CleansingPipe<string, string> {
  readonly type = CleansingType.REGEX_REPLACE as const;

  @IsOptional()
  @IsString()
  @Matches(/.*/)
  pattern?: string;

  @IsOptional()
  @IsString()
  replacement?: string;

  @IsOptional()
  @IsString()
  flags?: string;

  private _regex?: RegExp;

  exec(value: string): string {
    if (
      typeof value !== 'string' ||
      !this.pattern ||
      this.replacement === undefined
    ) {
      return value;
    }

    try {
      if (!this._regex) {
        this._regex = new RegExp(this.pattern, this.flags ?? 'g');
      }
      return value.replace(this._regex, this.replacement);
    } catch {
      return value;
    }
  }
}
