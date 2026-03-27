import { IsBoolean, IsOptional, Matches, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Replaces text using regex patterns
 */
export class RegexReplacePipe extends CleansingPipe<string, string> {
  type = CleansingType.REGEX_REPLACE;

  @IsOptional()
  @IsString()
  @Matches(/.*/)
  pattern?: string;

  @IsOptional()
  @IsString()
  replacement?: string;

  @IsOptional()
  @IsBoolean()
  replaceFirst?: boolean;

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
        const flags = this.replaceFirst ? 'i' : 'gi';
        this._regex = new RegExp(this.pattern, flags);
      }
      return value.replace(this._regex, this.replacement);
    } catch {
      return value;
    }
  }
}
