import { CleansingOptions, ScrapeCleansingOptions } from './cleansing-options';
import { CleansingProfile } from '../enums/cleansing-profile.enum';
import { CleansingType } from '../enums/cleansing-type.enum';

describe('CleansingOptions Interfaces', () => {
  describe('CleansingOptions', () => {
    it('should accept CleanerStepRules object', () => {
      const options: CleansingOptions = {
        pipes: { trim: true, toLowerCase: true },
      };
      expect(options.pipes?.trim).toBe(true);
      expect(options.pipes?.toLowerCase).toBe(true);
    });

    it('should accept pipes with custom array', () => {
      const options: CleansingOptions = {
        pipes: {
          trim: true,
          custom: [
            { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$', '€'] },
            { type: CleansingType.TO_NUMBER, decimals: 2 },
          ],
        },
      };
      expect(options.pipes?.custom).toHaveLength(2);
    });

    it('should accept profile', () => {
      const options: CleansingOptions = { profile: CleansingProfile.PRICE };
      expect(options.profile).toBe(CleansingProfile.PRICE);
    });

    it('should accept pipes with replace rules', () => {
      const options: CleansingOptions = {
        pipes: { replace: [{ from: '\\s+', to: ' ' }] },
      };
      expect(options.pipes?.replace).toHaveLength(1);
    });
  });

  describe('ScrapeCleansingOptions', () => {
    it('should accept record of CleanerStepRules', () => {
      const options: ScrapeCleansingOptions = {
        pipes: {
          price: { trim: true, custom: [{ type: CleansingType.TO_NUMBER }] },
          title: { trim: true, toLowerCase: true },
        },
      };
      expect(options.pipes).toBeDefined();
      expect(Object.keys(options.pipes || {})).toHaveLength(2);
      expect(options.pipes?.price?.trim).toBe(true);
    });

    it('should accept empty pipes object', () => {
      const options: ScrapeCleansingOptions = { pipes: {} };
      expect(options.pipes).toBeDefined();
    });
  });
});
