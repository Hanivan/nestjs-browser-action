import { RegexExtractPipe } from './regex-extract.pipe';

describe('RegexExtractPipe', () => {
  let pipe: RegexExtractPipe;

  beforeEach(() => {
    pipe = new RegexExtractPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should extract first match', () => {
    const input = 'Email: test@example.com and support@example.com';
    pipe.pattern = /\w+@\w+\.\w+/;
    const expected = 'test@example.com';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should extract all matches as array', () => {
    const input = 'Email: test@example.com and support@example.com';
    pipe.pattern = /\w+@\w+\.\w+/g;
    const expected = ['test@example.com', 'support@example.com'];
    expect(pipe.exec(input)).toEqual(expected);
  });

  it('should extract groups', () => {
    const input = 'John Doe, Jane Smith';
    pipe.pattern = /(\w+) (\w+)/g;
    const expected = [
      ['John', 'Doe'],
      ['Jane', 'Smith'],
    ];
    expect(pipe.exec(input)).toEqual(expected);
  });

  it('should extract named groups', () => {
    const input = '2023-12-25';
    pipe.pattern = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
    const expected = {
      year: '2023',
      month: '12',
      day: '25',
      '0': '2023-12-25',
      '1': '2023',
      '2': '12',
      '3': '25',
    };
    expect(pipe.exec(input)).toEqual(expected);
  });

  it('should return null when no matches found', () => {
    const input = 'Hello World';
    pipe.pattern = /\d+/g;
    expect(pipe.exec(input)).toBeNull();
  });

  it('should return null for empty string', () => {
    const input = '';
    pipe.pattern = /\w+/g;
    expect(pipe.exec(input)).toBeNull();
  });

  it('should handle null input', () => {
    expect(pipe.exec(null)).toBeNull();
  });

  it('should handle undefined input', () => {
    expect(pipe.exec(undefined)).toBeUndefined();
  });

  it('should handle non-string input', () => {
    expect(pipe.exec(123)).toBe(123);
    expect(pipe.exec({})).toEqual({});
  });

  it('should extract multiple patterns', () => {
    const input = 'Phone: 123-456-7890 and Email: test@example.com';
    pipe.pattern = /(\d{3}-\d{3}-\d{4})|(\w+@\w+\.\w+)/g;
    const expected = [
      ['123-456-7890', undefined],
      [undefined, 'test@example.com'],
    ];
    expect(pipe.exec(input)).toEqual(expected);
  });

  it('should extract with global flag', () => {
    const input = 'abc123def456ghi789';
    pipe.pattern = /\d+/g;
    const expected = ['123', '456', '789'];
    expect(pipe.exec(input)).toEqual(expected);
  });
});
