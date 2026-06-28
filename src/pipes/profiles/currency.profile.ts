import { CleansingType } from '../../enums/cleansing-type.enum';
import { CleansingOptions } from '../../interfaces/cleansing-options';

export const CURRENCY_PROFILE: CleansingOptions = {
  pipes: {
    trim: true,
    custom: [
      {
        type: CleansingType.REMOVE_CURRENCY_SYMBOL,
        symbols: ['$', '€', '£', '¥', '₹'],
      },
      { type: CleansingType.REMOVE_SPECIAL_CHARS, pattern: '[^0-9.]' },
      { type: CleansingType.TO_NUMBER, decimals: 2 },
    ],
  },
};
