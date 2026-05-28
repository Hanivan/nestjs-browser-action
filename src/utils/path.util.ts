/**
 * Path sanitization utilities
 * Prevents directory traversal and unsafe absolute paths
 */

/**
 * Security: prevent path traversal in screenshot/file paths.
 * Strips `..` sequences and backslashes, rejects absolute paths.
 *
 * @param input Raw path string from user input
 * @returns Sanitized relative path
 * @throws If the path is absolute
 */
export function sanitizeScreenshotPath(input: string): string {
  const normalized = input
    .replace(/\\/g, '/')
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '');
  if (normalized.startsWith('/')) {
    throw new Error('Absolute paths are not allowed for screenshots');
  }
  return normalized;
}
