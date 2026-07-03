import { WorkflowOperator } from './workflow.operator';
import { ExtractionOperator } from './extraction.operator';
import { ContainerOperator } from './container.operator';
import { PaginationOperator } from './pagination.operator';
import { PipeEngine } from '../pipes/pipe-engine';
import { LoggerWithLevel } from '../utils/logger.util';
import { CleansingService } from '../services/cleansing.service';
import { CookieService } from '../services/cookie.service';
import type { Page } from 'puppeteer-core';
import type {
  VariableContext,
  WorkflowAction,
} from '../interfaces/workflow-options';
import type { PatternField } from '../interfaces/types';

const logger = new LoggerWithLevel('test', 'error');
const pipeEngine = new PipeEngine();
const extraction = new ExtractionOperator(pipeEngine, logger);
const container = new ContainerOperator(extraction, pipeEngine, logger);
const pagination = new PaginationOperator(logger);

function makePage(overrides: Partial<Page> = {}): jest.Mocked<Page> {
  return {
    $: jest.fn().mockResolvedValue(null),
    $$: jest.fn().mockResolvedValue([]),
    $eval: jest.fn(),
    $$eval: jest.fn(),
    evaluate: jest.fn().mockResolvedValue([]),
    waitForNavigation: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(null),
    goto: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    url: jest.fn().mockReturnValue('https://example.com'),
    ...overrides,
  } as unknown as jest.Mocked<Page>;
}

