import { CleansingType } from '../../enums/cleansing-type.enum';
import { CleansingOptions } from '../../interfaces/cleansing-options';

/**
 * Price cleansing profile for monetary values
 * Handles currency symbols, formatting, and numeric conversion
 */
export const PRICE_PROFILE: CleansingOptions = {
  pipes: [
    { type: CleansingType.TRIM },
    {
      type: CleansingType.REMOVE_CURRENCY_SYMBOL,
      params: { symbols: ['$', '€', '£', '¥'] },
    },
    {
      type: CleansingType.REMOVE_SPECIAL_CHARS,
      params: { pattern: '[^0-9.]' },
    },
    { type: CleansingType.TO_NUMBER, params: { decimals: 2 } },
  ],
};
