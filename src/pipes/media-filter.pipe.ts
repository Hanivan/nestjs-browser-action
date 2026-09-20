import { IsBoolean, IsOptional } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';

export class MediaFilterPipe extends CleansingPipe<string, string> {
  readonly type = 'media-filter' as const;

  @IsOptional()
  @IsBoolean()
  reverseOrder?: boolean;

  baseUrl?: string;

  exec(rawSrc: string): string {
    if (typeof rawSrc !== 'string') return '';
    const filtered = rawSrc
      .split(' ')
      .filter((s) => !s.includes('data:image/gif'));
    if (this.reverseOrder) {
      filtered.reverse();
    }
    return filtered.join(' ');
  }

  reverse(val: string): string {
    return val;
  }
}
