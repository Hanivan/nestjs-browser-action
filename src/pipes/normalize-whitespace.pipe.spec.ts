import { NormalizeWhitespacePipe } from './normalize-whitespace.pipe';

describe('NormalizeWhitespacePipe', () => {
  let pipe: NormalizeWhitespacePipe;

  beforeEach(() => {
    pipe = new NormalizeWhitespacePipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should collapse multiple spaces to single space', () => {
    const input = 'Hello    World';
    const expected = 'Hello World';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should normalize line breaks and spaces', () => {
    const input = 'Hello\n\nWorld\r\r\nTest';
    const expected = 'Hello World Test';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should normalize tabs and spaces', () => {
    const input = 'Hello\t\t\tWorld';
    const expected = 'Hello World';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should trim leading and trailing whitespace', () => {
    const input = '  Hello World  ';
    const expected = 'Hello World';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should preserve single spaces between words', () => {
    const input = 'Hello   World   from   pipe';
    const expected = 'Hello World from pipe';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle empty string', () => {
    const input = '';
    const expected = '';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle string with only whitespace', () => {
    const input = '   \n\r\t   ';
    const expected = '';
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

  it('should preserve Unicode whitespace handling', () => {
    const input = 'Hello\u2003\u2004\u2005World'; // Em space, three-per-em space, four-per-em space
    const expected = 'Hello World';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should normalize mixed whitespace characters', () => {
    const input = 'Hello\u00A0\u202FWorld'; // Non-breaking space, narrow no-break space
    const expected = 'Hello World';
    expect(pipe.exec(input)).toBe(expected);
  });
});
