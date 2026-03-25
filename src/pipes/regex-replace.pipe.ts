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

  exec(value: string): string {
    if (
      typeof value !== 'string' ||
      !this.pattern ||
      this.replacement === undefined
    ) {
      return value;
    }

    try {
      const flags = this.replaceFirst ? 'i' : 'gi';
      const regex = new RegExp(this.pattern, flags);

      if (this.replaceFirst) {
        return value.replace(regex, this.replacement);
      } else {
        return value.replace(regex, this.replacement);
      }
    } catch {
      // Return original value if regex is invalid
      return value;
    }
  }
}
