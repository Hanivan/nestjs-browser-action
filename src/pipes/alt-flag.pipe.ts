import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Alternative fallback pipe that tries primary, then fallback if result is empty/null/undefined
 */
export class AltFlagPipe extends CleansingPipe<unknown, unknown> {
  type = CleansingType.ALT_FLAG;

  @IsArray()
  primaryPipes: CleansingPipe[];

  @IsArray()
  fallbackPipes: CleansingPipe[];

  @IsEnum(['empty', 'null', 'undefined', 'all'])
  @IsOptional()
  fallbackOn?: 'empty' | 'null' | 'undefined' | 'all' = 'all';

  exec(value: unknown): unknown {
    // Execute primary pipes
    let primaryResult = value;
    for (const pipe of this.primaryPipes) {
      primaryResult = pipe.exec(primaryResult);
    }

    // Check if we should trigger fallback
    if (this.shouldTriggerFallback(primaryResult)) {
      let fallbackResult = value;
      for (const pipe of this.fallbackPipes) {
        fallbackResult = pipe.exec(fallbackResult);
      }
      return fallbackResult;
    }

    return primaryResult;
  }

  private shouldTriggerFallback(value: unknown): boolean {
    switch (this.fallbackOn) {
      case 'empty':
        // Note: Only checks for empty string, not arrays/objects/whitespace
        return value === '';
      case 'null':
        return value === null;
      case 'undefined':
        return value === undefined;
      case 'all':
      default:
        return value === null || value === undefined || value === '';
    }
  }
}
