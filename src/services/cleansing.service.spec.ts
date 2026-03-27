import { Test, TestingModule } from '@nestjs/testing';
import { CleansingService } from './cleansing.service';
import { CleansingProfile } from '../enums/cleansing-profile.enum';
import { CleansingType } from '../enums/cleansing-type.enum';
import { CleansingPipe } from '../pipes/cleansing-pipe';

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

  describe('loadPipes', () => {
    it('should return empty array when no pipes provided', () => {
      const result = service.loadPipes([]);
      expect(result).toEqual([]);
    });

    it('should load and validate pipe instances correctly', () => {
      const pipes = [
        { type: CleansingType.TRIM },
        { type: CleansingType.TO_LOWER_CASE },
      ];
      const result = service.loadPipes(pipes);
      expect(result).toHaveLength(2);

      expect(result[0]).toBeInstanceOf(require('../pipes/trim.pipe').TrimPipe);

      expect(result[1]).toBeInstanceOf(
        require('../pipes/to-lower-case.pipe').ToLowerCasePipe,
      );
    });

    it('should throw error for unknown pipe type', () => {
      const pipes = [{ type: 'unknown-pipe' }];
      expect(() => service.loadPipes(pipes)).toThrow(
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
      const result = service.loadPipes(pipes);
      expect(result).toHaveLength(1);

      expect(result[0]).toBeInstanceOf(
        require('../pipes/remove-currency-symbol.pipe')
          .RemoveCurrencySymbolPipe,
      );
    });

    it('should handle pipe validation properly', () => {
      // Test that valid pipe configs pass validation
      const pipes = [{ type: 'trim' }];
      const result = service.loadPipes(pipes);
      expect(result).toHaveLength(1);
    });
  });

  describe('PIPE_TYPE_MAP', () => {
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
      const mappedTypes = Object.keys(service['PIPE_TYPE_MAP']);

      expect(mappedTypes).toHaveLength(13);
      expectedTypes.forEach((type) => {
        expect(service['PIPE_TYPE_MAP'][type]).toBeDefined();
      });
    });
  });
});
