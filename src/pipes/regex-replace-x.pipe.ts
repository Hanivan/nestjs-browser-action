import { IsNotEmpty, IsString } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';

function execRegexReplace(
  pipe: { regex: string; flag: string; textReplacement: string },
  val: string,
): string {
  if (typeof val !== 'string') return val;
  const flag = Array.isArray(pipe.flag)
    ? (pipe.flag as string[]).join('')
    : pipe.flag;
  return val.replace(new RegExp(pipe.regex, flag), pipe.textReplacement);
}

export class RegexReplaceXPipe extends CleansingPipe<string, string> {
  readonly type = 'regex-replace-x' as const;
  @IsString() @IsNotEmpty() regex!: string;
  @IsString() flag: string = 'g';
  @IsString() textReplacement: string = '';
  baseUrl?: string;
  exec(val: string) {
    return execRegexReplace(this, val);
  }
  reverse(val: string): string {
    return val;
  }
}

export class PageRegexReplacePipe extends CleansingPipe<string, string> {
  readonly type = 'regex-replace--page' as const;
  @IsString() @IsNotEmpty() regex!: string;
  @IsString() flag: string = 'g';
  @IsString() textReplacement: string = '';
  baseUrl?: string;
  exec(val: string) {
    return execRegexReplace(this, val);
  }
  reverse(val: string): string {
    return val;
  }
}

export class URLRegexReplacePipe extends CleansingPipe<string, string> {
  readonly type = 'regex-replace--url' as const;
  @IsString() @IsNotEmpty() regex!: string;
  @IsString() flag: string = 'g';
  @IsString() textReplacement: string = '';
  baseUrl?: string;
  exec(val: string) {
    return execRegexReplace(this, val);
  }
  reverse(val: string): string {
    return val;
  }
}
