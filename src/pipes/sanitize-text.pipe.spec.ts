import { SanitizeTextPipe } from './sanitize-text.pipe';

describe('SanitizeTextPipe', () => {
  let pipe: SanitizeTextPipe;

  beforeEach(() => {
    pipe = new SanitizeTextPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should remove HTML tags', () => {
    const input = '<p>Hello <b>World</b></p>';
    const expected = 'Hello World';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove XSS characters', () => {
    const input = 'Hello<script>alert("XSS")</script>World';
    const expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove iframe tags', () => {
    const input = 'Hello<iframe src="malicious.com"></iframe>World';
    const expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove object tags', () => {
    const input = 'Hello<object data="malicious"></object>World';
    expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove embed tags', () => {
    const input = 'Hello<embed src="malicious"></embed>World';
    expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove applet tags', () => {
    const input = 'Hello<applet>malicious</applet>World';
    expected = 'HelloWorld';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should remove link with javascript protocol', () => {
    const input = 'Hello<a href="javascript:alert()">Click</a>';
    expected = 'HelloClick';
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

  it('should preserve harmless HTML entities', () => {
    const input = 'Hello &amp; &lt;3 &gt; &quot;';
    const expected = 'Hello & <3 > "';
    expect(pipe.exec(input)).toBe(expected);
  });
});
