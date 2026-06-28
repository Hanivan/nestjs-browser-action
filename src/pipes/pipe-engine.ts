import { Logger } from '@nestjs/common';
import { decode } from 'html-entities';
import { plainToClass } from 'class-transformer';
import { CleansingPipe } from './cleansing-pipe';
import { PIPE_REGISTRY } from './pipe-registry';

export interface CleanerRule {
  from: string;
  to: string;
}

export interface CleanerStepRules {
  trim?: boolean;
  toLowerCase?: boolean;
  toUpperCase?: boolean;
  replace?: CleanerRule[];
  decode?: boolean;
  merge?: boolean | 'with space' | 'with comma';
  custom?: Array<Record<string, unknown>>;
}

export class PipeEngine {
  private readonly logger = new Logger(PipeEngine.name);

  apply(value: string, pipes?: CleanerStepRules, url?: string): string {
    if (!pipes || !value) {
      return value;
    }

    let result = value;

    if (pipes.decode) {
      result = decode(result);
    }

    if (pipes.toLowerCase) {
      result = result.toLowerCase();
    }

    if (pipes.toUpperCase) {
      result = result.toUpperCase();
    }

    if (pipes.trim) {
      result = result.trim();
    }

    if (pipes.replace) {
      for (const replacement of pipes.replace) {
        result = result.replace(
          new RegExp(replacement.from, 'g'),
          replacement.to,
        );
      }
    }

    if (pipes.custom && pipes.custom.length > 0) {
      const customPipes = this.instantiate(pipes.custom, url);

      for (const customPipe of customPipes) {
        if (typeof customPipe.exec === 'function') {
          try {
            const transformed = customPipe.exec(result);
            result =
              typeof transformed === 'string'
                ? transformed
                : String(transformed);
          } catch (error) {
            this.logger.error(`Custom pipe execution failed:`, error);
          }
        }
      }
    }

    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  private instantiate(
    pipeConfigs: Array<Record<string, unknown>>,
    url?: string,
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
        const pipe = plainToClass(PipeClass, config);

        if (url && 'baseUrl' in pipe) {
          (pipe as { baseUrl?: string }).baseUrl = url;
        }

        pipes.push(pipe);
      } catch {
        continue;
      }
    }

    return pipes;
  }

  register(type: string, PipeClass: new () => CleansingPipe): void {
    PIPE_REGISTRY[type] = PipeClass;
  }
}
