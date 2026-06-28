import { CleansingType } from '../../enums/cleansing-type.enum';
import { CleansingOptions } from '../../interfaces/cleansing-options';

export const DATE_PROFILE: CleansingOptions = {
  pipes: {
    trim: true,
    custom: [
      {
        type: CleansingType.DATE_FORMAT,
        format: 'YYYY-MM-DD',
        timezone: 'UTC',
      },
    ],
  },
};
