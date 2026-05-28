/**
 * Regex safety utilities
 * Detects patterns known to cause catastrophic backtracking (ReDoS)
 */

/**
 * Security: detect dangerous regex patterns that cause catastrophic backtracking.
 *
 * Rejects nested quantifiers such as `(a+)+`, `(a*)*`, `(a+)*`, etc.
 * These patterns cause exponential execution time on certain inputs.
 *
 * @param pattern Regex pattern string
 * @returns `true` if the pattern appears safe
 */
export function isSafeRegex(pattern: string): boolean {
  // Reject nested quantifiers that cause catastrophic backtracking
  const dangerous = /\([^)]*[+*]\)[+*]/;
  return !dangerous.test(pattern);
}
