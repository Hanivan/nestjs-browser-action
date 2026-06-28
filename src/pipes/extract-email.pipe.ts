import { CleansingPipe } from './cleansing-pipe';

export class ExtractEmailPipe extends CleansingPipe<string, string> {
  readonly type = 'extract-email' as const;

  exec(value: string): string {
    if (!value || typeof value !== 'string') {
      return '';
    }

    const match = value.match(
      /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
    );
    return match ? match[0] : '';
  }

  reverse(value: string): string {
    return value;
  }
}
