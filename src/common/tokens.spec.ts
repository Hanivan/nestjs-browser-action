import {
  getBrowserToken,
  getPageToken,
  getPageControllerToken,
  getNamedOptionsToken,
  claimBrowserName,
  releaseBrowserName,
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
});
