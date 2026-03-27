import { Test, TestingModule } from '@nestjs/testing';
import { ActionHelpersService } from './action-helpers.service';
import { PageService } from '../services/page-service';
import { CookieService } from '../services/cookie.service';
import { CleansingService } from '../services/cleansing.service';
import { ScrapeCleansingOptions } from '../interfaces/cleansing-options';
import { CleansingType } from '../enums/cleansing-type.enum';

describe('ActionHelpersService - Integration Tests', () => {
  let service: ActionHelpersService;
  let pageService: PageService;
  let cookieService: CookieService;
  let cleansingService: CleansingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionHelpersService,
        {
          provide: PageService,
          useValue: {
            navigateTo: jest.fn(),
            closePage: jest.fn(),
            getLogLevel: jest.fn().mockReturnValue('debug'),
          },
        },
        {
          provide: CookieService,
          useValue: {},
        },
        {
          provide: CleansingService,
          useValue: {
            cleanse: jest.fn(),
            loadPipes: jest.fn().mockReturnValue([]),
          },
        },
      ],
    }).compile();

    service = await module.resolve<ActionHelpersService>(ActionHelpersService);
    pageService = await module.resolve<PageService>(PageService);
    cookieService = module.get<CookieService>(CookieService);
    cleansingService = module.get<CleansingService>(CleansingService);
  });

  describe('scrape with cleansing', () => {
    it('should apply cleansing pipes to scraped data', async () => {
      const url = 'https://example.com';
      const selectors = {
        price: '.price',
        name: '.name',
      };

      const cleansingOptions: ScrapeCleansingOptions = {
        pipes: {
          price: [
            { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
            { type: CleansingType.TRIM },
            { type: CleansingType.TO_NUMBER },
          ],
        },
      };

      // Mock page navigation and element evaluation
      const mockPage = {
        $eval: jest
          .fn()
          .mockReturnValueOnce('$ 29.99') // price
          .mockReturnValueOnce('  Product Name  '), // name
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      // Mock cleansing service
      const mockPipeInstances = [
        { exec: jest.fn((val: string) => val.replace('$', '')) }, // REMOVE_CURRENCY_SYMBOL
        { exec: jest.fn((val: string) => val.trim()) }, // TRIM
        { exec: jest.fn((val: string) => parseFloat(val)) }, // TO_NUMBER
      ];

      (cleansingService.loadPipes as jest.Mock).mockReturnValue(
        mockPipeInstances,
      );
      (cleansingService.cleanse as jest.Mock).mockImplementation(
        (value, pipes) => {
          // Simulate the cleanse method reducing through pipes
          return pipes.reduce(
            (result: any, pipe: any) => pipe.exec(result),
            value,
          );
        },
      );

      const result = await service.scrape(url, selectors, cleansingOptions);

      expect(result).toEqual({
        price: 29.99,
        name: '  Product Name  ',
      });

      // Verify loadPipes was called with the config
      expect(cleansingService.loadPipes).toHaveBeenCalledWith([
        { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
        { type: CleansingType.TRIM },
        { type: CleansingType.TO_NUMBER },
      ]);

      // Verify cleanse was called with value and pipe instances
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '$ 29.99',
        mockPipeInstances,
      );

      // Verify it was only called once (for price only)
      expect(cleansingService.cleanse).toHaveBeenCalledTimes(1);
    });

    it('should handle missing elements gracefully with cleansing', async () => {
      const url = 'https://example.com';
      const selectors = {
        existing: '.exists',
        missing: '.missing',
      };

      const cleansingOptions: ScrapeCleansingOptions = {
        pipes: {
          existing: [{ type: CleansingType.TRIM }],
        },
      };

      // Mock page navigation and element evaluation
      const mockPage = {
        $eval: jest
          .fn()
          .mockReturnValueOnce('  exists  ') // existing
          .mockImplementationOnce(() => {
            throw new Error('Element not found');
          }), // missing
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      // Mock cleansing service
      const mockTrimPipe = { exec: jest.fn((val: string) => val.trim()) };
      (cleansingService.loadPipes as jest.Mock).mockReturnValue([mockTrimPipe]);
      (cleansingService.cleanse as jest.Mock).mockImplementation(
        (value, pipes) => {
          return pipes.reduce(
            (result: any, pipe: any) => pipe.exec(result),
            value,
          );
        },
      );

      const result = await service.scrape(url, selectors, cleansingOptions);

      expect(result).toEqual({
        existing: 'exists',
        missing: undefined,
      });
    });

    it('should handle multiple pipes per field', async () => {
      const url = 'https://example.com';
      const selectors = {
        text: '.text',
      };

      const cleansingOptions: ScrapeCleansingOptions = {
        pipes: {
          text: [
            { type: CleansingType.TRIM },
            { type: CleansingType.NORMALIZE_WHITESPACE },
            { type: CleansingType.TO_LOWER_CASE },
          ],
        },
      };

      // Mock page navigation and element evaluation
      const mockPage = {
        $eval: jest.fn().mockReturnValueOnce('  Hello   WORLD  '),
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      // Mock cleansing service to handle all pipes at once
      const mockPipes = [
        { exec: jest.fn((val: string) => val.trim()) },
        { exec: jest.fn((val: string) => val.replace(/\s+/g, ' ')) },
        { exec: jest.fn((val: string) => val.toLowerCase()) },
      ];
      (cleansingService.loadPipes as jest.Mock).mockReturnValue(mockPipes);
      (cleansingService.cleanse as jest.Mock).mockImplementation(
        (value, pipes) => {
          return pipes.reduce(
            (result: any, pipe: any) => pipe.exec(result),
            value,
          );
        },
      );

      const result = await service.scrape(url, selectors, cleansingOptions);

      expect(result).toEqual({
        text: 'hello world',
      });

      // Verify loadPipes was called with all pipe configs
      expect(cleansingService.loadPipes).toHaveBeenCalledWith([
        { type: CleansingType.TRIM },
        { type: CleansingType.NORMALIZE_WHITESPACE },
        { type: CleansingType.TO_LOWER_CASE },
      ]);
    });

    it('should work without cleansing options', async () => {
      const url = 'https://example.com';
      const selectors = {
        text: '.text',
      };

      // Mock page navigation and element evaluation
      const mockPage = {
        $eval: jest.fn().mockReturnValueOnce('raw text'),
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      const result = await service.scrape(url, selectors);

      expect(result).toEqual({
        text: 'raw text',
      });

      // Verify cleansing was not called when no options provided
      expect(cleansingService.cleanse).not.toHaveBeenCalled();
    });
  });
});
