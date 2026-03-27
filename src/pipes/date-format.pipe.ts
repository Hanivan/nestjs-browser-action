import { IsOptional, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import moment = require('moment');

import 'moment-timezone';

/**
 * Formats dates using moment.js
 */
export class DateFormatPipe extends CleansingPipe<string | Date, string> {
  type = CleansingType.DATE_FORMAT;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  exec(value: string | Date): string {
    if (!value) {
      return value;
    }

    if (typeof value !== 'string' && !(value instanceof Date)) {
      return String(value);
    }

    let date: moment.Moment;
    if (value instanceof Date) {
      date = moment(value);
    } else {
      const timestamp = parseInt(value, 10);
      if (!isNaN(timestamp) && timestamp.toString().length === 10) {
        date = moment.unix(timestamp);
      } else {
        date = moment(value, moment.ISO_8601, true);
        if (!date.isValid()) {
          const dateObj = new Date(value);
          if (!isNaN(dateObj.getTime())) {
            date = moment(dateObj);
          }
        }
      }
    }

    if (this.timezone && date.isValid()) {
      date = date.tz(this.timezone);
    }

    if (this.locale && date.isValid()) {
      date = date.locale(this.locale);
    }

    if (!date.isValid()) {
      return value.toString();
    }

    if (this.format) {
      if (this.format === 'relative') {
        return date.fromNow();
      }
      return date.format(this.format);
    }

    return date.format();
  }
}
