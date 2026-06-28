import { RemoveSpecialCharsPipe } from './remove-special-chars.pipe';

describe('RemoveSpecialCharsPipe', () => {
  let pipe: RemoveSpecialCharsPipe;

  beforeEach(() => {
    pipe = new RemoveSpecialCharsPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should remove special characters', () => {
    const input = "Hello! How are you? I'm fine, thanks!";
    const expected = 'Hello How are you Im fine thanks';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove punctuation', () => {
    const input = 'Hello, World! This is a test...';
    const expected = 'Hello World This is a test';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove symbols', () => {
    const input = 'Price: $100.50 | Location: @NYC | Phone: #123-456-7890';
    const expected = 'Price 10050 Location NYC Phone 1234567890';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should preserve alphanumeric characters', () => {
    const input = 'ABC123 abc123 123';
    const expected = 'ABC123 abc123 123';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should preserve spaces', () => {
    const input = 'Keep spaces between words';
    const expected = 'Keep spaces between words';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove newlines and tabs', () => {
    const input = 'Line 1\nLine 2\tTabbed';
    const expected = 'Line 1 Line 2 Tabbed';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle unicode characters', () => {
    const input = 'Hello 世界! 🌍 How are you?';
    const expected = 'Hello 世界 How are you';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle numbers only', () => {
    const input = '123-456-7890';
    const expected = '1234567890';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle empty string', () => {
    const input = '';
    expect(pipe.exec(input)).toBe('');
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

  it('should allow custom characters', () => {
    pipe.allowedChars = '.,- ';
    const input = 'Hello, World! This-is-a test...';
    const expected = 'Hello, World This-is-a test...';
    const result = pipe.exec(input);
    expect(result).toBe(expected);
  });

  it('should allow only letters and spaces', () => {
    pipe.allowedChars = 'a-zA-Z ';
    const input = 'Hello123 World! @Test';
    const expected = 'Hello123 World Test';
    const result = pipe.exec(input);
    expect(result).toBe(expected);
  });
});
