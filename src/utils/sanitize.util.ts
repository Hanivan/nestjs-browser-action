/**
 * Credential sanitization for log output.
 * Masks passwords, tokens, and API keys before they reach log aggregation.
 */

/** Known sensitive key names across authentication, secrets, and credentials. */
const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'authToken',
  'accessToken',
  'refreshToken',
  'privateKey',
  'passphrase',
  'credential',
  'credentials',
  'bearer',
  'cookie',
  'session',
  'apiSecret',
  'api_secret',
  'clientSecret',
  'client_secret',
  'clientId',
  'client_id',
  'signingKey',
  'encryptionKey',
  'decryptionKey',
  'sshKey',
  'cert',
  'certificate',
  'otp',
  'pin',
  'salt',
  'hash',
  'seed',
  'mnemonic',
  'xsrfToken',
  'csrfToken',
]);

/** Redaction placeholder for sanitized values. */
const REDACTED_VALUE = '***';

/** URL scheme with embedded credentials: `scheme://user:pass@host` */
const URL_CREDENTIAL_PATTERN = /(\w+:\/\/)([^:]+):([^@]+)@/g;

/** Replacement that preserves the scheme and host but masks credentials. */
const URL_CREDENTIAL_REPLACEMENT = '$1***:***@';

/** Mask credentials embedded in URLs: `http://user:pass@host` → `http://***:***@host` */
function maskUrlCredentials(value: string): string {
  return value.replace(URL_CREDENTIAL_PATTERN, URL_CREDENTIAL_REPLACEMENT);
}

/**
 * Recursively sanitize a value for safe logging.
 * - Masks credentials in URL strings
 * - Redacts values of sensitive keys in objects
 * - Recurses into arrays and objects
 */
export function sanitizeForLog(value: unknown): unknown {
  if (typeof value === 'string') {
    return maskUrlCredentials(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) {
        result[k] = REDACTED_VALUE;
      } else {
        result[k] = sanitizeForLog(v);
      }
    }
    return result;
  }
  return value;
}

/**
 * Sanitize an Error message that may contain credentials in URLs.
 */
export function sanitizeErrorMessage(message: string): string {
  return maskUrlCredentials(message);
}
