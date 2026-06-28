import { IsArray, IsNotEmpty } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';

export interface RegexReplacementRule {
  pattern: string | RegExp;
  replacement: string;
  flags?: string;
}

export class RegexPipe extends CleansingPipe<string, string> {
  readonly type = 'regex' as const;

  @IsArray()
  @IsNotEmpty()
  rules!: RegexReplacementRule[];

  exec(value: string): string {
    if (!value || typeof value !== 'string') {
      return value || '';
    }

    let result = value;

    for (const rule of this.rules) {
      const flags = rule.flags || 'g';
      const regex =
        rule.pattern instanceof RegExp
          ? new RegExp(rule.pattern.source, flags)
          : new RegExp(rule.pattern, flags);

      result = result.replace(regex, rule.replacement);
    }

    return result;
  }

  reverse(value: string): string {
    return value;
  }
}
