import { DateFormatPipe } from './date-format.pipe';

describe('DateFormatPipe', () => {
  let pipe: DateFormatPipe;

  beforeEach(() => {
    pipe = new DateFormatPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should format a date string to specified format', () => {
    const input = '2023-12-25';
    const expected = '25/12/2023';
    pipe.format = 'dd/MM/yyyy';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle timestamp', () => {
    const input = '1703500800'; // Unix timestamp
    const expected = '25/12/2023';
    pipe.format = 'dd/MM/yyyy';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle date object', () => {
    const input = new Date('2023-12-25');
    const expected = '25/12/2023';
    pipe.format = 'dd/MM/yyyy';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle different formats', () => {
    const input = '2023-12-25T10:30:00Z';
    pipe.format = 'yyyy-MM-dd HH:mm';
    const result = pipe.exec(input);
    expect(result).toContain('2023-12-25');
  });

  it('should handle timezone conversion', () => {
    const input = '2023-12-25T10:30:00Z';
    pipe.format = 'yyyy-MM-dd HH:mm';
    pipe.timezone = 'Asia/Jakarta';
    const result = pipe.exec(input);
    expect(result).toContain('2023');
    expect(result).toContain('12');
    expect(result).toContain('25');
  });

  it('should handle relative time format', () => {
    const date = new Date();
    date.setHours(date.getHours() - 2);
    pipe.format = 'relative';
    const result = pipe.exec(date);
    expect(result).toContain('hours');
  });

  it('should handle Unix timestamp output', () => {
    const input = '2023-12-25';
    pipe.format = 'X';
    const result = pipe.exec(input);
    expect(result).toMatch(/^\d+$/);
  });

  it('should handle null input', () => {
    expect(pipe.exec(null)).toBeNull();
  });

  it('should handle undefined input', () => {
    expect(pipe.exec(undefined)).toBeUndefined();
  });

  it('should handle invalid date', () => {
    const input = 'invalid-date';
    expect(pipe.exec(input)).toBe('invalid-date');
  });

  it('should handle empty string', () => {
    const input = '';
    expect(pipe.exec(input)).toBe('');
  });

  it('should handle non-date input', () => {
    expect(pipe.exec(123)).toBe('123');
    expect(pipe.exec({})).toEqual('[object Object]');
  });

  it('should use default format if not specified', () => {
    const input = '2023-12-25';
    pipe.format = undefined;
    const result = pipe.exec(input);
    expect(result).toBeDefined();
    expect(result).toContain('2023');
  });

  it('should handle custom locale', () => {
    const input = '2023-12-25';
    pipe.format = 'LL';
    pipe.locale = 'de';
    const result = pipe.exec(input);
    expect(result).toBeDefined();
    expect(result).toContain('2023');
  });
});
