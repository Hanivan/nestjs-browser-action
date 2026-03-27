import { Test, TestingModule } from '@nestjs/testing';
import type { Page } from 'puppeteer';
import { ActionHelpersService } from './action-helpers.service';
import { PageService } from '../services/page-service';
import { CookieService } from '../services/cookie.service';
import { CleansingService } from '../services/cleansing.service';
import {
  WorkflowAction,
  WorkflowDefinition,
  VariableContext,
} from '../interfaces/workflow-options';
import { CleansingType } from '../enums/cleansing-type.enum';

// Mock Page type for testing
type MockPage = Partial<Page>;

describe('ActionHelpersService - Cleanse Action', () => {
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
            loadPipes: jest.fn(),
          },
        },
      ],
    }).compile();

    service = await module.resolve<ActionHelpersService>(ActionHelpersService);
    pageService = await module.resolve<PageService>(PageService);
    cookieService = module.get<CookieService>(CookieService);
    cleansingService = module.get<CleansingService>(CleansingService);
  });

  describe('executeAction - cleanse', () => {
    it('should cleanse a value with simple pipe configuration', async () => {
      const mockPage = {} as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'cleanedPrice',
        value: '$29.99',
        options: {
          pipes: [
            { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
            { type: CleansingType.TRIM },
            { type: CleansingType.TO_NUMBER },
          ],
        },
      };

      (cleansingService.loadPipes as jest.Mock).mockReturnValueOnce([
        { type: 'remove-currency-symbol' },
        { type: 'trim' },
        { type: 'to-number' },
      ]);
      (cleansingService.cleanse as jest.Mock).mockReturnValueOnce(29.99);

      await service['executeAction'](mockPage, action, context);

      expect(context.cleanedPrice).toBe(29.99);
      expect(cleansingService.loadPipes).toHaveBeenCalledWith([
        { type: 'remove-currency-symbol' },
        { type: 'trim' },
        { type: 'to-number' },
      ]);
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '$29.99',
        expect.any(Array),
      );
    });

    it('should cleanse a value with single pipe', async () => {
      const mockPage = {} as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'cleanedText',
        value: '  dirty text  ',
        options: {
          pipes: [{ type: CleansingType.TRIM }],
        },
      };

      (cleansingService.loadPipes as jest.Mock).mockReturnValueOnce([
        { type: 'trim' },
      ]);
      (cleansingService.cleanse as jest.Mock).mockReturnValueOnce('clean text');

      await service['executeAction'](mockPage, action, context);

      expect(context.cleanedText).toBe('clean text');
      expect(cleansingService.loadPipes).toHaveBeenCalledWith([
        { type: 'trim' },
      ]);
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '  dirty text  ',
        expect.any(Array),
      );
    });

    it('should cleanse a value from context variable', async () => {
      const mockPage = {} as MockPage;
      const context: VariableContext = {
        rawPrice: '$ 29.99',
      };
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'cleanedPrice',
        value: '${rawPrice}',
        options: {
          pipes: [
            { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
            { type: CleansingType.TRIM },
            { type: CleansingType.TO_NUMBER },
          ],
        },
      };

      (cleansingService.loadPipes as jest.Mock).mockReturnValueOnce([
        { type: 'remove-currency-symbol' },
        { type: 'trim' },
        { type: 'to-number' },
      ]);
      (cleansingService.cleanse as jest.Mock).mockReturnValueOnce(29.99);

      await service['executeAction'](mockPage, action, context);

      expect(context.cleanedPrice).toBe(29.99);
      expect(cleansingService.loadPipes).toHaveBeenCalledWith([
        { type: 'remove-currency-symbol' },
        { type: 'trim' },
        { type: 'to-number' },
      ]);
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '$ 29.99',
        expect.any(Array),
      );
    });

    it('should handle cleanse action without id', async () => {
      const mockPage = {} as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        value: 'test value',
        options: {
          pipes: [{ type: CleansingType.TRIM }],
        },
      };

      await service['executeAction'](mockPage, action, context);

      // Should complete successfully but not store anything in context
      expect(Object.keys(context)).toHaveLength(0);
    });

    it('should throw error if no pipes provided', async () => {
      const mockPage = {} as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'result',
        value: 'test value',
        // No pipes provided
      };

      await expect(
        service['executeAction'](mockPage, action, context),
      ).rejects.toThrow('cleanse action requires at least one pipe');
    });

    it('should work with complex pipe configurations', async () => {
      const mockPage = {} as MockPage;
      const context: VariableContext = {
        rawText: '  Hello   WORLD!  $123.45  ',
      };
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'processedText',
        value: '${rawText}',
        options: {
          pipes: [
            { type: CleansingType.TRIM },
            { type: CleansingType.NORMALIZE_WHITESPACE },
            {
              type: CleansingType.REMOVE_SPECIAL_CHARS,
              params: { keep: [' '] },
            },
            { type: CleansingType.TO_LOWER_CASE },
          ],
        },
      };

      (cleansingService.loadPipes as jest.Mock).mockReturnValueOnce([
        { type: 'trim' },
        { type: 'normalize-whitespace' },
        { type: 'remove-special-chars', params: { keep: [' '] } },
        { type: 'to-lower-case' },
      ]);
      (cleansingService.cleanse as jest.Mock).mockReturnValueOnce(
        'hello world 12345',
      );

      await service['executeAction'](mockPage, action, context);

      expect(context.processedText).toBe('hello world 12345');
      expect(cleansingService.loadPipes).toHaveBeenCalledWith([
        { type: 'trim' },
        { type: 'normalize-whitespace' },
        { type: 'remove-special-chars', params: { keep: [' '] } },
        { type: 'to-lower-case' },
      ]);
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '  Hello   WORLD!  $123.45  ',
        expect.any(Array),
      );
    });

    it('should cleanse an array context variable by mapping pipes over each item', async () => {
      const mockPage = {} as MockPage;
      const context: VariableContext = {
        rawCategories: ['  Electronics  ', '  Home & Garden  ', '  Sports  '],
      };
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'categories',
        value: '${rawCategories}',
        options: {
          pipes: [{ type: CleansingType.TRIM }],
        },
      };

      (cleansingService.loadPipes as jest.Mock).mockReturnValueOnce([
        { type: 'trim' },
      ]);
      (cleansingService.cleanse as jest.Mock)
        .mockReturnValueOnce('Electronics')
        .mockReturnValueOnce('Home & Garden')
        .mockReturnValueOnce('Sports');

      await service['executeAction'](mockPage, action, context);

      expect(context.categories).toEqual([
        'Electronics',
        'Home & Garden',
        'Sports',
      ]);
      expect(cleansingService.cleanse).toHaveBeenCalledTimes(3);
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '  Electronics  ',
        expect.any(Array),
      );
    });

    it('should handle condition check before cleanse', async () => {
      const mockPage = {} as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'cleanedValue',
        value: 'test value',
        options: {
          pipes: [{ type: CleansingType.TRIM }],
        },
        condition: {
          ifExists: { type: 'css', value: '.exists' },
        },
      };

      // Mock condition evaluation to return false
      service['evaluateCondition'] = jest.fn().mockResolvedValue(false);

      await service['executeAction'](mockPage, action, context);

      expect(context).not.toHaveProperty('cleanedValue');
      expect(cleansingService.loadPipes).not.toHaveBeenCalled();
    });
  });

  describe('cleanse action in workflow', () => {
    it('should work as part of a complete workflow', async () => {
      const url = 'https://example.com';
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            action: 'extract',
            target: { type: 'css', value: '.price' },
            id: 'rawPrice',
          },
          {
            action: 'cleanse',
            id: 'cleanPrice',
            value: '${rawPrice}',
            options: {
              pipes: [
                { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
                { type: CleansingType.TO_NUMBER },
              ],
            },
          },
        ],
      };

      // Mock page and services
      const mockElement = {
        evaluate: jest.fn().mockResolvedValue('$29.99'),
      };
      const mockPage = {
        $: jest.fn().mockResolvedValue(mockElement),
        $eval: jest.fn().mockReturnValue('$29.99'),
        goto: jest.fn().mockResolvedValue(),
        screenshot: jest.fn().mockResolvedValue(),
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      const mockPipeInstances = [
        { exec: jest.fn((val: string) => val.replace('$', '')) }, // remove-currency-symbol: '$29.99' -> '29.99'
        { exec: jest.fn((val: string) => Number(val)) }, // to-number: '29.99' -> 29.99
      ];
      (cleansingService.loadPipes as jest.Mock).mockReturnValue(
        mockPipeInstances,
      );
      (cleansingService.cleanse as jest.Mock).mockImplementation(
        (value, pipes) => {
          return pipes.reduce(
            (result: any, pipe: any) => pipe.exec(result),
            value,
          );
        },
      );

      const result = await service.scrapeWithActions(url, workflow);

      expect(result.success).toBe(true);
      expect(result.data.rawPrice).toBe('$29.99');
      expect(result.data.cleanPrice).toBe(29.99);
      expect(cleansingService.loadPipes).toHaveBeenCalledWith([
        { type: 'remove-currency-symbol' },
        { type: 'to-number' },
      ]);
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '$29.99',
        mockPipeInstances,
      );
    });
  });

  describe('scrape with pipes', () => {
    it('should scrape data and cleanse using pipes', async () => {
      const url = 'https://example.com';
      const selectors = {
        price: '.price',
        title: '.title',
      };
      const options = {
        pipes: {
          price: [
            { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
            { type: CleansingType.TRIM },
            { type: CleansingType.TO_NUMBER },
          ],
          title: [
            { type: CleansingType.TRIM },
            { type: CleansingType.REMOVE_EXCESS_WHITESPACE },
          ],
        },
      };

      const mockPage = {
        $eval: jest
          .fn()
          .mockReturnValueOnce('$  29.99  ') // price
          .mockReturnValueOnce('  Product Title  '), // title
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      // Mock pipe loading
      (cleansingService.loadPipes as jest.Mock)
        .mockReturnValueOnce([
          { type: 'remove-currency-symbol' },
          { type: 'trim' },
          { type: 'to-number' },
        ])
        .mockReturnValueOnce([
          { type: 'trim' },
          { type: 'remove-excess-whitespace' },
        ]);

      // Mock cleansing
      (cleansingService.cleanse as jest.Mock)
        .mockReturnValueOnce(29.99)
        .mockReturnValueOnce('Product Title');

      const result = await service.scrape(url, selectors, options);

      expect(result).toEqual({
        price: 29.99,
        title: 'Product Title',
      });
      expect(cleansingService.loadPipes).toHaveBeenCalledTimes(2);
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '$  29.99  ',
        expect.any(Array),
      );
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '  Product Title  ',
        expect.any(Array),
      );
    });

    it('should scrape data without pipes when not specified', async () => {
      const url = 'https://example.com';
      const selectors = {
        price: '.price',
        title: '.title',
      };
      const options = {
        pipes: {
          price: [
            { type: CleansingType.REMOVE_CURRENCY_SYMBOL },
            { type: CleansingType.TO_NUMBER },
          ],
          // No pipes for title
        },
      };

      const mockPage = {
        $eval: jest
          .fn()
          .mockReturnValueOnce('$29.99')
          .mockReturnValueOnce('Product Title'),
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      // Mock only price pipe loading
      (cleansingService.loadPipes as jest.Mock).mockReturnValueOnce([
        { type: 'remove-currency-symbol' },
        { type: 'to-number' },
      ]);

      // Mock only price cleansing
      (cleansingService.cleanse as jest.Mock).mockReturnValueOnce(29.99);

      const result = await service.scrape(url, selectors, options);

      expect(result).toEqual({
        price: 29.99,
        title: 'Product Title',
      });
      expect(cleansingService.loadPipes).toHaveBeenCalledTimes(1);
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '$29.99',
        expect.any(Array),
      );
      expect(cleansingService.cleanse).not.toHaveBeenCalledWith(
        'Product Title',
        expect.any(Array),
      );
    });

    it('should handle field scraping errors gracefully', async () => {
      const url = 'https://example.com';
      const selectors = {
        price: '.price',
        invalid: '.invalid-selector',
      };
      const options = {
        pipes: {
          price: [{ type: CleansingType.TRIM }],
        },
      };

      const mockPage = {
        $eval: jest
          .fn()
          .mockReturnValueOnce('  29.99  ')
          .mockImplementationOnce(() => {
            throw new Error('Element not found');
          }),
      } as any;

      (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
      (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

      (cleansingService.loadPipes as jest.Mock).mockReturnValueOnce([
        { type: 'trim' },
      ]);
      (cleansingService.cleanse as jest.Mock).mockReturnValueOnce('29.99');

      const result = await service.scrape(url, selectors, options);

      expect(result).toEqual({
        price: '29.99',
        // invalid should be undefined due to error
      });
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '  29.99  ',
        expect.any(Array),
      );
    });
  });

  describe('scrapeWithActions with cleanse action', () => {
    it('should execute cleanse workflow action', async () => {
      const workflow = {
        version: '1.0' as const,
        actions: [
          { action: 'navigate' as const, value: 'https://example.com' },
          {
            action: 'extract' as const,
            id: 'rawPrice',
            target: { type: 'css' as const, value: '.price' },
          },
          {
            action: 'cleanse' as const,
            id: 'cleanPrice',
            value: '${rawPrice}',
            options: {
              pipes: [
                { type: CleansingType.TRIM },
                { type: CleansingType.TO_NUMBER, decimals: 2 },
              ],
            },
          },
        ],
      };

      const mockElement = {
        evaluate: jest.fn().mockResolvedValue('  123.45  '),
      };
      const mockPage = {
        $eval: jest.fn().mockResolvedValue('  123.45  '),
        $: jest.fn().mockResolvedValue(mockElement),
        waitForSelector: jest.fn(),
        goto: jest.fn(),
      };
      pageService.navigateTo.mockResolvedValue(mockPage as any);

      const mockPipeInstances = [
        { exec: jest.fn((val: string) => val.trim()) },
        { exec: jest.fn((val: string) => parseFloat(val)) },
      ];
      cleansingService.loadPipes.mockReturnValue(mockPipeInstances);
      cleansingService.cleanse.mockImplementation((value, pipes) => {
        return pipes.reduce(
          (result: any, pipe: any) => pipe.exec(result),
          value,
        );
      });

      const result = await service.scrapeWithActions(
        'https://example.com',
        workflow,
      );

      expect(result.success).toBe(true);
      expect(result.data.cleanPrice).toBe(123.45);
      expect(cleansingService.cleanse).toHaveBeenCalledWith(
        '  123.45  ',
        expect.any(Array),
      );
    });

    it('should handle cleanse action with error when no pipes provided', async () => {
      const workflow = {
        version: '1.0' as const,
        actions: [
          { action: 'navigate' as const, value: 'https://example.com' },
          {
            action: 'extract' as const,
            id: 'rawValue',
            target: { type: 'css' as const, value: '.value' },
          },
          {
            action: 'cleanse' as const,
            id: 'cleanValue',
            value: '${rawValue}',
            // No pipes provided - should throw error
          },
        ],
      };

      const mockElement = {
        evaluate: jest.fn().mockResolvedValue('test value'),
      };
      const mockPage = {
        $eval: jest.fn().mockResolvedValue('test value'),
        $: jest.fn().mockResolvedValue(mockElement),
        waitForSelector: jest.fn(),
        goto: jest.fn(),
      };
      pageService.navigateTo.mockResolvedValue(mockPage as any);

      const result = await service.scrapeWithActions(
        'https://example.com',
        workflow,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'cleanse action requires at least one pipe',
      );
    });

    it('should handle cleanse action without id', async () => {
      const workflow = {
        version: '1.0' as const,
        actions: [
          { action: 'navigate' as const, value: 'https://example.com' },
          {
            action: 'extract' as const,
            id: 'rawValue',
            target: { type: 'css' as const, value: '.value' },
          },
          {
            action: 'cleanse' as const,
            value: '${rawValue}',
            options: {
              pipes: [{ type: CleansingType.TRIM }],
            },
            // No id provided
          },
        ],
      };

      const mockElement = {
        evaluate: jest.fn().mockResolvedValue('  test value  '),
      };
      const mockPage = {
        $eval: jest.fn().mockResolvedValue('  test value  '),
        $: jest.fn().mockResolvedValue(mockElement),
        waitForSelector: jest.fn(),
        goto: jest.fn(),
      };
      pageService.navigateTo.mockResolvedValue(mockPage as any);

      const mockPipeInstances = [
        { exec: jest.fn((val: string) => val.trim()) },
      ];
      cleansingService.loadPipes.mockReturnValue(mockPipeInstances);
      cleansingService.cleanse.mockImplementation((value, pipes) => {
        return pipes.reduce(
          (result: any, pipe: any) => pipe.exec(result),
          value,
        );
      });

      const result = await service.scrapeWithActions(
        'https://example.com',
        workflow,
      );

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('cleanValue');
      expect(result.data).toEqual({
        rawValue: '  test value  ',
      });
    });
  });
});
