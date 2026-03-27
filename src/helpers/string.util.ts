/**
 * String manipulation utility functions
 * Reduces code duplication across pipes and helpers
 */

/**
 * Normalize whitespace in a string:
 * - Replace all whitespace sequences (spaces, tabs, newlines) with single spaces
 * - Trim leading and trailing whitespace
 *
 * @example
 * normalizeWhitespace("  hello    world\n\t  ") // "hello world"
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}
