import { Exclude } from 'class-transformer';
import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Abstract base class for all cleansing pipes
 * Inspired by forum-crawler's PipeRule pattern
 *
 * @template TInput - Input type for the transformation
 * @template TOutput - Output type for the transformation
 */
export abstract class CleansingPipe<TInput = unknown, TOutput = unknown> {
  /**
   * Custom configuration (excluded from plain serialization)
   * Allows pipes to carry runtime-only data
   */
  @Exclude({ toPlainOnly: true })
  customConfig?: Record<string, unknown>;

  /**
   * Execute the transformation
   * @param value - Input value to transform
   * @returns Transformed value
   */
  abstract exec(value: TInput): TOutput;

  /**
   * The type of this pipe for mapping purposes
   */
  abstract type: CleansingType | string;

  /**
   * Reverse the transformation (optional)
   * @returns Original input value
   * @throws Error if not implemented
   */
  reverse?(): TInput {
    throw new Error('Reverse transformation not implemented');
  }
}
