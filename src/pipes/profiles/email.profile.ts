import { CleansingType } from '../../enums/cleansing-type.enum';
import { CleansingOptions } from '../../interfaces/cleansing-options';

/**
 * Email cleansing profile for email addresses
 * Handles whitespace, special characters, and formatting
 */
export const EMAIL_PROFILE: CleansingOptions = {
  pipes: [
    { type: CleansingType.TRIM },
    { type: CleansingType.TO_LOWER_CASE },
    {
      type: CleansingType.REGEX_EXTRACT,
      params: {
        regex: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        flags: 'i',
      },
    },
  ],
};
