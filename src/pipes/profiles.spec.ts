import { CLEANSING_PROFILES } from './profiles';
import { CleansingProfile } from '../enums/cleansing-profile.enum';
import { CleansingType } from '../enums/cleansing-type.enum';

describe('Cleansing Profiles', () => {
  it('should have all expected profiles defined', () => {
    expect(CLEANSING_PROFILES[CleansingProfile.PRICE]).toBeDefined();
    expect(CLEANSING_PROFILES[CleansingProfile.PHONE]).toBeDefined();
    expect(CLEANSING_PROFILES[CleansingProfile.EMAIL]).toBeDefined();
    expect(CLEANSING_PROFILES[CleansingProfile.DATE]).toBeDefined();
    expect(CLEANSING_PROFILES[CleansingProfile.CURRENCY]).toBeDefined();
  });

  it('should have pipes array for each profile', () => {
    Object.values(CLEANSING_PROFILES).forEach((profile) => {
      expect(profile).toBeDefined();
      expect(Array.isArray(profile)).toBe(true);
      expect(profile.length).toBeGreaterThan(0);
    });
  });

  it('should have valid pipe objects in each profile', () => {
    Object.values(CLEANSING_PROFILES).forEach((profile) => {
      profile.forEach((pipe: any) => {
        expect(pipe).toHaveProperty('type');
        expect(typeof pipe.type).toBe('string');
        expect(pipe.type).toMatch(
          /trim|remove-currency-symbol|remove-special-chars|to-number|regex-extract|to-lower-case|date-format/i,
        );
      });
    });
  });

  it('should have 5 profiles defined', () => {
    const profileCount = Object.keys(CLEANSING_PROFILES).length;
    expect(profileCount).toBe(5);
  });

  it('should have correct PRICE profile structure', () => {
    const priceProfile = CLEANSING_PROFILES[CleansingProfile.PRICE];

    expect(Array.isArray(priceProfile)).toBe(true);
    expect(priceProfile).toHaveLength(4);

    expect(priceProfile[0]).toEqual({ type: CleansingType.TRIM });
    expect(priceProfile[1]).toEqual({
      type: CleansingType.REMOVE_CURRENCY_SYMBOL,
      params: { symbols: ['$', '€', '£', '¥'] },
    });
    expect(priceProfile[2]).toEqual({
      type: CleansingType.REMOVE_SPECIAL_CHARS,
      params: { pattern: '[^0-9.]' },
    });
    expect(priceProfile[3]).toEqual({
      type: CleansingType.TO_NUMBER,
      params: { decimals: 2 },
    });
  });
});
