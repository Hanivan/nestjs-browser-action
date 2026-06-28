import { IsOptional, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';

export class ParseAsURLPipe extends CleansingPipe<string, string> {
  readonly type = 'parse-as-url' as const;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  exec(value: string): string {
    if (!value || typeof value !== 'string') {
      return '';
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    if (!this.baseUrl) {
      return value;
    }

    try {
      return new URL(value, this.baseUrl).toString();
    } catch {
      return value;
    }
  }

  reverse(value: string): string {
    return value;
  }
}
