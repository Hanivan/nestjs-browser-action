import { plainToClass } from 'class-transformer';
import { TrimPipe } from './trim.pipe';
import { ToNumberPipe } from './to-number.pipe';
import { ToLowerCasePipe } from './to-lower-case.pipe';
import { ToUpperCasePipe } from './to-upper-case.pipe';
import { SanitizeTextPipe } from './sanitize-text.pipe';
import { NormalizeWhitespacePipe } from './normalize-whitespace.pipe';
import { RemoveLineBreaksPipe } from './remove-line-breaks.pipe';
import { DateFormatPipe } from './date-format.pipe';
import { RegexReplacePipe } from './regex-replace.pipe';
import { RegexExtractPipe } from './regex-extract.pipe';
import { RemoveCurrencySymbolPipe } from './remove-currency-symbol.pipe';
import { RemoveSpecialCharsPipe } from './remove-special-chars.pipe';
import { AltFlagPipe } from './alt-flag.pipe';
import { NumberNormalizePipe } from './number-normalize.pipe';
import { UrlResolvePipe } from './url-resolve.pipe';
import { ExtractEmailPipe } from './extract-email.pipe';
import { RegexPipe } from './regex.pipe';
import { ParseAsURLPipe } from './parse-as-url.pipe';
import { CleanHtmlPipe } from './clean-html.pipe';
import {
  RegexExtractionPipe,
  PageRegexExtractionPipe,
  URLRegexExtractionPipe,
} from './regex-extraction.pipe';
import {
  RegexReplaceXPipe,
  PageRegexReplacePipe,
  URLRegexReplacePipe,
} from './regex-replace-x.pipe';
import { ExtractUrlParamsPipe } from './extract-url-params.pipe';
import { MediaFilterPipe } from './media-filter.pipe';
import { QueryAppendPipe } from './query-append.pipe';
import { JsonPathPipe } from './json-path.pipe';
import {
  QueryRemoverPipe,
  PageQueryRemoverPipe,
  URLQueryRemoverPipe,
} from './query-remover.pipe';
import { DateFormatSpecialPipe } from './date-format-special.pipe';
import { CleansingType } from '../enums/cleansing-type.enum';
import { CleansingPipe } from './cleansing-pipe';

/**
 * Registry of predefined pipe types.
 * Maps pipe type strings to pipe classes.
 *
 * Extend with your own pipes:
 * @example
 * ```typescript
 * import { PIPE_REGISTRY } from '@hanivanrizky/nestjs-browser-action';
 * import { MyCustomPipe } from './my-custom.pipe';
 *
 * PIPE_REGISTRY['my-custom'] = MyCustomPipe;
 * ```
 */
export const PIPE_REGISTRY: Record<
  string,
  new (...args: unknown[]) => CleansingPipe
> = {
  // original browser-action pipes
  [CleansingType.TRIM]: TrimPipe,
  [CleansingType.TO_NUMBER]: ToNumberPipe,
  [CleansingType.TO_LOWER_CASE]: ToLowerCasePipe,
  [CleansingType.TO_UPPER_CASE]: ToUpperCasePipe,
  [CleansingType.SANITIZE_TEXT]: SanitizeTextPipe,
  [CleansingType.NORMALIZE_WHITESPACE]: NormalizeWhitespacePipe,
  [CleansingType.REMOVE_LINE_BREAKS]: RemoveLineBreaksPipe,
  [CleansingType.DATE_FORMAT]: DateFormatPipe,
  [CleansingType.REGEX_REPLACE]: RegexReplacePipe,
  [CleansingType.REGEX_EXTRACT]: RegexExtractPipe,
  [CleansingType.REMOVE_CURRENCY_SYMBOL]: RemoveCurrencySymbolPipe,
  [CleansingType.REMOVE_SPECIAL_CHARS]: RemoveSpecialCharsPipe,
  [CleansingType.ALT_FLAG]: AltFlagPipe,
  // xpath-parser pipes
  'num-normalize': NumberNormalizePipe,
  'url-resolve': UrlResolvePipe,
  'extract-email': ExtractEmailPipe,
  regex: RegexPipe,
  'parse-as-url': ParseAsURLPipe,
  'clean-html': CleanHtmlPipe,
  'regex-extraction': RegexExtractionPipe,
  'regex-extraction--page': PageRegexExtractionPipe,
  'regex-extraction--url': URLRegexExtractionPipe,
  'regex-replace-x': RegexReplaceXPipe,
  'regex-replace--page': PageRegexReplacePipe,
  'regex-replace--url': URLRegexReplacePipe,
  'extract-url-params': ExtractUrlParamsPipe,
  'media-filter': MediaFilterPipe,
  'query-append': QueryAppendPipe,
  'json-path': JsonPathPipe,
  'query-remover': QueryRemoverPipe,
  'query-remover--page': PageQueryRemoverPipe,
  'query-remover--url': URLQueryRemoverPipe,
  'date-format-special': DateFormatSpecialPipe,
};

/**
 * Convert plain pipe config objects to pipe instances using plainToClass.
 *
 * @param pipeConfigs - Array of plain pipe config objects
 * @returns Array of pipe instances
 */
export function instantiatePipes(
  pipeConfigs: Array<Record<string, unknown>>,
): CleansingPipe[] {
  const pipes: CleansingPipe[] = [];

  for (const config of pipeConfigs) {
    const pipeType = config.type as string;

    if (!pipeType) {
      continue;
    }

    const PipeClass = PIPE_REGISTRY[pipeType];

    if (!PipeClass) {
      continue;
    }

    try {
      pipes.push(plainToClass(PipeClass, config));
    } catch {
      continue;
    }
  }

  return pipes;
}
