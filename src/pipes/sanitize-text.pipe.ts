import { IsOptional } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Sanitizes text by removing HTML tags and XSS vulnerabilities
 */
export class SanitizeTextPipe extends CleansingPipe<string, string> {
  type = CleansingType.SANITIZE_TEXT;

  @IsOptional()
  preserveEntities?: boolean;

  exec(value: string): string {
    if (typeof value !== 'string' || !value) {
      return value;
    }

    let result = value;

    // Remove dangerous HTML tags
    const dangerousTags = [
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
    ];

    // Remove tag pairs
    dangerousTags.forEach((tag) => {
      const regex = new RegExp(`<${tag}[^>]*>.*?<\\/${tag}>`, 'gi');
      result = result.replace(regex, '');
    });

    // Remove self-closing tags
    dangerousTags.forEach((tag) => {
      const regex = new RegExp(`<${tag}[^>]*\\s*\\/?>`, 'gi');
      result = result.replace(regex, '');
    });

    // Remove onclick, onerror, and other event handlers
    const eventHandlers = [
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
    ];

    eventHandlers.forEach((handler) => {
      const regex = new RegExp(`${handler}=\\S*`, 'gi');
      result = result.replace(regex, '');
    });

    // Remove javascript: protocol links
    result = result.replace(/javascript:/gi, '');

    // Remove HTML tags
    result = result.replace(/<[^>]*>/g, '');

    // If preserving HTML entities is disabled, decode them
    if (!this.preserveEntities) {
      result = result
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    // Normalize whitespace
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }
}
