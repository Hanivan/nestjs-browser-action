import { IsNotEmpty, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';

export class UrlResolvePipe extends CleansingPipe<string, string> {
  readonly type = 'url-resolve' as const;

  @IsString()
  @IsNotEmpty()
  baseUrl!: string;

  exec(value: string): string {
    if (!value || typeof value !== 'string') {
      return '';
    }

    const trimmed = value.trim();

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    if (trimmed.startsWith('//')) {
      return 'https:' + trimmed;
    }

    if (trimmed.startsWith('/')) {
      const url = new URL(this.baseUrl);
      return `${url.protocol}//${url.host}${trimmed}`;
    }

    return this.baseUrl.replace(/\/$/, '') + '/' + trimmed;
  }

  reverse(value: string): string {
    try {
      const base = new URL(this.baseUrl);
      const url = new URL(value);
      return url.host === base.host ? url.pathname : value;
    } catch {
      return value;
    }
  }
}
