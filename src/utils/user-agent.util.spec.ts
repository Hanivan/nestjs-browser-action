import { getRandomUserAgent } from './user-agent.util';

describe('getRandomUserAgent', () => {
  it('returns a non-empty string', () => {
    const ua = getRandomUserAgent();
    expect(typeof ua).toBe('string');
    expect(ua.length).toBeGreaterThan(0);
  });

  it('contains Chrome in the UA string', () => {
    const ua = getRandomUserAgent();
    expect(ua).toContain('Chrome');
  });

  it('returns different values across calls (rotation)', () => {
    const results = new Set(
      Array.from({ length: 20 }, () => getRandomUserAgent()),
    );
    expect(results.size).toBeGreaterThan(1);
  });
});
