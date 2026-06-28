import { IsOptional, Matches, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Extracts text using regex patterns
 */
export class RegexExtractPipe extends CleansingPipe<
  string,
  string | string[] | null
> {
  readonly type = CleansingType.REGEX_EXTRACT as const;

  @IsOptional()
  @IsString()
  @Matches(/.*/)
  pattern?: string;

  private _regex?: RegExp;

  exec(value: string): string | string[] | null {
    if (typeof value !== 'string' || !this.pattern) {
      return value;
    }

    try {
      if (!this._regex) {
        this._regex = new RegExp(this.pattern);
      }
      const regex = this._regex;

      if (regex.global) {
        const matches = value.match(regex);
        if (!matches) return null;

        regex.lastIndex = 0;
        const groupCount = regex.exec(matches[0])?.length || 1;

        if (groupCount > 1) {
          const result = matches
            .map((match) => {
              regex.lastIndex = 0;
              const groups = regex.exec(match);
              return groups ? groups.slice(1) : null;
            })
            .filter((item): item is string[] => item !== null);
          return result as unknown as string[];
        }

        return matches;
      }

      const matches = value.match(regex);

      if (!matches) {
        return null;
      }

      // If named groups, return object with groups
      if (matches.groups) {
        return {
          ...matches.groups,
          '0': matches[0], // Full match
          ...matches.slice(1).reduce(
            (obj, match, index) => {
              obj[index + 1] = match;
              return obj;
            },
            {} as Record<string, unknown>,
          ),
        } as unknown as string | string[] | null;
      }

      // If capturing groups, return array of groups
      if (matches.length > 1) {
        return matches.slice(1); // Remove the full match
      }

      // Return single match
      return matches[0];
    } catch {
      // Return null if regex is invalid
      return null;
    }
  }
}
