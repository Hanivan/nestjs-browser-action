import { ToUpperCasePipe } from './to-upper-case.pipe';

describe('ToUpperCasePipe', () => {
  it('should convert string to uppercase', () => {
    const pipe = new ToUpperCasePipe();
    expect(pipe.exec('hello world')).toBe('HELLO WORLD');
  });

  it('should handle mixed case correctly', () => {
    const pipe = new ToUpperCasePipe();
    expect(pipe.exec('HeLlO WoRlD')).toBe('HELLO WORLD');
  });

  it('should leave already uppercase strings unchanged', () => {
    const pipe = new ToUpperCasePipe();
    expect(pipe.exec('HELLO WORLD')).toBe('HELLO WORLD');
  });

  it('should return non-string values unchanged', () => {
    const pipe = new ToUpperCasePipe();
    expect(pipe.exec(123 as any)).toBe(123);
    expect(pipe.exec(null as any)).toBe(null);
    expect(pipe.exec(undefined as any)).toBe(undefined);
    expect(pipe.exec(true as any)).toBe(true);
    expect(pipe.exec({} as any)).toEqual({});
  });

  it('should have type "to-upper-case"', () => {
    const pipe = new ToUpperCasePipe();
    expect(pipe.type).toBe('to-upper-case');
  });
});
