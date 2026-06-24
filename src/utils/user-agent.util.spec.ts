import { getRandomUserAgent } from './user-agent.util';

describe('getRandomUserAgent', () => {
  it('returns a non-empty string', () => {
    const ua = getRandomUserAgent();
    expect(typeof ua).toBe('string');
    expect(ua.length).toBeGreaterThan(0);
  });

  it('returns different values across calls', () => {
    const results = new Set(
      Array.from({ length: 20 }, () => getRandomUserAgent()),
    );
    expect(results.size).toBeGreaterThan(1);
  });
});
