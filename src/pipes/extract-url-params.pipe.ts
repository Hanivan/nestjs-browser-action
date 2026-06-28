import { IsNotEmpty, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';

export class ExtractUrlParamsPipe extends CleansingPipe<string, string> {
  readonly type = 'extract-url-params' as const;

  @IsString()
  @IsNotEmpty()
  regex!: string;

  @IsString()
  flag: string = 'g';

  @IsString()
  @IsNotEmpty()
  paramKey!: string;

  baseUrl?: string;

  exec(val: string): string {
    if (typeof val !== 'string') return val;
    try {
      const url = new URL(val);
      const flag = Array.isArray(this.flag)
        ? (this.flag as string[]).join('')
        : this.flag;
      const match = val.match(new RegExp(this.regex, flag))?.length ?? 0;
      if (match > 0 && url.searchParams.has(this.paramKey)) {
        return url.searchParams.get(this.paramKey) ?? val;
      }
    } catch {
      /* invalid URL — return original */
    }
    return val;
  }

  reverse(val: string): string {
    return val;
  }
}
