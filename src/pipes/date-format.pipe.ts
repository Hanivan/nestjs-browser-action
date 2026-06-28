import { IsOptional, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';
import { DateTime } from 'luxon';

/**
 * Formats dates using Luxon.
 *
 * Format tokens follow Luxon syntax (https://moment.github.io/luxon/#/formatting):
 *   yyyy = 4-digit year, MM = month, dd = day, HH = hour, mm = minute, ss = second
 *
 * Special format values:
 *   'relative' — returns a human-readable relative string, e.g. "2 hours ago"
 *   'X'        — returns the Unix timestamp in seconds as a string
 *   'LL'       — returns a locale-aware long date, e.g. "December 25, 2023"
 */
export class DateFormatPipe extends CleansingPipe<string | Date, string> {
  readonly type = CleansingType.DATE_FORMAT as const;

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

    let date: DateTime;
    if (value instanceof Date) {
      date = DateTime.fromJSDate(value);
    } else {
      const timestamp = parseInt(value, 10);
      if (!isNaN(timestamp) && timestamp.toString().length === 10) {
        date = DateTime.fromSeconds(timestamp);
      } else {
        date = DateTime.fromISO(value);
        if (!date.isValid) {
          const dateObj = new Date(value);
          if (!isNaN(dateObj.getTime())) {
            date = DateTime.fromJSDate(dateObj);
          }
        }
      }
    }

    if (this.timezone && date.isValid) {
      date = date.setZone(this.timezone);
    }

    if (this.locale && date.isValid) {
      date = date.setLocale(this.locale);
    }

    if (!date.isValid) {
      return value.toString();
    }

    if (this.format) {
      if (this.format === 'relative') {
        return date.toRelative()!;
      }
      if (this.format === 'X') {
        return date.toUnixInteger().toString();
      }
      if (this.format === 'LL') {
        return date.toLocaleString({
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      return date.toFormat(this.format);
    }

    return date.toISO()!;
  }
}
