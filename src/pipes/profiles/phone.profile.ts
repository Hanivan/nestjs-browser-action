import { CleansingType } from '../../enums/cleansing-type.enum';
import { CleansingOptions } from '../../interfaces/cleansing-options';

export const PHONE_PROFILE: CleansingOptions = {
  pipes: {
    trim: true,
    custom: [
      { type: CleansingType.REMOVE_SPECIAL_CHARS, pattern: '[^0-9+]' },
      {
        type: CleansingType.REGEX_EXTRACT,
        regex: '\\+?[0-9]{10,15}',
        flag: 'g',
      },
    ],
  },
};
