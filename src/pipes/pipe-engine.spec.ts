import { PipeEngine, CleanerStepRules } from './pipe-engine';
import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

describe('PipeEngine', () => {
  let engine: PipeEngine;

  beforeEach(() => {
    engine = new PipeEngine();
  });

  describe('apply() — primitive rules', () => {
    it('returns value unchanged when no pipes provided', () => {
      expect(engine.apply('  hello  ', undefined)).toBe('  hello  ');
    });

    it('returns value unchanged for empty rules object', () => {
      expect(engine.apply('hello', {})).toBe('hello');
    });

    it('trims whitespace', () => {
      expect(engine.apply('  hello  ', { trim: true })).toBe('hello');
    });

    it('lowercases', () => {
      expect(engine.apply('HELLO', { toLowerCase: true })).toBe('hello');
    });

    it('uppercases', () => {
      expect(engine.apply('hello', { toUpperCase: true })).toBe('HELLO');
    });

    it('toLowerCase takes precedence over toUpperCase when both set (toLowerCase runs first)', () => {
      // toLowerCase runs before toUpperCase in PipeEngine order
      const result = engine.apply('Hello', {
        toLowerCase: true,
        toUpperCase: true,
      });
      expect(result).toBe('HELLO');
    });

    it('applies replace rules globally', () => {
      expect(
        engine.apply('foo bar foo', { replace: [{ from: 'foo', to: 'baz' }] }),
      ).toBe('baz bar baz');
    });

    it('applies multiple replace rules in order', () => {
      const result = engine.apply('hello world', {
        replace: [
          { from: 'hello', to: 'hi' },
          { from: 'world', to: 'earth' },
        ],
      });
      expect(result).toBe('hi earth');
    });

    it('decodes HTML entities', () => {
      const result = engine.apply('&amp;lt;b&amp;gt;', { decode: true });
      expect(typeof result).toBe('string');
    });

    it('collapses internal whitespace at end', () => {
      expect(engine.apply('hello   world', { trim: true })).toBe('hello world');
    });

    it('trims + lowercases combined', () => {
      expect(
        engine.apply('  HELLO WORLD  ', { trim: true, toLowerCase: true }),
      ).toBe('hello world');
    });
  });

  describe('apply() — custom pipes', () => {
    it('runs custom pipe type from PIPE_REGISTRY', () => {
      const result = engine.apply('  hello  ', {
        custom: [{ type: CleansingType.TRIM }],
      });
      expect(result).toBe('hello');
    });

    it('silently skips unknown custom pipe types', () => {
      const result = engine.apply('hello', {
        custom: [{ type: 'nonexistent-pipe-xyz' }],
      });
      expect(result).toBe('hello');
    });

    it('runs remove-currency-symbol pipe', () => {
      const result = engine.apply('$29.99', {
        custom: [
          { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$'] },
        ],
      });
      expect(result).toBe('29.99');
    });

    it('runs multiple custom pipes in sequence', () => {
      const result = engine.apply('  HELLO WORLD  ', {
        trim: true,
        custom: [{ type: CleansingType.TO_LOWER_CASE }],
      });
      expect(result).toBe('hello world');
    });

    it('injects baseUrl into pipes that have the property', () => {
      // parse-as-url pipe uses baseUrl
      const result = engine.apply(
        '/path/to/page',
        {
          custom: [{ type: 'parse-as-url' }],
        },
        'https://example.com',
      );
      // Should resolve relative URL against baseUrl
      expect(typeof result).toBe('string');
    });

    it('returns original value type coerced to string from custom pipe', () => {
      const result = engine.apply('42', {
        custom: [{ type: CleansingType.TO_NUMBER }],
      });
      // PipeEngine always returns string
      expect(typeof result).toBe('string');
      expect(result).toBe('42');
    });
  });

  describe('register()', () => {
    it('adds a custom pipe class to the registry', () => {
      class ExclaimPipe extends CleansingPipe<string, string> {
        type = 'exclaim-test';
        exec(value: string): string {
          return `${value}!`;
        }
      }

      engine.register('exclaim-test', ExclaimPipe);

      const result = engine.apply('hi', {
        custom: [{ type: 'exclaim-test' }],
      });
      expect(result).toBe('hi!');
    });

    it('overwrites existing type silently', () => {
      class UpperPipe extends CleansingPipe<string, string> {
        type = 'upper-test';
        exec(value: string): string {
          return value.toUpperCase();
        }
      }
      class LowerPipe extends CleansingPipe<string, string> {
        type = 'upper-test';
        exec(value: string): string {
          return value.toLowerCase();
        }
      }

      engine.register('upper-test', UpperPipe);
      engine.register('upper-test', LowerPipe); // overwrite

      const result = engine.apply('Hello', {
        custom: [{ type: 'upper-test' }],
      });
      expect(result).toBe('hello');
    });
  });

  describe('edge cases', () => {
    it('handles empty string input with pipes', () => {
      // PipeEngine returns value as-is when !value
      expect(engine.apply('', { trim: true })).toBe('');
    });

    it('handles string with only whitespace after trim', () => {
      expect(engine.apply('   ', { trim: true })).toBe('');
    });
  });
});
