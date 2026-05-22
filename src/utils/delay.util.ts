/**
 * Delays execution for a specified number of milliseconds
 *
 * @param ms - Number of milliseconds to delay
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```typescript
 * await delay(1000); // Wait for 1 second
 * ```
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
