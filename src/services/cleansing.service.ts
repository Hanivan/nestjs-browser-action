import { Injectable } from '@nestjs/common';
import { CleansingPipe } from '../pipes/cleansing-pipe';
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

@Injectable()
export class CleansingService {
  private readonly PIPE_TYPE_MAP = {
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
    return this.cleanse(data, this.loadPipes(profilePipes)) as T;
  }

  loadPipes(config: PipeConfig[]): CleansingPipe[] {
    const pipes: CleansingPipe[] = [];

    for (const pipeConfig of config) {
      const PipeClass = this.PIPE_TYPE_MAP[pipeConfig.type];

      if (!PipeClass) {
        throw new Error(`Unknown pipe type: ${pipeConfig.type}`);
      }

      // Only pass params if they exist, not the entire config
      const pipeParams =
        (pipeConfig as { params?: Record<string, unknown> }).params || {};
      const pipeInstance = new PipeClass();
      Object.assign(pipeInstance, { customConfig: pipeParams });

      pipes.push(pipeInstance as CleansingPipe);
    }

    return pipes;
  }

}
