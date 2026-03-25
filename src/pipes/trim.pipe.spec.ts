import { TrimPipe } from './trim.pipe';

describe('TrimPipe', () => {
  it('should trim both sides by default', () => {
    const pipe = new TrimPipe();
    expect(pipe.exec('  hello  ')).toBe('hello');
  });

  it('should trim start only when trimStart is true', () => {
    const pipe = new TrimPipe();
    pipe.trimStart = true;
    expect(pipe.exec('  hello  ')).toBe('hello  ');
  });

  it('should trim end only when trimEnd is true', () => {
    const pipe = new TrimPipe();
    pipe.trimEnd = true;
    expect(pipe.exec('  hello  ')).toBe('  hello');
  });

  it('should return non-string values unchanged', () => {
    const pipe = new TrimPipe();
    expect(pipe.exec(123)).toBe(123);
    expect(pipe.exec(null)).toBe(null);
    expect(pipe.exec(undefined)).toBe(undefined);
  });

  it('should have type "trim"', () => {
    const pipe = new TrimPipe();
    expect(pipe.type).toBe('trim');
  });
});
