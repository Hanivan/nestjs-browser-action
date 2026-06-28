import { Test, TestingModule } from '@nestjs/testing';
import type { Page } from 'puppeteer-core';
import { BrowserActionService } from './browser-action.service';
import { PageService } from './page.service';
import { CookieService } from './cookie.service';
import { CleansingService } from './cleansing.service';
import type {
  WorkflowAction,
  WorkflowDefinition,
  VariableContext,
} from '../interfaces/workflow-options';
import { CleansingType } from '../enums/cleansing-type.enum';
import type { CleanerStepRules } from '../pipes/pipe-engine';

type MockPage = Page;

describe('BrowserActionService - Cleanse Action', () => {
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
            closePage: jest.fn(),
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

  describe('executeAction - cleanse', () => {
    it('should cleanse a value with trim rule', async () => {
      const mockPage = {} as unknown as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'cleanedText',
        value: '  dirty text  ',
        options: { pipes: { trim: true } },
      };

      await service['executeAction'](mockPage, action, context);
      expect(context.cleanedText).toBe('dirty text');
    });

    it('should cleanse with toLowerCase', async () => {
      const mockPage = {} as unknown as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'result',
        value: '  HELLO WORLD  ',
        options: { pipes: { trim: true, toLowerCase: true } },
      };

      await service['executeAction'](mockPage, action, context);
      expect(context.result).toBe('hello world');
    });

    it('should cleanse with toUpperCase', async () => {
      const mockPage = {} as unknown as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'result',
        value: 'hello',
        options: { pipes: { toUpperCase: true } },
      };

      await service['executeAction'](mockPage, action, context);
      expect(context.result).toBe('HELLO');
    });

    it('should cleanse with replace rules', async () => {
      const mockPage = {} as unknown as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'result',
        value: 'foo bar foo',
        options: { pipes: { replace: [{ from: 'foo', to: 'baz' }] } },
      };

      await service['executeAction'](mockPage, action, context);
      expect(context.result).toBe('baz bar baz');
    });

    it('should cleanse with custom pipes', async () => {
      const mockPage = {} as unknown as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'cleanedPrice',
        value: '$29.99',
        options: {
          pipes: {
            trim: true,
            custom: [
              { type: CleansingType.REMOVE_CURRENCY_SYMBOL, symbols: ['$'] },
            ],
          },
        },
      };

      await service['executeAction'](mockPage, action, context);
      expect(context.cleanedPrice).toBe('29.99');
    });

    it('should cleanse a value from context variable', async () => {
      const mockPage = {} as unknown as MockPage;
      const context: VariableContext = { rawPrice: '  $ 29.99  ' };
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'cleanedPrice',
        value: '${rawPrice}',
        options: { pipes: { trim: true } },
      };

      await service['executeAction'](mockPage, action, context);
      expect(context.cleanedPrice).toBe('$ 29.99');
    });

    it('should not store anything when action has no id', async () => {
      const mockPage = {} as unknown as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        value: 'test value',
        options: { pipes: { trim: true } },
      };

      await service['executeAction'](mockPage, action, context);
      expect(Object.keys(context)).toHaveLength(0);
    });

    it('should throw when no pipes provided', async () => {
      const mockPage = {} as unknown as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'result',
        value: 'test',
      };

      await expect(
        service['executeAction'](mockPage, action, context),
      ).rejects.toThrow('cleanse action requires pipes');
    });

    it('should cleanse an array by mapping over each item', async () => {
      const mockPage = {} as unknown as MockPage;
      const context: VariableContext = {
        rawCategories: ['  Electronics  ', '  Home  ', '  Sports  '],
      };
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'categories',
        value: '${rawCategories}',
        options: { pipes: { trim: true } },
      };

      await service['executeAction'](mockPage, action, context);
      expect(context.categories).toEqual(['Electronics', 'Home', 'Sports']);
    });

    it('should skip when condition evaluates false', async () => {
      const mockPage = {} as unknown as MockPage;
      const context: VariableContext = {};
      const action: WorkflowAction = {
        action: 'cleanse',
        id: 'cleanedValue',
        value: 'test value',
        options: { pipes: { trim: true } },
        condition: { ifExists: { type: 'css', value: '.nonexistent' } },
      };

      service['evaluateCondition'] = jest.fn().mockResolvedValue(false);

      await service['executeAction'](mockPage, action, context);
      expect(context).not.toHaveProperty('cleanedValue');
    });
  });

  describe('cleanse action in workflow', () => {
    it('should work as part of a complete workflow', async () => {
      const mockPage = {
        $: jest.fn().mockResolvedValue({
          evaluate: jest.fn().mockResolvedValue('$29.99'),
        }),
        $eval: jest.fn().mockResolvedValue('$29.99'),
        goto: jest.fn(),
        screenshot: jest.fn(),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);
      pageService.closePage.mockResolvedValue(undefined);

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
              pipes: {
                trim: true,
                custom: [
                  {
                    type: CleansingType.REMOVE_CURRENCY_SYMBOL,
                    symbols: ['$'],
                  },
                ],
              },
            },
          },
        ],
      };

      const result = await service.scrapeWithWorkflow(
        'https://example.com',
        workflow,
      );

      expect(result.success).toBe(true);
      expect(result.data.rawPrice).toBe('$29.99');
      expect(result.data.cleanPrice).toBe('29.99');
    });

    it('should fail workflow when no pipes provided for cleanse', async () => {
      const mockPage = {
        $: jest.fn().mockResolvedValue({
          evaluate: jest.fn().mockResolvedValue('test'),
        }),
        $eval: jest.fn().mockResolvedValue('test'),
        goto: jest.fn(),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);
      pageService.closePage.mockResolvedValue(undefined);

      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            action: 'extract',
            target: { type: 'css', value: '.v' },
            id: 'rawValue',
          },
          { action: 'cleanse', id: 'cleanValue', value: '${rawValue}' },
        ],
      };

      const result = await service.scrapeWithWorkflow(
        'https://example.com',
        workflow,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('cleanse action requires pipes');
    });
  });

  describe('scrape with pipes (CleanerStepRules format)', () => {
    it('should apply CleanerStepRules to scraped fields', async () => {
      const mockPage = {
        $eval: jest
          .fn()
          .mockReturnValueOnce('  Product Title  ')
          .mockReturnValueOnce('  29.99  '),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);
      pageService.closePage.mockResolvedValue(undefined);

      const pipes: Record<string, CleanerStepRules> = {
        title: { trim: true, toLowerCase: true },
        price: { trim: true },
      };

      const result = await service.scrape(
        'https://example.com',
        { title: '.title', price: '.price' },
        { pipes },
      );

      expect(result.title).toBe('product title');
      expect(result.price).toBe('29.99');
    });

    it('should pass value through unchanged when no pipe config for that field', async () => {
      const mockPage = {
        $eval: jest
          .fn()
          .mockReturnValueOnce('  Product Title  ')
          .mockReturnValueOnce('  29.99  '),
      } as unknown as Page;

      pageService.navigateTo.mockResolvedValue(mockPage);
      pageService.closePage.mockResolvedValue(undefined);

      const result = await service.scrape(
        'https://example.com',
        { title: '.title', price: '.price' },
        { pipes: { price: { trim: true } } },
      );

      expect(result.title).toBe('  Product Title  ');
      expect(result.price).toBe('29.99');
    });
  });
});
