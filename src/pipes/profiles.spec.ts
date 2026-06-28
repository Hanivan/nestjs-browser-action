import { CLEANSING_PROFILES } from './profiles';
import { CleansingProfile } from '../enums/cleansing-profile.enum';
import { CleansingType } from '../enums/cleansing-type.enum';

describe('Cleansing Profiles', () => {
  it('should have all 5 profiles defined', () => {
    expect(Object.keys(CLEANSING_PROFILES)).toHaveLength(5);
    expect(CLEANSING_PROFILES[CleansingProfile.PRICE]).toBeDefined();
    expect(CLEANSING_PROFILES[CleansingProfile.PHONE]).toBeDefined();
    expect(CLEANSING_PROFILES[CleansingProfile.EMAIL]).toBeDefined();
    expect(CLEANSING_PROFILES[CleansingProfile.DATE]).toBeDefined();
    expect(CLEANSING_PROFILES[CleansingProfile.CURRENCY]).toBeDefined();
  });

  it('each profile should be a CleanerStepRules object (not an array)', () => {
    Object.values(CLEANSING_PROFILES).forEach((profile) => {
      expect(typeof profile).toBe('object');
      expect(Array.isArray(profile)).toBe(false);
    });
  });

  it('should have correct PRICE profile structure', () => {
    const priceProfile = CLEANSING_PROFILES[CleansingProfile.PRICE];
    expect(priceProfile.trim).toBe(true);
    expect(Array.isArray(priceProfile.custom)).toBe(true);
    expect(priceProfile.custom!.length).toBeGreaterThan(0);
    // custom entries should include remove-currency-symbol and to-number
    const types = priceProfile.custom!.map((c) => c.type as string);
    expect(types).toContain(CleansingType.REMOVE_CURRENCY_SYMBOL);
    expect(types).toContain(CleansingType.TO_NUMBER);
  });

  it('each profile with custom pipes should have type string on each entry', () => {
    Object.values(CLEANSING_PROFILES).forEach((profile) => {
      if (profile.custom) {
        profile.custom.forEach((pipe) => {
          expect(typeof pipe.type).toBe('string');
        });
      }
    });
  });
});
