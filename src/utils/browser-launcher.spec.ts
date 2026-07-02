import { validateRemoteOptions } from './browser-launcher';
import { ERROR_MESSAGES } from '../constants/browser-action.constants';

describe('browser-launcher', () => {
  describe('validateRemoteOptions', () => {
    it('passes with only browserURL', () => {
      expect(() =>
        validateRemoteOptions({ browserURL: 'http://localhost:9222' }),
      ).not.toThrow();
    });

    it('passes with undefined', () => {
      expect(() => validateRemoteOptions(undefined)).not.toThrow();
    });

    it('throws when both endpoints provided', () => {
      expect(() =>
        validateRemoteOptions({
          browserURL: 'http://x',
          browserWSEndpoint: 'ws://y',
        }),
      ).toThrow(ERROR_MESSAGES.REMOTE_BOTH_PROVIDED);
    });

    it('throws when neither endpoint provided', () => {
      expect(() => validateRemoteOptions({})).toThrow(
        ERROR_MESSAGES.REMOTE_NONE_PROVIDED,
      );
    });
  });
});
