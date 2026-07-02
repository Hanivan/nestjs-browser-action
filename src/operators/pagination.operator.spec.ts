import type { Page, ElementHandle } from 'puppeteer-core';
import { PaginationOperator } from './pagination.operator';
import { LoggerWithLevel } from '../utils/logger.util';

/**
 * Smoke spec: construct PaginationOperator directly (no service, no Nest
 * DI) and port the simplest click-next case from
 * browser-action.pagination.spec.ts to call the operator's public method
 * directly, proving the loop driver works standalone.
 */
function makePage(overrides: Partial<Page> = {}): jest.Mocked<Page> {
  return {
    $: jest.fn().mockResolvedValue(null),
    $$: jest.fn().mockResolvedValue([]),
    $eval: jest.fn(),
    $$eval: jest.fn(),
    evaluate: jest.fn().mockResolvedValue(undefined),
    waitForNavigation: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(null),
    goto: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as jest.Mocked<Page>;
}

describe('PaginationOperator', () => {
  let operator: PaginationOperator;
  let logger: LoggerWithLevel;

  beforeEach(() => {
    logger = new LoggerWithLevel('PaginationOperatorSpec', 'error');
    operator = new PaginationOperator(logger, 1000);
  });

  describe('paginateClickNext', () => {
    it('collects items across pages by clicking next', async () => {
      const page = makePage();

      const btn = {
        click: jest.fn().mockResolvedValue(undefined),
      } as unknown as ElementHandle<Element>;

      const containerFn = jest
        .fn()
        .mockResolvedValueOnce([{ title: 'P1A' }, { title: 'P1B' }])
        .mockResolvedValueOnce([{ title: 'P2A' }]);

      // button present page 1, gone page 2
      (page.$ as jest.Mock).mockResolvedValueOnce(btn).mockResolvedValue(null);

      const result = await operator.paginateClickNext(
        page,
        containerFn as unknown as (p: Page) => Promise<{ title: string }[]>,
        { type: 'click-next', selector: 'a.next', maxPages: 5, waitAfter: 0 },
      );

      expect(result.items).toEqual([
        { title: 'P1A' },
        { title: 'P1B' },
        { title: 'P2A' },
      ]);
      expect(result.pages).toBe(2);
      expect(btn.click).toHaveBeenCalledTimes(1);
    });
  });
});
