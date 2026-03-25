import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

describe('CleansingPipe', () => {
  it('should require type property', () => {
    class TestPipe extends CleansingPipe<string, string> {
      type = CleansingType.TRIM;
      exec(value: string): string {
        return value;
      }
    }

    const pipe = new TestPipe();
    expect(pipe.type).toBe(CleansingType.TRIM);
  });

  it('should require exec method', () => {
    class TestPipe extends CleansingPipe<string, string> {
      type = CleansingType.TRIM;
      exec(value: string): string {
        return value.trim();
      }
    }

    const pipe = new TestPipe();
    expect(pipe.exec('  hello  ')).toBe('hello');
  });

  it('should have optional reverse method', () => {
    class TestPipe extends CleansingPipe<string, string> {
      type = CleansingType.TRIM;
      exec(value: string): string {
        return value.trim();
      }
      reverse(): string {
        return '  hello  ';
      }
    }

    const pipe = new TestPipe();
    expect(pipe.reverse()).toBe('  hello  ');
  });

  it('should throw error if reverse not implemented', () => {
    class TestPipe extends CleansingPipe<string, string> {
      type = CleansingType.TRIM;
      exec(value: string): string {
        return value;
      }
    }

    const pipe = new TestPipe();
    expect(() => pipe.reverse?.()).toThrow(
      'Reverse transformation not implemented',
    );
  });
});
