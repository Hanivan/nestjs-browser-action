import { CleansingType } from '../../enums/cleansing-type.enum';
import { CleansingOptions } from '../../interfaces/cleansing-options';

/**
 * Date cleansing profile for date values
 * Handles various date formats and normalizes to UTC
 */
export const DATE_PROFILE: CleansingOptions = {
  pipes: [
    { type: CleansingType.TRIM },
    {
      type: CleansingType.DATE_FORMAT,
      params: { format: 'YYYY-MM-DD', timezone: 'UTC' },
    },
  ],
};
