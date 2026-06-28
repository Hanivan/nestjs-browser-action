import { CleansingPipe } from './cleansing-pipe';

export class MediaFilterPipe extends CleansingPipe<string, string> {
  readonly type = 'media-filter' as const;

  baseUrl?: string;

  exec(rawSrc: string): string {
    if (typeof rawSrc !== 'string') return '';
    return rawSrc
      .split(' ')
      .filter((s) => !s.includes('data:image/gif'))
      .join(' ');
  }

  reverse(val: string): string {
    return val;
  }
}
