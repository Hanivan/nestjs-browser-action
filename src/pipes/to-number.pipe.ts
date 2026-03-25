import { IsNumber, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Convert strings to numbers with optional rounding
 */
export class ToNumberPipe extends CleansingPipe<string, number> {
  type = CleansingType.TO_NUMBER;

  @IsOptional()
  @IsNumber()
  decimals?: number = 0;

  @IsOptional()
  @IsEnum(['ceil', 'floor', 'round'])
  round?: 'ceil' | 'floor' | 'round' = 'round';

  @IsOptional()
  @IsBoolean()
  nullifyEmpty?: boolean = false;

  exec(value: string): number {
    if (value === '' && this.nullifyEmpty) {
      return 0;
    }

    const num = parseFloat(value);

    if (isNaN(num)) {
      return NaN;
    }

    if (this.decimals !== undefined && this.decimals >= 0) {
      const multiplier = Math.pow(10, this.decimals);
      const rounded =
        this.round === 'ceil'
          ? Math.ceil
          : this.round === 'floor'
            ? Math.floor
            : Math.round;
      return rounded(num * multiplier) / multiplier;
    }

    return num;
  }
}
