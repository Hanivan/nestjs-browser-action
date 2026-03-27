/**
 * Truncates a log message to the specified maximum length, appending '…' if truncated.
 * Pass 0 (or omit maxLength) to disable truncation.
 *
 * @example
 * truncateLog('Hello World', 5); // 'Hello…'
 * truncateLog('Hello World', 0); // 'Hello World'
 */
export function truncateLog(maxLength: number, msg: string): string {
  if (!maxLength || msg.length <= maxLength) return msg;
  return `${msg.slice(0, maxLength)}…`;
}
