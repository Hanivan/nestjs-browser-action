import { ToNumberPipe } from './to-number.pipe';

describe('ToNumberPipe', () => {
  it('should convert string to number', () => {
    const pipe = new ToNumberPipe();
    expect(pipe.exec('123')).toBe(123);
  });

  it('should handle decimal numbers', () => {
    const pipe = new ToNumberPipe();
    pipe.decimals = 2;
    expect(pipe.exec('123.456')).toBe(123.46);
  });

  it('should round up with ceil rounding', () => {
    const pipe = new ToNumberPipe();
    pipe.decimals = 2;
    pipe.round = 'ceil';
    expect(pipe.exec('123.456')).toBe(123.46);
  });

  it('should round down with floor rounding', () => {
    const pipe = new ToNumberPipe();
    pipe.decimals = 2;
    pipe.round = 'floor';
    expect(pipe.exec('123.456')).toBe(123.45);
  });

  it('should return 0 for empty strings when nullifyEmpty is true', () => {
    const pipe = new ToNumberPipe();
    pipe.nullifyEmpty = true;
    expect(pipe.exec('')).toBe(0);
  });

  it('should return NaN for invalid strings by default', () => {
    const pipe = new ToNumberPipe();
    expect(isNaN(pipe.exec('abc'))).toBe(true);
  });

  it('should have type "to-number"', () => {
    const pipe = new ToNumberPipe();
    expect(pipe.type).toBe('to-number');
  });
});
