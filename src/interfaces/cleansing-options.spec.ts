import {
  CleansingOptions,
  CleansingWithAltOptions,
  ScrapeCleansingOptions,
} from './cleansing-options';
import { CleansingProfile } from '../enums/cleansing-profile.enum';

describe('CleansingOptions Interfaces', () => {
  describe('CleansingOptions', () => {
    it('should accept pipes array', () => {
      const options: CleansingOptions = {
        pipes: [{ type: 'trim' }, { type: 'to-number' }],
      };
      expect(options.pipes).toBeDefined();
      expect(options.pipes?.length).toBe(2);
    });

    it('should accept profile', () => {
      const options: CleansingOptions = {
        profile: CleansingProfile.PRICE,
      };
      expect(options.profile).toBe(CleansingProfile.PRICE);
    });
  });

  describe('CleansingWithAltOptions', () => {
    it('should accept primary and fallback pipes', () => {
      const options: CleansingWithAltOptions = {
        primaryPipes: [{ type: 'trim' }],
        fallbackPipes: [{ type: 'to-number' }],
        fallbackOn: 'all',
      };
      expect(options.primaryPipes).toBeDefined();
      expect(options.fallbackPipes).toBeDefined();
      expect(options.fallbackOn).toBe('all');
    });
  });

  describe('ScrapeCleansingOptions', () => {
    it('should accept record of pipe arrays', () => {
      const options: ScrapeCleansingOptions = {
        pipes: {
          price: [{ type: 'trim' }],
          title: [{ type: 'to-lower-case' }],
        },
      };
      expect(options.pipes).toBeDefined();
      expect(Object.keys(options.pipes || {})).toHaveLength(2);
    });
  });
});
