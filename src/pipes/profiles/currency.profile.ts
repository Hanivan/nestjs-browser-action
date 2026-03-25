import { CleansingType } from '../../enums/cleansing-type.enum';
import { CleansingOptions } from '../../interfaces/cleansing-options';

/**
 * Currency cleansing profile for monetary values with currency handling
 * Removes currency symbols, handles decimal separators, and converts to number
 */
export const CURRENCY_PROFILE: CleansingOptions = {
  pipes: [
    { type: CleansingType.TRIM },
    {
      type: CleansingType.REMOVE_CURRENCY_SYMBOL,
      params: { symbols: ['$', '€', '£', '¥', '₹'] },
    },
    {
      type: CleansingType.REMOVE_SPECIAL_CHARS,
      params: { pattern: '[^0-9.]' },
    },
    { type: CleansingType.TO_NUMBER, params: { decimals: 2 } },
  ],
};
