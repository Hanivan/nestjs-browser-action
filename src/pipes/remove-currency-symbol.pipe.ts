import { IsOptional } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Removes currency symbols from strings
 */
export class RemoveCurrencySymbolPipe extends CleansingPipe<string, string> {
  readonly type = CleansingType.REMOVE_CURRENCY_SYMBOL as const;

  // $€£¥₩₹₽₴₺₼₾៛₭₮₲₱₡¢₵
  private static readonly CURRENCY_REGEX = /[$€£¥₩₹₽₴₺₼₾៛₭₮₲₱₡¢₵]/g;

  @IsOptional()
  preserveDecimals?: boolean;

  exec(value: string): string {
    if (typeof value !== 'string') {
      return value;
    }

    let result = value.replace(RemoveCurrencySymbolPipe.CURRENCY_REGEX, '');

    // Clean up any resulting double spaces, but preserve leading/trailing spaces
    result = result.replace(/\s+/g, ' ');

    // Only trim if the original was not meant to have leading/trailing spaces
    if (value !== value.trim()) {
      // Preserve original leading/trailing space pattern
      if (value.startsWith(' ') && !result.startsWith(' ')) {
        result = ' ' + result;
      }
      if (value.endsWith(' ') && !result.endsWith(' ')) {
        result = result + ' ';
      }
    }

    return result;
  }
}
