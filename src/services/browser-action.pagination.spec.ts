/**
 * Unit tests for the four pagination strategies in BrowserActionService.
 *
 * infinite-scroll / load-more / click-next:
 *   evaluateWebsite() opens one persistent page and the inner containerFn
 *   calls executeContainerExtraction() — spy on that (private, cast via any).
 *
 * url-increment:
 *   evaluateWebsite() calls scrapeContainerFields() for every page URL — spy
 *   on that public method instead.
 */
import { Test, TestingModule } from '@nestjs/testing';
import type { Page } from 'puppeteer-core';
import { BrowserActionService } from './browser-action.service';
import { PageService } from './page.service';
import { CookieService } from './cookie.service';
import { CleansingService } from './cleansing.service';
import type { EvaluateOptions } from '../interfaces/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Build EvaluateOptions with a container pattern + pagination. */
function opts(
  pagination: EvaluateOptions['pagination'],
  extra: Partial<EvaluateOptions> = {},
): EvaluateOptions {
  return {
    url: 'https://example.com/list',
    patterns: [
      {
        key: 'container',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.item'],
        meta: { isContainer: true },
      },
      {
        key: 'title',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.title'],
      },
    ],
    pagination,
    ...extra,
  };
}

/** Shorthand for a ContainerScrapeResult-shaped object */
const csr = (titles: string[]) => ({
  items: titles.map((t) => ({ title: t })),
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('BrowserActionService — pagination strategies', () => {
  let service: BrowserActionService;
  let pageService: {
    navigateTo: jest.Mock;
    closePage: jest.Mock;
    getLogLevel: jest.Mock;
  };

  beforeEach(async () => {
    pageService = {
      navigateTo: jest.fn(),
      closePage: jest.fn().mockResolvedValue(undefined),
      getLogLevel: jest.fn().mockReturnValue('debug'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserActionService,
        { provide: PageService, useValue: pageService },
        { provide: CookieService, useValue: {} },
        { provide: CleansingService, useValue: {} },
      ],
    }).compile();

    service = await module.resolve<BrowserActionService>(BrowserActionService);
  });

  // -------------------------------------------------------------------------
  // infinite-scroll
  // -------------------------------------------------------------------------
  describe('infinite-scroll', () => {
    it('accumulates items across scroll rounds and stops when count stabilises', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      // containerFn calls executeContainerExtraction; count: 2 → 4 → 4 (stable)
      const spy = jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValueOnce(csr(['A', 'B']))
        .mockResolvedValueOnce(csr(['A', 'B', 'C', 'D']))
        .mockResolvedValueOnce(csr(['A', 'B', 'C', 'D']));

      const result = await service.evaluateWebsite(
        opts({ type: 'infinite-scroll', maxPages: 10, waitAfter: 0 }),
      );

      expect(result.results).toHaveLength(4);
      expect(result.results.map((r) => r['title'])).toEqual([
        'A',
        'B',
        'C',
        'D',
      ]);
      // 2 growing rounds + 1 stable check = 3 calls
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('stops early when endSelector element is found', async () => {
      const page = makePage();
      const sentinel = { scrollIntoView: jest.fn() } as unknown as Element;
      pageService.navigateTo.mockResolvedValue(page);

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValue(csr(['A']));

      // endSelector found immediately
      (page.$ as jest.Mock).mockResolvedValue(sentinel);

      const result = await service.evaluateWebsite(
        opts({
          type: 'infinite-scroll',
          endSelector: '.end-of-list',
          waitAfter: 0,
        }),
      );

      expect(result.results).toHaveLength(1);
      // endSelector hit → returned without scrolling
      expect(page.evaluate).not.toHaveBeenCalled();
    });

    it('respects maxPages cap', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      let n = 0;
      const spy = jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockImplementation(async () => {
          n += 1;
          return csr(Array.from({ length: n }, (_, i) => `item${i}`));
        });

      const result = await service.evaluateWebsite(
        opts({ type: 'infinite-scroll', maxPages: 3, waitAfter: 0 }),
      );

      // maxPages=3 → 3 loop iterations + 1 final call = 4
      expect(spy).toHaveBeenCalledTimes(4);
      expect(result.results).toHaveLength(4);
    });

    it('returns collected items when frame detaches mid-scroll', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      // loop: call 1 grows (A,B), call 2 throws → break; final-read: call 3 also throws
      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValueOnce(csr(['A', 'B']))
        .mockRejectedValueOnce(
          new Error('Attempted to use detached Frame "ABC"'),
        )
        .mockRejectedValueOnce(
          new Error('Attempted to use detached Frame "ABC"'),
        );

      const result = await service.evaluateWebsite(
        opts({ type: 'infinite-scroll', maxPages: 5, waitAfter: 0 }),
      );

      expect(result.results).toHaveLength(2);
      expect(result.results.map((r) => r['title'])).toEqual(['A', 'B']);
    });

    it('returns collected items when target closes mid-scroll', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      // loop: call 1 grows (X), call 2 throws → break; final-read: call 3 also throws
      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValueOnce(csr(['X']))
        .mockRejectedValueOnce(new Error('Target closed'))
        .mockRejectedValueOnce(new Error('Target closed'));

      const result = await service.evaluateWebsite(
        opts({ type: 'infinite-scroll', maxPages: 5, waitAfter: 0 }),
      );

      expect(result.results).toHaveLength(1);
    });

    it('rethrows unexpected errors', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(
        service.evaluateWebsite(
          opts({ type: 'infinite-scroll', waitAfter: 0 }),
        ),
      ).rejects.toThrow('Database connection failed');
    });

    it('scrolls to sentinel element when selector is found', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      const sentinel = {} as Element;
      (page.$ as jest.Mock)
        .mockResolvedValueOnce(sentinel) // selector found
        .mockResolvedValue(null); // endSelector checks

      let n = 0;
      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockImplementation(async () => {
          n++;
          return csr(n === 1 ? ['A'] : ['A', 'B']);
        });

      await service.evaluateWebsite(
        opts({
          type: 'infinite-scroll',
          selector: '.load-more-sentinel',
          waitAfter: 0,
        }),
      );

      // page.evaluate invoked with scrollIntoView for the sentinel
      expect(page.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        sentinel,
      );
    });
  });

  // -------------------------------------------------------------------------
  // load-more
  // -------------------------------------------------------------------------
  describe('load-more', () => {
    it('accumulates items by clicking load-more until no button', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      const btn = {
        click: jest.fn().mockResolvedValue(undefined),
      } as unknown as Element;

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValueOnce(csr(['A']))
        .mockResolvedValueOnce(csr(['A', 'B']))
        .mockResolvedValueOnce(csr(['A', 'B'])); // stable

      // button present on first click attempt, gone on second
      (page.$ as jest.Mock).mockResolvedValueOnce(btn).mockResolvedValue(null);

      const result = await service.evaluateWebsite(
        opts({
          type: 'load-more',
          selector: '.load-more',
          maxPages: 5,
          waitAfter: 0,
        }),
      );

      expect(result.results).toHaveLength(2);
      expect(btn.click).toHaveBeenCalledTimes(1);
    });

    it('stops when item count stabilises (no new content loaded)', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      const btn = {
        click: jest.fn().mockResolvedValue(undefined),
      } as unknown as Element;
      (page.$ as jest.Mock).mockResolvedValue(btn);

      // previousCount starts at 0; first call returns 1 item → grows → click.
      // second call returns same 1 item → stable → returns immediately.
      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValue(csr(['A']));

      const result = await service.evaluateWebsite(
        opts({
          type: 'load-more',
          selector: '.load-more',
          maxPages: 5,
          waitAfter: 0,
        }),
      );

      expect(result.results).toHaveLength(1);
      // grew on first read → button clicked once before stable detected
      expect(btn.click).toHaveBeenCalledTimes(1);
    });

    it('returns collected items when target closes mid-click', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      const btn = {
        click: jest.fn().mockRejectedValue(new Error('Target closed')),
      } as unknown as Element;
      (page.$ as jest.Mock).mockResolvedValue(btn);

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValueOnce(csr(['A', 'B']))
        .mockRejectedValue(new Error('Target closed'));

      const result = await service.evaluateWebsite(
        opts({
          type: 'load-more',
          selector: '.load-more',
          maxPages: 5,
          waitAfter: 0,
        }),
      );

      expect(result.results).toHaveLength(2);
    });

    it('returns collected items when frame detaches mid-load', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      const btn = {
        click: jest.fn().mockResolvedValue(undefined),
      } as unknown as Element;
      (page.$ as jest.Mock).mockResolvedValue(btn);

      // loop: call 1 (1 item), call 2 (2 items), call 3 throws → break;
      // final-read: call 4 also throws → returns lastItems (2 items)
      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValueOnce(csr(['A']))
        .mockResolvedValueOnce(csr(['A', 'B']))
        .mockRejectedValueOnce(
          new Error('Attempted to use detached Frame "XYZ"'),
        )
        .mockRejectedValueOnce(
          new Error('Attempted to use detached Frame "XYZ"'),
        );

      const result = await service.evaluateWebsite(
        opts({
          type: 'load-more',
          selector: '.load-more',
          maxPages: 5,
          waitAfter: 0,
        }),
      );

      expect(result.results).toHaveLength(2);
    });

    it('rethrows unexpected errors', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockRejectedValue(new Error('Network error'));

      await expect(
        service.evaluateWebsite(
          opts({ type: 'load-more', selector: '.btn', waitAfter: 0 }),
        ),
      ).rejects.toThrow('Network error');
    });
  });

  // -------------------------------------------------------------------------
  // click-next
  // -------------------------------------------------------------------------
  describe('click-next', () => {
    it('collects items across pages by clicking next', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      const btn = {
        click: jest.fn().mockResolvedValue(undefined),
      } as unknown as Element;

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValueOnce(csr(['P1A', 'P1B']))
        .mockResolvedValueOnce(csr(['P2A']));

      // button present page 1, gone page 2
      (page.$ as jest.Mock).mockResolvedValueOnce(btn).mockResolvedValue(null);

      const result = await service.evaluateWebsite(
        opts({
          type: 'click-next',
          selector: 'a.next',
          maxPages: 5,
          waitAfter: 0,
        }),
      );

      expect(result.results).toHaveLength(3);
      expect(btn.click).toHaveBeenCalledTimes(1);
    });

    it('stops when next button is absent on first page', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValue(csr(['A']));

      (page.$ as jest.Mock).mockResolvedValue(null); // no next button

      const result = await service.evaluateWebsite(
        opts({
          type: 'click-next',
          selector: 'a.next',
          maxPages: 5,
          waitAfter: 0,
        }),
      );

      expect(result.results).toHaveLength(1);
    });

    it('returns collected items when target closes mid-navigation', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      const btn = {
        click: jest.fn().mockResolvedValue(undefined),
      } as unknown as Element;
      (page.$ as jest.Mock).mockResolvedValue(btn);
      (page.waitForNavigation as jest.Mock).mockRejectedValue(
        new Error('Target closed'),
      );

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValue(csr(['A']));

      const result = await service.evaluateWebsite(
        opts({
          type: 'click-next',
          selector: 'a.next',
          maxPages: 5,
          waitAfter: 0,
        }),
      );

      expect(result.results).toHaveLength(1);
    });

    it('returns collected items on navigation timeout (TimeoutError)', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      const btn = {
        click: jest.fn().mockResolvedValue(undefined),
      } as unknown as Element;
      (page.$ as jest.Mock).mockResolvedValue(btn);
      (page.waitForNavigation as jest.Mock).mockRejectedValue(
        new Error('TimeoutError waiting for navigation'),
      );

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValue(csr(['A', 'B']));

      const result = await service.evaluateWebsite(
        opts({
          type: 'click-next',
          selector: 'a.next',
          maxPages: 5,
          waitAfter: 0,
        }),
      );

      expect(result.results).toHaveLength(2);
    });

    it('respects maxPages cap', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      const btn = {
        click: jest.fn().mockResolvedValue(undefined),
      } as unknown as Element;
      (page.$ as jest.Mock).mockResolvedValue(btn);

      const spy = jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValue(csr(['A']));

      const result = await service.evaluateWebsite(
        opts({
          type: 'click-next',
          selector: 'a.next',
          maxPages: 3,
          waitAfter: 0,
        }),
      );

      // maxPages=3 → 3 pages collected
      expect(result.results).toHaveLength(3);
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('rethrows unexpected errors', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockRejectedValue(new Error('Unexpected parse error'));

      await expect(
        service.evaluateWebsite(
          opts({ type: 'click-next', selector: 'a.next', waitAfter: 0 }),
        ),
      ).rejects.toThrow('Unexpected parse error');
    });
  });

  // -------------------------------------------------------------------------
  // url-increment
  //
  // evaluateWebsite() calls scrapeContainerFields() for page 1 then for each
  // increment page — spy on that public method.
  // Total spy calls = 1 (page 1) + N (paginateUrlIncrement iterations).
  // -------------------------------------------------------------------------
  describe('url-increment', () => {
    it('fetches pages by incrementing URL and accumulates items', async () => {
      // url-increment does not keep a persistent page open — navigateTo is
      // called per URL inside scrapeContainerFields; no page mock needed.
      const spy = jest
        .spyOn(service, 'scrapeContainerFields')
        .mockResolvedValueOnce({
          items: [{ title: 'P1A' }, { title: 'P1B' }] as any[],
        })
        .mockResolvedValueOnce({ items: [{ title: 'P2A' }] as any[] })
        .mockResolvedValueOnce({ items: [] as any[] }); // empty → stop

      const result = await service.evaluateWebsite(
        opts({
          type: 'url-increment',
          urlTemplate: 'https://example.com/list?page={page}',
          startPage: 2,
          maxPages: 10,
          waitAfter: 0,
        }),
      );

      // page1 + P2A (P3 empty → stopped)
      expect(result.results.map((r) => r['title'])).toEqual([
        'P1A',
        'P1B',
        'P2A',
      ]);
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('stops at maxPages even if pages keep returning items', async () => {
      const spy = jest
        .spyOn(service, 'scrapeContainerFields')
        .mockResolvedValue({ items: [{ title: 'A' }] as any[] });

      const result = await service.evaluateWebsite(
        opts({
          type: 'url-increment',
          urlTemplate: 'https://example.com/list?page={page}',
          startPage: 2,
          maxPages: 4,
          waitAfter: 0,
        }),
      );

      // 1 (page 1) + 4 (incremented pages 2-5) = 5 calls, 5 items
      expect(spy).toHaveBeenCalledTimes(5);
      expect(result.results).toHaveLength(5);
    });

    it('returns collected items when target closes mid-fetch', async () => {
      jest
        .spyOn(service, 'scrapeContainerFields')
        .mockResolvedValueOnce({ items: [{ title: 'P1' }] as any[] })
        .mockResolvedValueOnce({ items: [{ title: 'P2' }] as any[] })
        .mockRejectedValueOnce(new Error('Target closed'));

      const result = await service.evaluateWebsite(
        opts({
          type: 'url-increment',
          urlTemplate: 'https://example.com/list?page={page}',
          startPage: 2,
          maxPages: 10,
          waitAfter: 0,
        }),
      );

      expect(result.results).toHaveLength(2);
      expect(result.results.map((r) => r['title'])).toEqual(['P1', 'P2']);
    });

    it('returns collected items when frame detaches mid-fetch', async () => {
      jest
        .spyOn(service, 'scrapeContainerFields')
        .mockResolvedValueOnce({ items: [{ title: 'P1' }] as any[] })
        .mockRejectedValueOnce(
          new Error('Attempted to use detached Frame "123"'),
        );

      const result = await service.evaluateWebsite(
        opts({
          type: 'url-increment',
          urlTemplate: 'https://example.com/list?page={page}',
          startPage: 2,
          maxPages: 10,
          waitAfter: 0,
        }),
      );

      expect(result.results).toHaveLength(1);
    });

    it('rethrows unexpected errors', async () => {
      jest
        .spyOn(service, 'scrapeContainerFields')
        .mockRejectedValue(new Error('Auth required'));

      await expect(
        service.evaluateWebsite(
          opts({
            type: 'url-increment',
            urlTemplate: 'https://example.com/list?page={page}',
            waitAfter: 0,
          }),
        ),
      ).rejects.toThrow('Auth required');
    });

    it('uses startPage from options (not hardcoded 2)', async () => {
      const spy = jest
        .spyOn(service, 'scrapeContainerFields')
        .mockResolvedValueOnce({ items: [{ title: 'P1' }] as any[] })
        .mockResolvedValueOnce({ items: [{ title: 'P5' }] as any[] })
        .mockResolvedValue({ items: [] as any[] });

      await service.evaluateWebsite(
        opts({
          type: 'url-increment',
          urlTemplate: 'https://example.com/list?page={page}',
          startPage: 5,
          maxPages: 3,
          waitAfter: 0,
        }),
      );

      // second call (first increment) should have url containing page=5
      const secondCallUrl = (spy.mock.calls[1] as [string, ...unknown[]])[0];
      expect(secondCallUrl).toContain('page=5');
    });
  });

  // -------------------------------------------------------------------------
  // resource cleanup — closePage always called
  // -------------------------------------------------------------------------
  describe('resource cleanup', () => {
    it('calls closePage even when pagination throws', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockRejectedValue(new Error('boom'));

      await expect(
        service.evaluateWebsite(
          opts({ type: 'infinite-scroll', waitAfter: 0 }),
        ),
      ).rejects.toThrow('boom');

      expect(pageService.closePage).toHaveBeenCalled();
    });

    it('calls closePage on successful run', async () => {
      const page = makePage();
      pageService.navigateTo.mockResolvedValue(page);

      jest
        .spyOn(service as any, 'executeContainerExtraction')
        .mockResolvedValue(csr(['A']));

      await service.evaluateWebsite(
        opts({ type: 'infinite-scroll', maxPages: 1, waitAfter: 0 }),
      );

      expect(pageService.closePage).toHaveBeenCalled();
    });
  });
});
