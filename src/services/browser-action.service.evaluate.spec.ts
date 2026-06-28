import { Test, TestingModule } from '@nestjs/testing';
import type { Page } from 'puppeteer-core';
import { BrowserActionService } from './browser-action.service';
import { PageService } from './page.service';
import { CookieService } from './cookie.service';
import { CleansingService } from './cleansing.service';
import type { EvaluateOptions, PatternField } from '../interfaces/types';

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
});
