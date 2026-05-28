import { sanitizeForLog, sanitizeErrorMessage } from './sanitize.util';

describe('sanitizeForLog', () => {
  it('should mask credentials in HTTP URLs', () => {
    const result = sanitizeForLog(
      'http://admin:secret123@proxy.example.com:8080',
    );
    expect(result).toBe('http://***:***@proxy.example.com:8080');
  });

  it('should mask credentials in HTTPS URLs', () => {
    const result = sanitizeForLog('https://user:pass@host.com/path');
    expect(result).toBe('https://***:***@host.com/path');
  });

  it('should mask credentials in WebSocket URLs', () => {
    const result = sanitizeForLog('ws://user:pass@chrome.example.com:9222');
    expect(result).toBe('ws://***:***@chrome.example.com:9222');
  });

  it('should leave URLs without credentials unchanged', () => {
    const result = sanitizeForLog('http://proxy.example.com:8080');
    expect(result).toBe('http://proxy.example.com:8080');
  });

  it('should redact sensitive keys in objects', () => {
    const result = sanitizeForLog({
      server: 'http://proxy.com',
      username: 'admin',
      password: 'secret123',
      token: 'abc',
    });
    expect(result).toEqual({
      server: 'http://proxy.com',
      username: 'admin',
      password: '***',
      token: '***',
    });
  });

  it('should recursively sanitize nested objects', () => {
    const result = sanitizeForLog({
      proxy: {
        server: 'http://user:pass@proxy.com',
        password: 'secret',
      },
    });
    expect(result).toEqual({
      proxy: {
        server: 'http://***:***@proxy.com',
        password: '***',
      },
    });
  });

  it('should sanitize arrays', () => {
    const result = sanitizeForLog(['http://user:pass@a.com', 'http://b.com']);
    expect(result).toEqual(['http://***:***@a.com', 'http://b.com']);
  });

  it('should pass through primitives unchanged', () => {
    expect(sanitizeForLog(42)).toBe(42);
    expect(sanitizeForLog(true)).toBe(true);
    expect(sanitizeForLog(null)).toBe(null);
    expect(sanitizeForLog(undefined)).toBe(undefined);
  });
});

describe('sanitizeErrorMessage', () => {
  it('should mask credentials in error messages', () => {
    const msg = 'Failed to connect to ws://admin:secret@chrome:9222';
    expect(sanitizeErrorMessage(msg)).toBe(
      'Failed to connect to ws://***:***@chrome:9222',
    );
  });
});
