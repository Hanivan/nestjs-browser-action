import { CleansingType } from '../../enums/cleansing-type.enum';
import { CleansingOptions } from '../../interfaces/cleansing-options';

/**
 * Phone number cleansing profile for phone numbers
 * Handles various phone number formats and special characters
 */
export const PHONE_PROFILE: CleansingOptions = {
  pipes: [
    { type: CleansingType.TRIM },
    {
      type: CleansingType.REMOVE_SPECIAL_CHARS,
      params: { pattern: '[^0-9+]' },
    },
    {
      type: CleansingType.REGEX_EXTRACT,
      params: { regex: '\\+?[0-9]{10,15}', flags: 'g' },
    },
  ],
};
