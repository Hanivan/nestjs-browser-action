import { RegexReplacePipe } from './regex-replace.pipe';

describe('RegexReplacePipe', () => {
  let pipe: RegexReplacePipe;

  beforeEach(() => {
    pipe = new RegexReplacePipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should replace text using regex pattern', () => {
    const input = 'Hello 123 World 456';
    pipe.pattern = /\d+/g as any;
    pipe.replacement = 'NUMBER';
    const expected = 'Hello NUMBER World NUMBER';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should replace with empty string', () => {
    const input = 'Hello123World456';
    pipe.pattern = /\d+/g as any;
    pipe.replacement = '';
    const expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle case-insensitive replacement', () => {
    const input = 'Hello WORLD world';
    pipe.pattern = /world/ as any;
    pipe.replacement = 'EARTH';
    pipe.flags = 'gi';
    const expected = 'Hello EARTH EARTH';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should replace only first occurrence when no global flag', () => {
    const input = 'test test test';
    pipe.pattern = /test/ as any;
    pipe.replacement = 'example';
    pipe.flags = '';
    const expected = 'example test test';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should replace all occurrences with global flag', () => {
    const input = 'test test test';
    pipe.pattern = /test/ as any;
    pipe.replacement = 'example';
    pipe.flags = 'g';
    const expected = 'example example example';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should capture groups and replace', () => {
    const input = 'John Doe, Jane Smith';
    pipe.pattern = /(\w+) (\w+)/g as any;
    pipe.replacement = '$2, $1';
    const expected = 'Doe, John, Smith, Jane';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle null input', () => {
    expect(pipe.exec(null as unknown as string)).toBeNull();
  });

  it('should handle undefined input', () => {
    expect(pipe.exec(undefined as unknown as string)).toBeUndefined();
  });

  it('should handle non-string input', () => {
    expect(pipe.exec(123 as unknown as string)).toBe(123);
    expect(pipe.exec({} as unknown as string)).toEqual({});
  });

  it('should handle empty string', () => {
    const input = '';
    pipe.pattern = /test/g as any;
    pipe.replacement = 'example';
    expect(pipe.exec(input)).toBe('');
  });

  it('should handle no matches', () => {
    const input = 'Hello World';
    pipe.pattern = /123/g as any;
    pipe.replacement = 'NUMBER';
    expect(pipe.exec(input)).toBe('Hello World');
  });
});
