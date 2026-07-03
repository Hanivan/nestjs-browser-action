import {
  getBrowserToken,
  getPageToken,
  getPageControllerToken,
  getNamedOptionsToken,
  claimBrowserName,
  releaseBrowserName,
  registerPages,
  releasePageCount,
} from './tokens';

describe('tokens', () => {
  it('derives browser token', () => {
    expect(getBrowserToken('stealth')).toBe('stealthBrowserActionBrowser');
  });

  it('derives page token', () => {
    expect(getPageToken('login', 'stealth')).toBe(
      'stealth_loginBrowserActionPage',
    );
  });

  it('derives page controller token', () => {
    expect(getPageControllerToken('login', 'stealth')).toBe(
      'stealth_loginBrowserActionPageController',
    );
  });

  it('derives named options token', () => {
    expect(getNamedOptionsToken('stealth')).toBe(
      'BROWSER_ACTION_OPTIONS:stealth',
    );
  });

  describe('name registry', () => {
    afterEach(() => releaseBrowserName('dup'));

    it('claims a free name', () => {
      expect(() => claimBrowserName('dup')).not.toThrow();
    });

    it('throws on duplicate claim', () => {
      claimBrowserName('dup');
      expect(() => claimBrowserName('dup')).toThrow(
        /browser with name "dup" is already registered/,
      );
    });

    it('release makes name claimable again', () => {
      claimBrowserName('dup');
      releaseBrowserName('dup');
      expect(() => claimBrowserName('dup')).not.toThrow();
    });
  });

  describe('page-count registry', () => {
    afterEach(() => {
      releasePageCount('pages-test');
      releasePageCount('pages-test-2');
    });

    it('accumulates page counts across multiple registerPages calls for the same browser', () => {
      expect(registerPages('pages-test', 3)).toBe(3);
      expect(registerPages('pages-test', 2)).toBe(5);
    });

    it('tracks separate browsers independently', () => {
      expect(registerPages('pages-test', 4)).toBe(4);
      expect(registerPages('pages-test-2', 1)).toBe(1);
    });

    it('releasePageCount resets the counter for that browser back to zero', () => {
      registerPages('pages-test', 5);
      releasePageCount('pages-test');
      expect(registerPages('pages-test', 1)).toBe(1);
    });
  });
});
