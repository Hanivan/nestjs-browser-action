import { CleansingType } from '../enums/cleansing-type.enum';

/**
 * Abstract base class for all cleansing pipes.
 *
 * @template TInput - Input type for the transformation
 * @template TOutput - Output type for the transformation
 */
export abstract class CleansingPipe<TInput = unknown, TOutput = unknown> {
  /**
   * Execute the transformation.
   * @param value - Input value to transform
   * @returns Transformed value
   */
  abstract exec(value: TInput): TOutput;

  /**
   * The type of this pipe for mapping purposes.
   */
  readonly type?: CleansingType | string;

  /**
   * Optional reverse transformation. No-op by default.
   * @param value - The value to reverse transform
   * @returns The original value
   */
  reverse(value: TOutput): TInput {
    return value as unknown as TInput;
  }
}

/**
 * Type for custom pipe instance
 */
export type CustomPipe = CleansingPipe;

/**
 * Map of custom pipe names to pipe instances
 */
export type CustomPipeMap = Record<string, CustomPipe>;
