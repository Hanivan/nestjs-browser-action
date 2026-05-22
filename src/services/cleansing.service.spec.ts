import { Test, TestingModule } from '@nestjs/testing';
import { CleansingService } from './cleansing.service';
import { CleansingProfile } from '../enums/cleansing-profile.enum';
import { CleansingType } from '../enums/cleansing-type.enum';
import { CleansingPipe } from '../pipes/cleansing-pipe';
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
      const result = service.cleanse(input, pipes);
      expect(result).toBe('hello world');
    });
  });

  describe('cleanseWithProfile', () => {
    it('should cleanse using named profile', () => {
      const input = '$29.99';
      const result = service.cleanseWithProfile(input, CleansingProfile.PRICE);
      expect(typeof result).toBe('number');
    });

    it('should throw error for invalid profile name', () => {
      const input = 'test';
      expect(() => {
        service.cleanseWithProfile(
          input,
          'invalid-profile' as CleansingProfile,
        );
      }).toThrow();
    });
  });

  describe('buildPipes', () => {
    it('should return empty array when no pipes provided', () => {
      const result = service.buildPipes([]);
      expect(result).toEqual([]);
    });

    it('should load and validate pipe instances correctly', () => {
      const pipes = [
        { type: CleansingType.TRIM },
        { type: CleansingType.TO_LOWER_CASE },
      ];
      const result = service.buildPipes(pipes);
      expect(result).toHaveLength(2);

      expect(result[0]).toBeInstanceOf(require('../pipes/trim.pipe').TrimPipe);

      expect(result[1]).toBeInstanceOf(
        require('../pipes/to-lower-case.pipe').ToLowerCasePipe,
      );
    });

    it('should throw error for unknown pipe type', () => {
      const pipes = [{ type: 'unknown-pipe' }];
      expect(() => service.buildPipes(pipes)).toThrow(
        'Unknown pipe type: unknown-pipe',
      );
    });

    it('should load pipes with parameters correctly', () => {
      const pipes = [
        {
          type: CleansingType.REMOVE_CURRENCY_SYMBOL,
          params: { symbols: ['$', '€'] },
        },
      ];
      const result = service.buildPipes(pipes);
      expect(result).toHaveLength(1);

      expect(result[0]).toBeInstanceOf(
        require('../pipes/remove-currency-symbol.pipe')
          .RemoveCurrencySymbolPipe,
      );
    });

    it('should handle pipe validation properly', () => {
      // Test that valid pipe configs pass validation
      const pipes = [{ type: 'trim' }];
      const result = service.buildPipes(pipes);
      expect(result).toHaveLength(1);
    });
  });

  describe('pipeRegistry', () => {
    it('should have all 13 pipe types mapped', () => {
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
      const mappedTypes = Object.keys(service['pipeRegistry']);

      expect(mappedTypes).toHaveLength(13);
      expectedTypes.forEach((type) => {
        expect(service['pipeRegistry'][type]).toBeDefined();
      });
    });
  });

  describe('custom pipe registration', () => {
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

    it('registerPipes registers multiple custom types', () => {
      service.registerPipes({ exclaim: ExclaimPipe, shout: ShoutPipe });
      const result = service.cleanse(
        'hi',
        service.buildPipes([{ type: 'shout' }, { type: 'exclaim' }]),
      );
      expect(result).toBe('HI!');
    });

    it('registerPipe throws when type collides with a builtin', () => {
      expect(() => service.registerPipe('trim', ExclaimPipe)).toThrow(
        /already registered/i,
      );
    });

    it('registerPipe throws when type already registered', () => {
      service.registerPipe('exclaim', ExclaimPipe);
      expect(() => service.registerPipe('exclaim', ShoutPipe)).toThrow(
        /already registered/i,
      );
    });
  });

  describe('customPipes from module options', () => {
    class ExclaimPipe extends CleansingPipe<string, string> {
      type = 'exclaim';
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
            useValue: { customPipes: { exclaim: ExclaimPipe } },
          },
        ],
      }).compile();
      const svc = moduleRef.get<CleansingService>(CleansingService);
      const result = svc.cleanse('hi', svc.buildPipes([{ type: 'exclaim' }]));
      expect(result).toBe('hi!');
    });
  });
});
