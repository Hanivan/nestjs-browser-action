import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { CleansingPipe } from '../pipes/cleansing-pipe';
import { isSafeRegex } from '../utils/regex.util';
import { TrimPipe } from '../pipes/trim.pipe';
import { ToNumberPipe } from '../pipes/to-number.pipe';
import { ToLowerCasePipe } from '../pipes/to-lower-case.pipe';
import { ToUpperCasePipe } from '../pipes/to-upper-case.pipe';
import { SanitizeTextPipe } from '../pipes/sanitize-text.pipe';
import { NormalizeWhitespacePipe } from '../pipes/normalize-whitespace.pipe';
import { RemoveLineBreaksPipe } from '../pipes/remove-line-breaks.pipe';
import { DateFormatPipe } from '../pipes/date-format.pipe';
import { RegexReplacePipe } from '../pipes/regex-replace.pipe';
import { RegexExtractPipe } from '../pipes/regex-extract.pipe';
import { RemoveCurrencySymbolPipe } from '../pipes/remove-currency-symbol.pipe';
import { RemoveSpecialCharsPipe } from '../pipes/remove-special-chars.pipe';
import { AltFlagPipe } from '../pipes/alt-flag.pipe';
import { CLEANSING_PROFILES } from '../pipes/profiles';
import { CleansingProfile } from '../enums/cleansing-profile.enum';
import { CleansingType } from '../enums/cleansing-type.enum';
import type { PipeConfig } from '../interfaces/types';
import type { BrowserActionOptions } from '../interfaces/browser-action-options';
import { BROWSER_ACTION_OPTIONS } from '../constants/browser-action.constants';

export type CleansingPipeClass = new () => CleansingPipe;

/** Security: properties that are safe to set on pipe instances */
const SAFE_PIPE_PROPERTIES = new Set([
  'pattern', 'replacement', 'flags', 'format', 'chars', 'attribute',
  'text', 'locale', 'altCondition', 'currency', 'symbol',
]);

@Injectable()
export class CleansingService {
  private readonly logger = new Logger(CleansingService.name);
  private readonly pipeRegistry: Record<string, CleansingPipeClass> = {
    [CleansingType.TRIM]: TrimPipe,
    [CleansingType.TO_NUMBER]: ToNumberPipe,
    [CleansingType.SANITIZE_TEXT]: SanitizeTextPipe,
    [CleansingType.DATE_FORMAT]: DateFormatPipe,
    [CleansingType.REGEX_REPLACE]: RegexReplacePipe,
    [CleansingType.REGEX_EXTRACT]: RegexExtractPipe,
    [CleansingType.REMOVE_CURRENCY_SYMBOL]: RemoveCurrencySymbolPipe,
    [CleansingType.REMOVE_SPECIAL_CHARS]: RemoveSpecialCharsPipe,
    [CleansingType.TO_LOWER_CASE]: ToLowerCasePipe,
    [CleansingType.TO_UPPER_CASE]: ToUpperCasePipe,
    [CleansingType.NORMALIZE_WHITESPACE]: NormalizeWhitespacePipe,
    [CleansingType.REMOVE_LINE_BREAKS]: RemoveLineBreaksPipe,
    [CleansingType.ALT_FLAG]: AltFlagPipe,
  };

  constructor(
    @Optional()
    @Inject(BROWSER_ACTION_OPTIONS)
    options?: BrowserActionOptions,
  ) {
    if (options?.customPipes) {
      this.registerPipes(options.customPipes);
    }
  }

  /**
   * Register a custom pipe so config-driven paths (scrape/workflow/buildPipes)
   * can resolve its `type` string. Throws if the type is already registered.
   */
  registerPipe(type: string, pipeClass: CleansingPipeClass): void {
    if (this.pipeRegistry[type]) {
      throw new Error(`Pipe type already registered: ${type}`);
    }
    this.pipeRegistry[type] = pipeClass;
  }

  /**
   * Register multiple custom pipes at once. See {@link registerPipe}.
   */
  registerPipes(pipes: Record<string, CleansingPipeClass>): void {
    for (const [type, pipeClass] of Object.entries(pipes)) {
      this.registerPipe(type, pipeClass);
    }
  }

  cleanse<TInput = unknown, TOutput = unknown>(
    data: TInput,
    pipes: CleansingPipe<TInput, TOutput>[],
  ): TOutput {
    return pipes.reduce(
      (result: unknown, pipe) => pipe.exec(result as TInput),
      data as unknown,
    ) as TOutput;
  }

  cleanseWithProfile<T = unknown>(
    data: string,
    profileName: CleansingProfile,
  ): T {
    const profilePipes = CLEANSING_PROFILES[profileName];
    return this.cleanse(data, this.buildPipes(profilePipes)) as T;
  }

  buildPipes(config: PipeConfig[], depth = 0): CleansingPipe[] {
    const MAX_PIPE_DEPTH = 10;
    if (depth > MAX_PIPE_DEPTH) {
      throw new Error(`Maximum pipe nesting depth (${MAX_PIPE_DEPTH}) exceeded`);
    }

    const pipes: CleansingPipe[] = [];

    for (const pipeConfig of config) {
      const PipeClass = this.pipeRegistry[pipeConfig.type];

      if (!PipeClass) {
        throw new Error(`Unknown pipe type: ${pipeConfig.type}`);
      }

      const { primaryPipes, fallbackPipes, ...rest } = pipeConfig;
      const pipeInstance = new PipeClass();

      // Security: replace Object.assign with safe property whitelisting
      for (const [key, val] of Object.entries(rest)) {
        if (key === 'exec' || key === 'type') {
          this.logger.warn(`Blocked attempt to overwrite pipe.${key}`);
          continue;
        }
        if (SAFE_PIPE_PROPERTIES.has(key) || key.startsWith('_')) {
          (pipeInstance as unknown as Record<string, unknown>)[key] = val;
        }
      }

      // Security: validate regex patterns to prevent ReDoS
      if ('pattern' in pipeInstance && typeof (pipeInstance as { pattern?: string }).pattern === 'string') {
        const pattern = (pipeInstance as { pattern: string }).pattern;
        if (!isSafeRegex(pattern)) {
          throw new Error(`Potentially dangerous regex pattern rejected: ${pattern}`);
        }
      }

      if (primaryPipes) {
        (pipeInstance as AltFlagPipe).primaryPipes =
          this.buildPipes(primaryPipes, depth + 1);
      }
      if (fallbackPipes) {
        (pipeInstance as AltFlagPipe).fallbackPipes =
          this.buildPipes(fallbackPipes, depth + 1);
      }

      pipes.push(pipeInstance);
    }

    return pipes;
  }
}
