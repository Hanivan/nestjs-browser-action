import { IsOptional } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';
import { normalizeWhitespace } from '../utils/string.util';

/**
 * Sanitizes text by removing HTML tags and XSS vulnerabilities
 */
export class SanitizeTextPipe extends CleansingPipe<string, string> {
  type = CleansingType.SANITIZE_TEXT;

  private static readonly TAG_PAIR_REGEXES: RegExp[] = [
    'script',
    'iframe',
    'object',
    'embed',
    'applet',
    'form',
    'input',
    'button',
    'select',
    'textarea',
    'meta',
    'link',
    'style',
  ].map((tag) => new RegExp(`<${tag}[^>]*>.*?<\\/${tag}>`, 'gi'));

  private static readonly TAG_SELF_CLOSING_REGEXES: RegExp[] = [
    'script',
    'iframe',
    'object',
    'embed',
    'applet',
    'form',
    'input',
    'button',
    'select',
    'textarea',
    'meta',
    'link',
    'style',
  ].map((tag) => new RegExp(`<${tag}[^>]*\\s*\\/?>`, 'gi'));

  private static readonly EVENT_HANDLER_REGEXES: RegExp[] = [
    'onclick',
    'onerror',
    'onload',
    'onmouseover',
    'onmouseout',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit',
    'onreset',
    'onselect',
    'onkeydown',
    'onkeyup',
    'onkeypress',
  ].map((h) => new RegExp(`${h}=\\S*`, 'gi'));

  @IsOptional()
  preserveEntities?: boolean;

  exec(value: string): string {
    if (typeof value !== 'string' || !value) {
      return value;
    }

    let result = value;

    for (const regex of SanitizeTextPipe.TAG_PAIR_REGEXES) {
      result = result.replace(regex, '');
    }
    for (const regex of SanitizeTextPipe.TAG_SELF_CLOSING_REGEXES) {
      result = result.replace(regex, '');
    }
    for (const regex of SanitizeTextPipe.EVENT_HANDLER_REGEXES) {
      result = result.replace(regex, '');
    }

    result = result.replace(/javascript:/gi, '');
    result = result.replace(/<[^>]*>/g, '');

    if (!this.preserveEntities) {
      result = result
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    result = normalizeWhitespace(result);

    return result;
  }
}
