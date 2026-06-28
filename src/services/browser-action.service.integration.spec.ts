import { Test, TestingModule } from '@nestjs/testing';
import { BrowserActionService } from './browser-action.service';
import { PageService } from './page.service';
import { CookieService } from './cookie.service';
import { CleansingService } from './cleansing.service';
import { ScrapeCleansingOptions } from '../interfaces/cleansing-options';
import { CleansingType } from '../enums/cleansing-type.enum';

describe('BrowserActionService - Integration Tests', () => {
  let service: BrowserActionService;
  let pageService: PageService;
  let cookieService: CookieService;
  let cleansingService: CleansingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserActionService,
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
            buildPipes: jest.fn().mockReturnValue([]),
          },
        },
      ],
    }).compile();

    service = await module.resolve<BrowserActionService>(BrowserActionService);
    pageService = await module.resolve<PageService>(PageService);
    cookieService = module.get<CookieService>(CookieService);
    cleansingService = module.get<CleansingService>(CleansingService);
  });

  describe('scrape with cleansing', () => {
    // scrape() now uses PipeEngine.apply() directly — CleansingService.buildPipes/cleanse
    // are not called for scrape(). Tests use real CleanerStepRules objects.

    it('should apply CleanerStepRules pipes to scraped data', async () => {
      const url = 'https://example.com';
      const selectors = { price: '.price', name: '.name' };

      const cleansingOptions: ScrapeCleansingOptions = {
        pipes: {
          price: {
            trim: true,
            custom: [
              { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$'] },
            ],
          },
        },
      };

      const mockPage = {
        $eval: jest
          .fn()
          .mockReturnValueOnce('$ 29.99')
          .mockReturnValueOnce('  Product Name  '),
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      const result = await service.scrape(url, selectors, cleansingOptions);

      expect(result.price).toBe('29.99');
      expect(result.name).toBe('  Product Name  '); // no pipe → unchanged
    });

    it('should handle missing elements gracefully with cleansing', async () => {
      const url = 'https://example.com';
      const selectors = { existing: '.exists', missing: '.missing' };

      const cleansingOptions: ScrapeCleansingOptions = {
        pipes: { existing: { trim: true } },
      };

      const mockPage = {
        $eval: jest
          .fn()
          .mockReturnValueOnce('  exists  ')
          .mockImplementationOnce(() => {
            throw new Error('Element not found');
          }),
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      const result = await service.scrape(url, selectors, cleansingOptions);

      expect(result.existing).toBe('exists');
      expect(result.missing).toBeUndefined();
    });

    it('should handle multiple CleanerStepRules per field', async () => {
      const url = 'https://example.com';
      const selectors = { text: '.text' };

      const cleansingOptions: ScrapeCleansingOptions = {
        pipes: {
          text: { trim: true, toLowerCase: true },
        },
      };

      const mockPage = {
        $eval: jest.fn().mockReturnValueOnce('  Hello   WORLD  '),
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      const result = await service.scrape(url, selectors, cleansingOptions);

      expect(result.text).toBe('hello world');
    });

    it('should work without cleansing options', async () => {
      const url = 'https://example.com';
      const selectors = { text: '.text' };

      const mockPage = {
        $eval: jest.fn().mockReturnValueOnce('raw text'),
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      const result = await service.scrape(url, selectors);

      expect(result).toEqual({ text: 'raw text' });
    });
  });
});
