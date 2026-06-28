import { IsNotEmpty, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';

function execRegexExtraction(
  pipe: { regex: string; flag: string },
  val: string,
): string | undefined {
  if (typeof val !== 'string') return undefined;
  const flag = Array.isArray(pipe.flag)
    ? (pipe.flag as string[]).join('')
    : pipe.flag;
  const match = val.match(new RegExp(pipe.regex, flag));
  return (match ?? []).shift();
}

export class RegexExtractionPipe extends CleansingPipe<
  string,
  string | undefined
> {
  readonly type = 'regex-extraction' as const;
  @IsString() @IsNotEmpty() regex!: string;
  @IsString() flag: string = 'g';
  baseUrl?: string;
  exec(val: string) {
    return execRegexExtraction(this, val);
  }
  reverse(val: string): string {
    return val;
  }
}

export class PageRegexExtractionPipe extends CleansingPipe<
  string,
  string | undefined
> {
  readonly type = 'regex-extraction--page' as const;
  @IsString() @IsNotEmpty() regex!: string;
  @IsString() flag: string = 'g';
  baseUrl?: string;
  exec(val: string) {
    return execRegexExtraction(this, val);
  }
  reverse(val: string): string {
    return val;
  }
}

export class URLRegexExtractionPipe extends CleansingPipe<
  string,
  string | undefined
> {
  readonly type = 'regex-extraction--url' as const;
  @IsString() @IsNotEmpty() regex!: string;
  @IsString() flag: string = 'g';
  baseUrl?: string;
  exec(val: string) {
    return execRegexExtraction(this, val);
  }
  reverse(val: string): string {
    return val;
  }
}
