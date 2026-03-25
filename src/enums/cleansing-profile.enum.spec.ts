import { CleansingProfile } from './cleansing-profile.enum';

describe('CleansingProfile', () => {
  it('should have all expected profile names', () => {
    expect(CleansingProfile.PRICE).toBe('price');
    expect(CleansingProfile.PHONE).toBe('phone');
    expect(CleansingProfile.EMAIL).toBe('email');
    expect(CleansingProfile.DATE).toBe('date');
    expect(CleansingProfile.CURRENCY).toBe('currency');
  });

  it('should have 5 profiles total', () => {
    const values = Object.values(CleansingProfile);
    expect(values.length).toBe(5);
  });
});
