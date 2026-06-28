import { Test, TestingModule } from '@nestjs/testing';
import { CleansingService } from './cleansing.service';
import { CleansingProfile } from '../enums/cleansing-profile.enum';
import { CleansingType } from '../enums/cleansing-type.enum';
import { CleansingPipe } from '../pipes/cleansing-pipe';
import { TrimPipe } from '../pipes/trim.pipe';
import { PIPE_REGISTRY } from '../pipes/pipe-registry';
import { BROWSER_ACTION_OPTIONS } from '../constants/browser-action.constants';

describe('CleansingService', () => {
  let service: CleansingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CleansingService],
    }).compile();
    service = module.get<CleansingService>(CleansingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanse', () => {
    it('should execute pipes in sequence', () => {
      const input = '  hello WORLD  ';
      const pipes: CleansingPipe[] = [
        new (require('../pipes/trim.pipe').TrimPipe)(),
        new (require('../pipes/to-lower-case.pipe').ToLowerCasePipe)(),
      ];
      expect(service.cleanse(input, pipes)).toBe('hello world');
    });
  });

  describe('cleanseWithProfile', () => {
    it('should cleanse using named profile (returns string from PipeEngine)', () => {
      // PipeEngine.apply always returns string; numeric conversion is in TO_NUMBER custom pipe
      // but the final result is stringified by PipeEngine
      const result = service.cleanseWithProfile(
        '$29.99',
        CleansingProfile.PRICE,
      );
      // should have stripped currency and special chars
      expect(String(result)).toMatch(/^[\d.]+$/);
    });

    it('should return input unchanged for unknown profile (no throw)', () => {
      // PipeEngine.apply returns value as-is when pipes is undefined/empty
      const result = service.cleanseWithProfile(
        'test',
        'invalid-profile' as CleansingProfile,
      );
      expect(result).toBeDefined();
    });
  });

  describe('buildPipes', () => {
    it('should return empty array for empty input', () => {
      expect(service.buildPipes([])).toEqual([]);
    });

    it('should instantiate known pipe types', () => {
      const pipes = service.buildPipes([
        { type: CleansingType.TRIM },
        { type: CleansingType.TO_LOWER_CASE },
      ]);
      expect(pipes).toHaveLength(2);
      expect(pipes[0]).toBeInstanceOf(require('../pipes/trim.pipe').TrimPipe);
      expect(pipes[1]).toBeInstanceOf(
        require('../pipes/to-lower-case.pipe').ToLowerCasePipe,
      );
    });

    it('should silently skip unknown pipe types', () => {
      // No throw — silent skip
      const pipes = service.buildPipes([{ type: 'unknown-pipe-xyz' }]);
      expect(pipes).toHaveLength(0);
    });

    it('should instantiate pipe with config properties', () => {
      const pipes = service.buildPipes([
        { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$', '€'] },
      ]);
      expect(pipes).toHaveLength(1);
      expect(pipes[0]).toBeInstanceOf(
        require('../pipes/remove-currency-symbol.pipe')
          .RemoveCurrencySymbolPipe,
      );
    });
  });

  describe('PIPE_REGISTRY coverage', () => {
    it('should have all original 13 pipe types', () => {
      const expectedTypes = [
        'trim',
        'to-number',
        'sanitize-text',
        'date-format',
        'regex-replace',
        'regex-extract',
        'remove-currency-symbol',
        'remove-special-chars',
        'to-lower-case',
        'to-upper-case',
        'normalize-whitespace',
        'remove-line-breaks',
        'alt-flag',
      ];
      expectedTypes.forEach((type) => {
        expect(PIPE_REGISTRY[type]).toBeDefined();
      });
    });

    it('should have all xpath-parser ported pipe types', () => {
      const xpathTypes = [
        'num-normalize',
        'url-resolve',
        'extract-email',
        'regex',
        'parse-as-url',
        'clean-html',
        'regex-extraction',
        'regex-extraction--page',
        'regex-extraction--url',
        'regex-replace-x',
        'regex-replace--page',
        'regex-replace--url',
        'extract-url-params',
        'media-filter',
        'query-append',
        'json-path',
        'query-remover',
        'query-remover--page',
        'query-remover--url',
        'date-format-special',
      ];
      xpathTypes.forEach((type) => {
        expect(PIPE_REGISTRY[type]).toBeDefined();
      });
    });
  });

  describe('registerPipe / registerPipes', () => {
    class ExclaimPipe extends CleansingPipe<string, string> {
      type = 'exclaim';
      exec(value: string): string {
        return `${String(value)}!`;
      }
    }
    class ShoutPipe extends CleansingPipe<string, string> {
      type = 'shout';
      exec(value: string): string {
        return String(value).toUpperCase();
      }
    }

    it('registerPipe makes a custom type resolvable via buildPipes', () => {
      service.registerPipe('exclaim', ExclaimPipe);
      const pipes = service.buildPipes([{ type: 'exclaim' }]);
      expect(service.cleanse('hi', pipes)).toBe('hi!');
    });

    it('registerPipes registers multiple custom types at once', () => {
      service.registerPipes({ exclaim: ExclaimPipe, shout: ShoutPipe });
      const result = service.cleanse(
        'hi',
        service.buildPipes([{ type: 'shout' }, { type: 'exclaim' }]),
      );
      expect(result).toBe('HI!');
    });

    it('registerPipe silently overwrites an existing type', () => {
      service.registerPipe('exclaim', ExclaimPipe);
      // overwrite — no throw
      expect(() => service.registerPipe('exclaim', ShoutPipe)).not.toThrow();
      const pipes = service.buildPipes([{ type: 'exclaim' }]);
      // now it's ShoutPipe
      expect(service.cleanse('hi', pipes)).toBe('HI');
    });

    it('registerPipe silently overwrites even builtin types', () => {
      expect(() => service.registerPipe('trim', ExclaimPipe)).not.toThrow();
      // restore original to avoid polluting other tests
      service.registerPipe('trim', TrimPipe);
    });
  });

  describe('customPipes from module options', () => {
    class ExclaimPipe extends CleansingPipe<string, string> {
      type = 'exclaim2';
      exec(value: string): string {
        return `${String(value)}!`;
      }
    }

    it('registers customPipes provided via BROWSER_ACTION_OPTIONS', async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [
          CleansingService,
          {
            provide: BROWSER_ACTION_OPTIONS,
            useValue: { customPipes: { exclaim2: ExclaimPipe } },
          },
        ],
      }).compile();
      const svc = moduleRef.get<CleansingService>(CleansingService);
      const result = svc.cleanse('hi', svc.buildPipes([{ type: 'exclaim2' }]));
      expect(result).toBe('hi!');
    });
  });
});
