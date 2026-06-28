import { IsNotEmpty, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';

export class QueryAppendPipe extends CleansingPipe<string, string> {
  readonly type = 'query-append' as const;

  @IsString()
  @IsNotEmpty()
  paramKey!: string;

  @IsString()
  @IsNotEmpty()
  paramValue!: string;

  baseUrl?: string;

  exec(val: string): string {
    if (typeof val !== 'string') return val;
    try {
      const url = new URL(val);
      url.searchParams.append(this.paramKey, this.paramValue);
      return url.toString();
    } catch {
      return val;
    }
  }

  reverse(val: string): string {
    return val;
  }
}