describe('WorkflowOperator', () => {
  const op = new WorkflowOperator(
    extraction,
    container,
    pipeEngine,
    {} as unknown as CleansingService,
    logger,
    () => ({}) as unknown as CookieService,
    pagination,
  );

  it('executes a wait action via the moved dispatcher', async () => {
    const context: VariableContext = {};
    const page = {} as unknown as Page;
    const started = Date.now();
    await op.executeAction(
      page,
      { action: 'wait', value: 20 } as never,
      context,
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });

  describe('extractPatterns action', () => {
    it('throws when options.patterns is missing', async () => {
      const page = makePage();
      const context: VariableContext = {};
      await expect(
        op.executeAction(
          page,
          { action: 'extractPatterns', options: {} } as WorkflowAction,
          context,
        ),
      ).rejects.toThrow('extractPatterns requires options.patterns');
    });

    it('throws when options.patterns is an empty array', async () => {
      const page = makePage();
      const context: VariableContext = {};
      await expect(
        op.executeAction(
          page,
          {
            action: 'extractPatterns',
            options: { patterns: [] },
          } as WorkflowAction,
          context,
        ),
      ).rejects.toThrow('extractPatterns requires options.patterns');
    });

    it('extracts a flat object when no pattern has meta.isContainer', async () => {
      const page = makePage({
        $eval: jest
          .fn()
          .mockResolvedValueOnce('Widget')
          .mockResolvedValueOnce('$9.99'),
      });
      const context: VariableContext = {};
      const patterns: PatternField[] = [
        {
          key: 'title',
          patternType: 'css',
          returnType: 'text',
          patterns: ['h1'],
        },
        {
          key: 'price',
          patternType: 'css',
          returnType: 'text',
          patterns: ['.price'],
        },
      ];

      await op.executeAction(
        page,
        {
          id: 'result',
          action: 'extractPatterns',
          options: { patterns },
        } as WorkflowAction,
        context,
      );

      expect(context.result).toEqual({ title: 'Widget', price: '$9.99' });
      expect(page.url).toHaveBeenCalled();
    });

    it('extracts a list of items when a pattern has meta.isContainer: true', async () => {
      const mockItems = [{ name: 'Item 1' }, { name: 'Item 2' }];
      const page = makePage({
        evaluate: jest.fn().mockResolvedValue(mockItems),
      });
      const context: VariableContext = {};
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
          patterns: ['h2.name'],
        },
      ];

      await op.executeAction(
        page,
        {
          id: 'products',
          action: 'extractPatterns',
          options: { patterns },
        } as WorkflowAction,
        context,
      );

      expect(context.products).toEqual(mockItems);
      expect(context.products_pagination).toBeUndefined();
    });

    it('throws when patternPagination is set without a container pattern', async () => {
      const page = makePage();
      const context: VariableContext = {};
      const patterns: PatternField[] = [
        {
          key: 'title',
          patternType: 'css',
          returnType: 'text',
          patterns: ['h1'],
        },
      ];

      await expect(
        op.executeAction(
          page,
          {
            action: 'extractPatterns',
            options: {
              patterns,
              patternPagination: { type: 'click-next', selector: 'a.next' },
            },
          } as WorkflowAction,
          context,
        ),
      ).rejects.toThrow(
        'pagination requires a container pattern (meta.isContainer: true)',
      );
    });

    it('applies pipes to container field values', async () => {
      const mockItems = [{ price: '  $9.99  ' }];
      const page = makePage({
        evaluate: jest.fn().mockResolvedValue(mockItems),
      });
      const context: VariableContext = {};
      const patterns: PatternField[] = [
        {
          key: 'container',
          patternType: 'css',
          returnType: 'text',
          patterns: ['.product'],
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

      await op.executeAction(
        page,
        {
          id: 'products',
          action: 'extractPatterns',
          options: { patterns },
        } as WorkflowAction,
        context,
      );

      expect(context.products).toEqual([{ price: '$9.99' }]);
    });

    it('does not write to context when action.id is omitted', async () => {
      const page = makePage({
        $eval: jest.fn().mockResolvedValue('Widget'),
      });
      const context: VariableContext = {};
      const patterns: PatternField[] = [
        {
          key: 'title',
          patternType: 'css',
          returnType: 'text',
          patterns: ['h1'],
        },
      ];

      await op.executeAction(
        page,
        { action: 'extractPatterns', options: { patterns } } as WorkflowAction,
        context,
      );

      expect(context).toEqual({});
    });

    it('paginates via click-next, reusing the workflow page and merging pages', async () => {
      const btn = { click: jest.fn().mockResolvedValue(undefined) };
      const page = makePage({
        evaluate: jest
          .fn()
          .mockResolvedValueOnce([{ name: 'P1A' }])
          .mockResolvedValueOnce([{ name: 'P2A' }]),
        $: jest
          .fn()
          .mockResolvedValueOnce(btn as never)
          .mockResolvedValue(null),
      });
      const context: VariableContext = {};
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
          patterns: ['h2.name'],
        },
      ];

      await op.executeAction(
        page,
        {
          id: 'products',
          action: 'extractPatterns',
          options: {
            patterns,
            patternPagination: {
              type: 'click-next',
              selector: 'a.next',
              maxPages: 5,
              waitAfter: 0,
            },
          },
        } as WorkflowAction,
        context,
      );

      expect(context.products).toEqual([{ name: 'P1A' }, { name: 'P2A' }]);
      expect(context.products_pagination).toEqual({ pages: 2 });
    });

    it('paginates via url-increment using page.goto, not a new page', async () => {
      const page = makePage({
        evaluate: jest
          .fn()
          .mockResolvedValueOnce([{ name: 'Page1Item' }])
          .mockResolvedValueOnce([{ name: 'Page2Item' }])
          .mockResolvedValueOnce([]),
        url: jest.fn().mockReturnValue('https://example.com/list?page=1'),
      });
      const context: VariableContext = {};
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
          patterns: ['h2.name'],
        },
      ];

      await op.executeAction(
        page,
        {
          id: 'products',
          action: 'extractPatterns',
          options: {
            patterns,
            patternPagination: {
              type: 'url-increment',
              urlTemplate: 'https://example.com/list?page={page}',
              startPage: 2,
              maxPages: 3,
              waitAfter: 0,
            },
          },
        } as WorkflowAction,
        context,
      );

      expect(page.goto).toHaveBeenCalledWith(
        'https://example.com/list?page=2',
        { waitUntil: 'domcontentloaded' },
      );
      expect(context.products).toEqual([
        { name: 'Page1Item' },
        { name: 'Page2Item' },
      ]);
      expect(context.products_pagination).toEqual({ pages: 2 });
    });
  });
});
