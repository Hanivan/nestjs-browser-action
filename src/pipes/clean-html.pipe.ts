import * as libxmljs from 'libxmljs2';
import { CleansingPipe } from './cleansing-pipe';

export class CleanHtmlPipe extends CleansingPipe<string, string> {
  readonly type = 'clean-html' as const;

  exec(value: string): string {
    if (!value) return value;
    return libxmljs
      .parseHtml(value)
      .find(
        './/text()[not(ancestor-or-self::script) and not(ancestor-or-self::style)][normalize-space()]',
      )
      .map((n) => n.toString().trim())
      .join('\n');
  }
}
