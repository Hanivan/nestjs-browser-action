import { CleansingPipe } from './cleansing-pipe';

export class DateFormatSpecialPipe extends CleansingPipe<string, string> {
  readonly type = 'date-format-special' as const;

  exec(val: string): string {
    const now = new Date();
    if (val === 'month_in') {
      now.setMonth(now.getMonth() - 1);
      return now.toISOString().replace('T', ' ').slice(0, 19);
    }
    if (val === 'month_over') {
      now.setMonth(now.getMonth() - 2);
      return now.toISOString().replace('T', ' ').slice(0, 19);
    }
    return val;
  }

  reverse(val: string): string {
    return val;
  }
}
