import { ToLowerCasePipe } from './to-lower-case.pipe';

describe('ToLowerCasePipe', () => {
  it('should convert string to lowercase', () => {
    const pipe = new ToLowerCasePipe();
    expect(pipe.exec('HELLO WORLD')).toBe('hello world');
  });

  it('should handle mixed case correctly', () => {
    const pipe = new ToLowerCasePipe();
    expect(pipe.exec('HeLlO WoRlD')).toBe('hello world');
  });

  it('should leave already lowercase strings unchanged', () => {
    const pipe = new ToLowerCasePipe();
    expect(pipe.exec('hello world')).toBe('hello world');
  });

  it('should return non-string values unchanged', () => {
    const pipe = new ToLowerCasePipe();
    expect(pipe.exec(123 as any)).toBe(123);
    expect(pipe.exec(null as any)).toBe(null);
    expect(pipe.exec(undefined as any)).toBe(undefined);
    expect(pipe.exec(true as any)).toBe(true);
    expect(pipe.exec({} as any)).toEqual({});
  });

  it('should have type "to-lower-case"', () => {
    const pipe = new ToLowerCasePipe();
    expect(pipe.type).toBe('to-lower-case');
  });
});
