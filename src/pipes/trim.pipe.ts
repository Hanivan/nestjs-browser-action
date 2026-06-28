import { IsBoolean, IsOptional } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Trim whitespace from strings
 */
export class TrimPipe extends CleansingPipe<unknown, unknown> {
  readonly type = CleansingType.TRIM as const;

  @IsOptional()
  @IsBoolean()
  trimStart?: boolean;

  @IsOptional()
  @IsBoolean()
  trimEnd?: boolean;

  exec(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    // If both or neither are specified, trim both sides
    if (this.trimStart && !this.trimEnd) {
      return value.trimStart();
    }

    if (this.trimEnd && !this.trimStart) {
      return value.trimEnd();
    }

    // Default: trim both sides
    return value.trim();
  }
}
