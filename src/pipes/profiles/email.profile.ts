import { CleansingType } from '../../enums/cleansing-type.enum';
import { CleansingOptions } from '../../interfaces/cleansing-options';

export const EMAIL_PROFILE: CleansingOptions = {
  pipes: {
    trim: true,
    toLowerCase: true,
    custom: [
      {
        type: CleansingType.REGEX_EXTRACT,
        regex: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        flag: 'i',
      },
    ],
  },
};
