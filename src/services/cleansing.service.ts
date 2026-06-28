import { Injectable, Inject, Optional } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { CleansingPipe } from '../pipes/cleansing-pipe';
import { PIPE_REGISTRY } from '../pipes/pipe-registry';
import { AltFlagPipe } from '../pipes/alt-flag.pipe';
import { CLEANSING_PROFILES } from '../pipes/profiles';
import { PipeEngine } from '../pipes/pipe-engine';
import { CleansingProfile } from '../enums/cleansing-profile.enum';
import type { PipeConfig } from '../interfaces/types';
import type { BrowserActionOptions } from '../interfaces/browser-action-options';
import { BROWSER_ACTION_OPTIONS } from '../constants/browser-action.constants';

export type CleansingPipeClass = new (...args: unknown[]) => CleansingPipe;

@Injectable()
export class CleansingService {
  constructor(
    @Optional()
    @Inject(BROWSER_ACTION_OPTIONS)
    options?: BrowserActionOptions,
  ) {
    if (options?.customPipes) {
      this.registerPipes(options.customPipes);
    }
  }

  registerPipe(type: string, pipeClass: CleansingPipeClass): void {
    PIPE_REGISTRY[type] = pipeClass;
  }

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
    const profileRules = CLEANSING_PROFILES[profileName];
    const engine = new PipeEngine();
    return engine.apply(data, profileRules) as T;
  }

  buildPipes(config: PipeConfig[]): CleansingPipe[] {
    const pipes: CleansingPipe[] = [];

    for (const pipeConfig of config) {
      const PipeClass = PIPE_REGISTRY[pipeConfig.type];

      if (!PipeClass) {
        continue;
      }

      try {
        const { primaryPipes, fallbackPipes, ...rest } = pipeConfig;
        const pipeInstance = plainToClass(PipeClass, rest);

        if (primaryPipes) {
          (pipeInstance as AltFlagPipe).primaryPipes =
            this.buildPipes(primaryPipes);
        }
        if (fallbackPipes) {
          (pipeInstance as AltFlagPipe).fallbackPipes =
            this.buildPipes(fallbackPipes);
        }

        pipes.push(pipeInstance);
      } catch {
        continue;
      }
    }

    return pipes;
  }
}
