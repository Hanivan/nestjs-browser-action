import { Test, TestingModule } from '@nestjs/testing';
import type { Page } from 'puppeteer-core';
import { BrowserActionService } from './browser-action.service';
import { PageService } from './page.service';
import { CookieService } from './cookie.service';
import { CleansingService } from './cleansing.service';
import type {
  EvaluateOptions,
  PatternField,
  PaginationOptions,
} from '../interfaces/types';

describe('BrowserActionService.evaluateWebsite', () => {
  let service: BrowserActionService;
  let pageService: jest.Mocked<PageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserActionService,
        {
          provide: PageService,
          useValue: {
            navigateTo: jest.fn(),
            closePage: jest.fn().mockResolvedValue(undefined),
            getLogLevel: jest.fn().mockReturnValue('debug'),
          },
        },
        { provide: CookieService, useValue: {} },
        { provide: CleansingService, useValue: {} },
      ],
    }).compile();

    service = await module.resolve<BrowserActionService>(BrowserActionService);
    pageService = module.get(PageService);
  });

  describe('flat patterns (non-container)', () => {
    it('returns { results: [item] } wrapping a single scraped object', async () => {
      const mockPage = {
        $eval: jest
          .fn()
          .mockResolvedValueOnce('Product Title')
          .mockResolvedValueOnce('29.99'),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);

      const options: EvaluateOptions = {
        url: 'https://example.com',
        patterns: [
          {
            key: 'title',
            patternType: 'css',
            returnType: 'text',
            patterns: ['.title'],
          },
          {
            key: 'price',
            patternType: 'css',
            returnType: 'text',
            patterns: ['.price'],
          },
        ],
      };

      const result = await service.evaluateWebsite(options);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        title: 'Product Title',
        price: '29.99',
      });
    });

    it('applies per-field pipes from PatternField.pipes', async () => {
      const mockPage = {
        $eval: jest
          .fn()
          .mockResolvedValueOnce('  HELLO  ')
          .mockResolvedValueOnce('  $29.99  '),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);

      const options: EvaluateOptions = {
        url: 'https://example.com',
        patterns: [
          {
            key: 'title',
            patternType: 'css',
            returnType: 'text',
            patterns: ['.title'],
            pipes: { trim: true, toLowerCase: true },
          },
          {
            key: 'price',
            patternType: 'css',
            returnType: 'text',
            patterns: ['.price'],
            pipes: { trim: true },
          },
        ],
      };

      const result = await service.evaluateWebsite(options);

      expect(result.results[0]).toMatchObject({
        title: 'hello',
        price: '$29.99',
      });
    });

    it('works with xpath patternType', async () => {
      const mockPage = {
        $eval: jest.fn().mockResolvedValueOnce('XPath Value'),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);

      const options: EvaluateOptions = {
        url: 'https://example.com',
        patterns: [
          {
            key: 'name',
            patternType: 'xpath',
            returnType: 'text',
            patterns: ['//h1/text()'],
          },
        ],
      };

      const result = await service.evaluateWebsite(options);
      expect(result.results).toHaveLength(1);
    });

    it('throws when url is missing', async () => {
      const options: EvaluateOptions = {
        patterns: [
          {
            key: 'title',
            patternType: 'css',
            returnType: 'text',
            patterns: ['.title'],
          },
        ],
      };

      await expect(service.evaluateWebsite(options)).rejects.toThrow(
        'evaluateWebsite requires a url',
      );
    });
  });

  describe('container patterns', () => {
    it('returns { results: items[] } from scrapeContainerFields', async () => {
      const mockItems = [
        { name: 'Item A', price: '10.00' },
        { name: 'Item B', price: '20.00' },
      ];
      jest
        .spyOn(service, 'scrapeContainerFields')
        .mockResolvedValue({ items: mockItems });

      const patterns: PatternField[] = [
        {
          key: 'container',
          patternType: 'css',
          returnType: 'text',
          patterns: ['.product'],
          meta: { isContainer: true },
        },
        {
          key: 'name',
          patternType: 'css',
          returnType: 'text',
          patterns: ['.name'],
        },
        {
          key: 'price',
          patternType: 'css',
          returnType: 'text',
          patterns: ['.price'],
        },
      ];

      const result = await service.evaluateWebsite({
        url: 'https://example.com',
        patterns,
      });

      expect(result.results).toEqual(mockItems);
      expect(result.results).toHaveLength(2);
    });

    it('maps patterns[1..n] and alterPattern to FieldDescriptor.fallback', async () => {
      const spy = jest
        .spyOn(service, 'scrapeContainerFields')
        .mockResolvedValue({ items: [] });

      const patterns: PatternField[] = [
        {
          key: 'container',
          patternType: 'css',
          returnType: 'text',
          patterns: ['.list-item'],
          meta: { isContainer: true },
        },
        {
          key: 'title',
          patternType: 'css',
          returnType: 'text',
          patterns: ['h2', 'h3'],
          meta: { alterPattern: ['.title-fallback'] },
        },
      ];

      await service.evaluateWebsite({ url: 'https://example.com', patterns });

      const descriptor = spy.mock.calls[0][1];
      expect(descriptor.fields['title'].selector).toBe('h2');
      expect(descriptor.fields['title'].fallback).toEqual([
        'h3',
        '.title-fallback',
      ]);
    });

    it('normalizes returnType rawHTML to html in FieldDescriptor', async () => {
      const spy = jest
        .spyOn(service, 'scrapeContainerFields')
        .mockResolvedValue({ items: [] });

      const patterns: PatternField[] = [
        {
          key: 'container',
          patternType: 'css',
          returnType: 'text',
          patterns: ['.item'],
          meta: { isContainer: true },
        },
        {
          key: 'body',
          patternType: 'css',
          returnType: 'rawHTML',
          patterns: ['.body'],
        },
      ];

      await service.evaluateWebsite({ url: 'https://example.com', patterns });

      const descriptor = spy.mock.calls[0][1];
      expect(descriptor.fields['body'].returnType).toBe('html');
    });

    it('passes per-field pipes to scrapeContainerFields via ScraperOptions', async () => {
      const spy = jest
        .spyOn(service, 'scrapeContainerFields')
        .mockResolvedValue({ items: [] });

      const patterns: PatternField[] = [
        {
          key: 'container',
          patternType: 'css',
          returnType: 'text',
          patterns: ['.item'],
          meta: { isContainer: true },
        },
        {
          key: 'price',
          patternType: 'css',
          returnType: 'text',
          patterns: ['.price'],
          pipes: { trim: true },
        },
      ];

      await service.evaluateWebsite({ url: 'https://example.com', patterns });

      const scraperOptions = spy.mock.calls[0][2];
      expect(scraperOptions?.pipes?.['price']).toEqual({ trim: true });
    });
  });

  describe('pagination', () => {
    type ServiceWithPrivate = {
      executeContainerExtraction: (...args: unknown[]) => Promise<unknown>;
    };

    it('throws when pagination is set without a container pattern', async () => {
      pageService.navigateTo.mockResolvedValue({
        $eval: jest.fn().mockResolvedValue('val'),
      } as unknown as Page);

      await expect(
        service.evaluateWebsite({
          url: 'https://example.com',
          patterns: [
            {
              key: 'title',
              patternType: 'css',
              returnType: 'text',
              patterns: ['.title'],
            },
          ],
          pagination: {
            type: 'click-next',
            selector: '.next',
          } as PaginationOptions,
        }),
      ).rejects.toThrow(
        'pagination requires a container pattern (meta.isContainer: true)',
      );
    });

    it('click-next: stops when next button is not found, merges results', async () => {
      const mockItems = [{ id: '1' }, { id: '2' }];
      // executeContainerExtraction is called via containerFn
      // We mock the page to have container items and no next button
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue(
          // executeContainerExtraction calls page.evaluate with a fn
          mockItems,
        ),
        $x: jest.fn().mockResolvedValue([]), // no next button
        $: jest.fn().mockResolvedValue(null),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);
      pageService.closePage.mockResolvedValue(undefined);

      // We need to mock executeContainerExtraction indirectly via page.evaluate
      // Since executeContainerExtraction calls page.evaluate(...) to extract items,
      // spy on the private method instead
      const extractSpy = jest
        .spyOn(
          service as unknown as ServiceWithPrivate,
          'executeContainerExtraction',
        )
        .mockResolvedValue({ items: mockItems, pagination: undefined });

      const result = await service.evaluateWebsite({
        url: 'https://example.com',
        patterns: [
          {
            key: 'CONTAINER',
            patternType: 'xpath',
            returnType: 'text',
            patterns: ['//ul/li'],
            meta: { isContainer: true },
          },
          {
            key: 'id',
            patternType: 'xpath',
            returnType: 'text',
            patterns: ['.//span/@id'],
          },
        ],
        pagination: {
          type: 'click-next',
          selector: '.next-page',
          maxPages: 5,
          waitAfter: 0,
        } as PaginationOptions,
      });

      expect(result.results).toEqual(mockItems);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
      extractSpy.mockRestore();
    });

    it('click-next: clicks button and accumulates across pages', async () => {
      const page1Items = [{ id: '1' }];
      const page2Items = [{ id: '1' }, { id: '2' }];
      const mockBtn = { click: jest.fn().mockResolvedValue(undefined) };
      let callCount = 0;

      const mockPage = {
        $: jest.fn().mockResolvedValue(mockBtn),
        $x: jest.fn().mockResolvedValue([]),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);
      pageService.closePage.mockResolvedValue(undefined);

      const extractSpy = jest
        .spyOn(
          service as unknown as ServiceWithPrivate,
          'executeContainerExtraction',
        )
        .mockImplementation(async () => {
          callCount++;
          // First call: page 1 items; second call: page 2 items; third call: no button -> ends
          const items = callCount === 1 ? page1Items : page2Items;
          return { items, pagination: undefined };
        });

      // After 2nd iteration, no button
      (mockPage.$ as jest.Mock)
        .mockResolvedValueOnce(mockBtn) // click 1
        .mockResolvedValueOnce(null); // no next -> stop

      const result = await service.evaluateWebsite({
        url: 'https://example.com',
        patterns: [
          {
            key: 'CONTAINER',
            patternType: 'css',
            returnType: 'text',
            patterns: ['ul li'],
            meta: { isContainer: true },
          },
          {
            key: 'id',
            patternType: 'css',
            returnType: 'text',
            patterns: ['span'],
          },
        ],
        pagination: {
          type: 'click-next',
          selector: '.next-page',
          maxPages: 10,
          waitAfter: 0,
        } as PaginationOptions,
      });

      expect(result.results.length).toBeGreaterThan(0);
      expect(mockBtn.click).toHaveBeenCalled();
      extractSpy.mockRestore();
    });

    it('load-more: stops when button disappears, returns accumulated items', async () => {
      const items = [{ id: '1' }, { id: '2' }];
      const mockBtn = { click: jest.fn().mockResolvedValue(undefined) };
      let callCount = 0;

      const mockPage = {
        $: jest
          .fn()
          .mockResolvedValueOnce(mockBtn) // first check: button found → click
          .mockResolvedValueOnce(null), // second check: button gone → stop
        $x: jest.fn().mockResolvedValue([]),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);
      pageService.closePage.mockResolvedValue(undefined);

      const extractSpy = jest
        .spyOn(
          service as unknown as ServiceWithPrivate,
          'executeContainerExtraction',
        )
        .mockImplementation(async () => {
          callCount++;
          return {
            items: callCount === 1 ? [{ id: '1' }] : items,
            pagination: undefined,
          };
        });

      const result = await service.evaluateWebsite({
        url: 'https://example.com',
        patterns: [
          {
            key: 'CONTAINER',
            patternType: 'css',
            returnType: 'text',
            patterns: ['ul li'],
            meta: { isContainer: true },
          },
          {
            key: 'id',
            patternType: 'css',
            returnType: 'text',
            patterns: ['span'],
          },
        ],
        pagination: {
          type: 'load-more',
          selector: '.load-more-btn',
          maxPages: 10,
          waitAfter: 0,
        } as PaginationOptions,
      });

      expect(result.results).toEqual(items);
      expect(mockBtn.click).toHaveBeenCalledTimes(1);
      extractSpy.mockRestore();
    });

    it('infinite-scroll: stops when item count is stable', async () => {
      const items = [{ id: '1' }, { id: '2' }];
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue(undefined),
        $: jest.fn().mockResolvedValue(null),
        $x: jest.fn().mockResolvedValue([]),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);
      pageService.closePage.mockResolvedValue(undefined);

      const extractSpy = jest
        .spyOn(
          service as unknown as ServiceWithPrivate,
          'executeContainerExtraction',
        )
        .mockResolvedValue({ items, pagination: undefined });

      const result = await service.evaluateWebsite({
        url: 'https://example.com',
        patterns: [
          {
            key: 'CONTAINER',
            patternType: 'css',
            returnType: 'text',
            patterns: ['ul li'],
            meta: { isContainer: true },
          },
          {
            key: 'id',
            patternType: 'css',
            returnType: 'text',
            patterns: ['span'],
          },
        ],
        pagination: {
          type: 'infinite-scroll',
          maxPages: 20,
          waitAfter: 0,
        } as PaginationOptions,
      });

      expect(result.results).toEqual(items);
      // Should stop after 2 calls (first returns items, second same count -> stop)
      expect(extractSpy).toHaveBeenCalledTimes(2);
      extractSpy.mockRestore();
    });

    it('infinite-scroll: stops when endSelector is visible', async () => {
      const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const endEl = {};
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue(undefined),
        $: jest.fn().mockResolvedValue(endEl), // endSelector found immediately
        $x: jest.fn().mockResolvedValue([]),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);
      pageService.closePage.mockResolvedValue(undefined);

      const extractSpy = jest
        .spyOn(
          service as unknown as ServiceWithPrivate,
          'executeContainerExtraction',
        )
        .mockResolvedValue({ items, pagination: undefined });

      const result = await service.evaluateWebsite({
        url: 'https://example.com',
        patterns: [
          {
            key: 'CONTAINER',
            patternType: 'css',
            returnType: 'text',
            patterns: ['ul li'],
            meta: { isContainer: true },
          },
          {
            key: 'id',
            patternType: 'css',
            returnType: 'text',
            patterns: ['span'],
          },
        ],
        pagination: {
          type: 'infinite-scroll',
          endSelector: '.no-more',
          maxPages: 20,
          waitAfter: 0,
        } as PaginationOptions,
      });

      expect(result.results).toEqual(items);
      // Stops after 1st scrape because endSelector is visible
      expect(extractSpy).toHaveBeenCalledTimes(1);
      extractSpy.mockRestore();
    });

    it('url-increment: stops on empty result page, merges with page 1', async () => {
      let scrapeCallCount = 0;
      const page1Items = [{ id: 'a' }];
      const page2Items = [{ id: 'b' }];

      const spy = jest
        .spyOn(service, 'scrapeContainerFields')
        .mockImplementation(async () => {
          scrapeCallCount++;
          if (scrapeCallCount === 1)
            return { items: page1Items, pagination: undefined };
          if (scrapeCallCount === 2)
            return { items: page2Items, pagination: undefined };
          return { items: [], pagination: undefined }; // page 3 -> stop
        });

      const result = await service.evaluateWebsite({
        url: 'https://example.com/list',
        patterns: [
          {
            key: 'CONTAINER',
            patternType: 'css',
            returnType: 'text',
            patterns: ['ul li'],
            meta: { isContainer: true },
          },
          {
            key: 'id',
            patternType: 'css',
            returnType: 'text',
            patterns: ['span'],
          },
        ],
        pagination: {
          type: 'url-increment',
          urlTemplate: 'https://example.com/list?page={page}',
          startPage: 2,
          maxPages: 10,
          waitAfter: 0,
        } as PaginationOptions,
      });

      expect(result.results).toEqual([...page1Items, ...page2Items]);
      expect(result.totalPages).toBe(2); // page 1 + page 2
      spy.mockRestore();
    });

    it('url-increment: respects maxPages cap', async () => {
      const spy = jest
        .spyOn(service, 'scrapeContainerFields')
        .mockResolvedValue({ items: [{ id: 'x' }], pagination: undefined });

      const result = await service.evaluateWebsite({
        url: 'https://example.com/list',
        patterns: [
          {
            key: 'CONTAINER',
            patternType: 'css',
            returnType: 'text',
            patterns: ['ul li'],
            meta: { isContainer: true },
          },
          {
            key: 'id',
            patternType: 'css',
            returnType: 'text',
            patterns: ['span'],
          },
        ],
        pagination: {
          type: 'url-increment',
          urlTemplate: 'https://example.com/list?page={page}',
          startPage: 2,
          maxPages: 3,
          waitAfter: 0,
        } as PaginationOptions,
      });

      // Page 1 (base url) + 3 additional = 4 total calls to scrapeContainerFields
      expect(spy).toHaveBeenCalledTimes(4);
      expect(result.results).toHaveLength(4); // 1 per call
      spy.mockRestore();
    });
  });
});
