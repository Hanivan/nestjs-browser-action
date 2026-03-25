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

    // Handle non-date values (except strings which might be dates)
    if (typeof value !== 'string' && !(value instanceof Date)) {
      return String(value);
    }

    // Set locale if specified
    if (this.locale) {
      moment.locale(this.locale);
    }

    // Parse the input date
    let date: moment.Moment;
    if (value instanceof Date) {
      date = moment(value);
    } else if (
      value &&
      typeof value === 'object' &&
      (value as unknown as moment.Moment)['_isAMomentObject']
    ) {
      // Handle moment objects directly
      date = value as unknown as moment.Moment;
    } else {
      // Try to parse as timestamp first
      const timestamp = parseInt(value, 10);
      if (!isNaN(timestamp) && timestamp.toString().length === 10) {
        date = moment.unix(timestamp);
      } else {
        // Try strict ISO 8601 parsing first (no deprecation warning)
        date = moment(value, moment.ISO_8601, true);

        // If strict parsing fails, try using Date object (no deprecation warning)
        if (!date.isValid()) {
          const dateObj = new Date(value);
          if (!isNaN(dateObj.getTime())) {
            date = moment(dateObj);
          }
          // If Date parsing also fails, date.isValid() will be false
          // and we'll return the original value below
        }
      }
    }

    // Set timezone if specified
    if (this.timezone && date.isValid()) {
      date = date.tz(this.timezone);
    }

    // Check if date is valid before formatting
    if (!date.isValid()) {
      return value.toString();
    }

    // Format the date
    if (this.format) {
      if (this.format === 'relative') {
        return date.fromNow();
      }
      return date.format(this.format);
    }

    // Default format
    return date.format();
  }
}
