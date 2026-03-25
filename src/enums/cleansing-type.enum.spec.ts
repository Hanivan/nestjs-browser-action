import { CleansingType } from './cleansing-type.enum';

describe('CleansingType', () => {
  it('should have all expected pipe types', () => {
    expect(CleansingType.TRIM).toBe('trim');
    expect(CleansingType.TO_NUMBER).toBe('to-number');
    expect(CleansingType.TO_LOWER_CASE).toBe('to-lower-case');
    expect(CleansingType.TO_UPPER_CASE).toBe('to-upper-case');
    expect(CleansingType.SANITIZE_TEXT).toBe('sanitize-text');
    expect(CleansingType.DATE_FORMAT).toBe('date-format');
    expect(CleansingType.REGEX_REPLACE).toBe('regex-replace');
    expect(CleansingType.REGEX_EXTRACT).toBe('regex-extract');
    expect(CleansingType.REMOVE_CURRENCY_SYMBOL).toBe('remove-currency-symbol');
    expect(CleansingType.REMOVE_SPECIAL_CHARS).toBe('remove-special-chars');
    expect(CleansingType.NORMALIZE_WHITESPACE).toBe('normalize-whitespace');
    expect(CleansingType.REMOVE_LINE_BREAKS).toBe('remove-line-breaks');
    expect(CleansingType.ALT_FLAG).toBe('alt-flag');
  });

  it('should have 13 types total', () => {
    const values = Object.values(CleansingType);
    expect(values.length).toBe(13);
  });
});
