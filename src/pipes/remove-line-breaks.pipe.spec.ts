import { RemoveLineBreaksPipe } from './remove-line-breaks.pipe';

describe('RemoveLineBreaksPipe', () => {
  let pipe: RemoveLineBreaksPipe;

  beforeEach(() => {
    pipe = new RemoveLineBreaksPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should remove all line breaks', () => {
    const input = 'Hello\nWorld';
    const expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove carriage returns', () => {
    const input = 'Hello\rWorld';
    const expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove CRLF sequences', () => {
    const input = 'Hello\r\nWorld';
    const expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove multiple line breaks', () => {
    const input = 'Hello\n\n\nWorld';
    const expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle mixed line breaks', () => {
    const input = 'Hello\r\n\nWorld\r';
    const expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove vertical tabs', () => {
    const input = 'Hello\vWorld';
    const expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove form feeds', () => {
    const input = 'Hello\fWorld';
    const expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove Unicode line separators', () => {
    const input = 'Hello\u2028World\u2029';
    const expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should replace with space if specified', () => {
    pipe.replaceWithSpace = true;
    const input = 'Hello\nWorld';
    const expected = 'Hello World';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle empty string', () => {
    const input = '';
    const expected = '';
    expect(pipe.exec(input)).toBe(expected);
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

  it('should handle string with only line breaks', () => {
    const input = '\n\r\n\r\v\f\u2028\u2029';
    const expected = '';
    expect(pipe.exec(input)).toBe(expected);
  });
});
