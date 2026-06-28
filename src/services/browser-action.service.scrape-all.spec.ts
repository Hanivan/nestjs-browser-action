import { Test, TestingModule } from '@nestjs/testing';
import { BrowserActionService } from './browser-action.service';
import { PageService } from './page.service';
import { CleansingService } from './cleansing.service';
import { CookieService } from './cookie.service';

describe('BrowserActionService - scrapeAll', () => {
  let service: BrowserActionService;
  let pageService: PageService;
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
            buildPipes: jest.fn(),
            cleanse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = await module.resolve<BrowserActionService>(BrowserActionService);
    pageService = await module.resolve<PageService>(PageService);
    cleansingService = module.get<CleansingService>(CleansingService);
  });

  it('should extract multiple elements with CSS selector', async () => {
    const mockPage = {
      $$eval: jest.fn().mockResolvedValue(['Title 1', 'Title 2', 'Title 3']),
    } as any;

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    const result = await service.scrapeAll('https://example.com', {
      titles: '.card h2',
    });

    expect(result).toEqual({
      titles: ['Title 1', 'Title 2', 'Title 3'],
    });
    expect(mockPage.$$eval).toHaveBeenCalledWith(
      '.card h2',
      expect.any(Function),
    );
  });

  it('should validate selector and throw error for empty string', async () => {
    const mockPage = {
      $$eval: jest.fn(),
    } as any;

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    await expect(
      service.scrapeAll('https://example.com', {
        titles: '',
      }),
    ).rejects.toThrow("Selector for 'titles' cannot be empty");
  });

  it('should auto-detect XPath selector', async () => {
    const mockPage = {
      evaluate: jest.fn().mockResolvedValue(['Item 1', 'Item 2']),
      $$eval: jest.fn().mockResolvedValue(['Title A', 'Title B']),
    } as any;

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    const result = await service.scrapeAll('https://example.com', {
      // XPath selectors start with //
      items: '//div[@class="item"]',
      // CSS selectors
      titles: '.card h2',
    });

    expect(result).toEqual({
      items: ['Item 1', 'Item 2'],
      titles: ['Title A', 'Title B'],
    });
    expect(mockPage.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      '//div[@class="item"]',
    );
    expect(mockPage.$$eval).toHaveBeenCalledWith(
      '.card h2',
      expect.any(Function),
    );
  });

  it('should apply CleanerStepRules to each element individually', async () => {
    // scrapeAll() uses PipeEngine.apply() directly — no CleansingService mock needed
    const mockPage = {
      $$eval: jest
        .fn()
        .mockResolvedValue(['  TITLE 1  ', '  TITLE 2  ', '  TITLE 3  ']),
      evaluate: jest.fn().mockResolvedValue(['ITEM 1', 'ITEM 2']),
    } as any;

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    const result = await service.scrapeAll(
      'https://example.com',
      { titles: '.card h2' },
      { pipes: { titles: { trim: true } } },
    );

    expect(result).toEqual({
      titles: ['TITLE 1', 'TITLE 2', 'TITLE 3'],
    });
  });

  it('should apply custom pipes via CleanerStepRules (e.g. to-number)', async () => {
    const mockPage = {
      $$eval: jest.fn().mockResolvedValue(['29.99', '15.50', '99.00']),
    } as any;

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    const result = await service.scrapeAll(
      'https://example.com',
      { prices: '.product-price' },
      {
        pipes: {
          prices: { trim: true, custom: [{ type: 'to-number', decimals: 2 }] },
        },
      },
    );

    expect(Array.isArray(result.prices)).toBe(true);
    expect(result.prices).toHaveLength(3);
  });

  it('should return empty array when no elements found', async () => {
    const mockPage = {
      $$eval: jest.fn().mockResolvedValue([]),
      evaluate: jest.fn().mockResolvedValue([]),
    } as any;

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    const result = await service.scrapeAll('https://example.com', {
      titles: '.nonexistent',
    });

    expect(result).toEqual({
      titles: [],
    });
  });

  it('should handle invalid selector gracefully', async () => {
    const mockPage = {
      $$eval: jest.fn().mockRejectedValue(new Error('Invalid selector')),
      evaluate: jest.fn().mockRejectedValue(new Error('Invalid selector')),
    } as any;

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    const result = await service.scrapeAll('https://example.com', {
      titles: '???invalid???',
    });

    expect(result).toEqual({});
    expect(result.titles).toBeUndefined();
  });

  it('should handle partial failures', async () => {
    const mockPage = {
      $$eval: jest
        .fn()
        .mockResolvedValueOnce(['Title 1', 'Title 2'])
        .mockRejectedValueOnce(new Error('Failed')),
      evaluate: jest.fn().mockRejectedValueOnce(new Error('Failed')),
    } as any;

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    const result = await service.scrapeAll('https://example.com', {
      titles: '.valid',
      descriptions: '.invalid',
    });

    expect(result.titles).toEqual(['Title 1', 'Title 2']);
    expect(result.descriptions).toBeUndefined();
  });
});

describe('scrapeAllWithWorkflow', () => {
  let service: BrowserActionService;
  let pageService: PageService;
  let cleansingService: CleansingService;
  let cookieService: CookieService;

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
            buildPipes: jest.fn(),
            cleanse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = await module.resolve<BrowserActionService>(BrowserActionService);
    pageService = await module.resolve<PageService>(PageService);
    cleansingService = module.get<CleansingService>(CleansingService);
    cookieService = module.get<CookieService>(CookieService);
  });

  const createMockPage = () => ({
    $$eval: jest.fn(),
    $eval: jest.fn(),
    $: jest.fn(),
    waitForSelector: jest.fn(),
    waitForFunction: jest.fn(),
    goto: jest.fn(),
    click: jest.fn(),
    type: jest.fn(),
    select: jest.fn(),
    scrollTo: jest.fn(),
    screenshot: jest.fn(),
    evaluate: jest.fn(),
    evaluateHandle: jest.fn(),
    waitForNavigation: jest.fn(),
  });

  it('should execute workflow with multi-element extraction', async () => {
    const mockPage = {
      $$eval: jest.fn().mockResolvedValue(['Title 1', 'Title 2']),
      $eval: jest.fn().mockResolvedValue('Single Title'),
      waitForSelector: jest.fn(),
      waitForFunction: jest.fn(),
      goto: jest.fn(),
      click: jest.fn(),
      type: jest.fn(),
      select: jest.fn(),
      scrollTo: jest.fn(),
      screenshot: jest.fn(),
      evaluate: jest.fn(),
      waitForNavigation: jest.fn(),
    } as any;

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    const workflow = {
      version: '1.0' as const,
      actions: [
        {
          id: 'allTitles',
          action: 'extract' as const,
          target: { type: 'css' as const, value: '.card h2' },
          options: { multiple: true },
        },
      ],
    };

    const result = await service.scrapeAllWithWorkflow(
      'https://example.com',
      workflow,
    );

    expect(result.success).toBe(true);
    expect(result.data.allTitles).toEqual(['Title 1', 'Title 2']);
  });

  it('should execute workflow with single element extraction', async () => {
    const mockPage = createMockPage();
    mockPage.$eval.mockResolvedValue('Single Title');
    mockPage.$.mockResolvedValue({
      evaluate: jest.fn().mockResolvedValue('Single Title'),
    } as any);

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    const workflow = {
      version: '1.0' as const,
      actions: [
        {
          id: 'singleTitle',
          action: 'extract' as const,
          target: { type: 'css' as const, value: '.card h2' },
        },
      ],
    };

    const result = await service.scrapeAllWithWorkflow(
      'https://example.com',
      workflow,
    );

    expect(result.success).toBe(true);
    expect(result.data.singleTitle).toBe('Single Title');
  });

  it('should handle workflow with both single and multi-element extraction', async () => {
    const mockPage = createMockPage();
    mockPage.$$eval.mockResolvedValue(['Title 1', 'Title 2']);
    mockPage.$eval.mockResolvedValue('Description');
    mockPage.$.mockResolvedValue({
      evaluate: jest.fn().mockResolvedValue('Description'),
    } as any);

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    const workflow = {
      version: '1.0' as const,
      actions: [
        {
          id: 'allTitles',
          action: 'extract' as const,
          target: { type: 'css' as const, value: '.card h2' },
          options: { multiple: true },
        },
        {
          id: 'description',
          action: 'extract' as const,
          target: { type: 'css' as const, value: '.card p' },
        },
      ],
    };

    const result = await service.scrapeAllWithWorkflow(
      'https://example.com',
      workflow,
    );

    expect(result.success).toBe(true);
    expect(result.data.allTitles).toEqual(['Title 1', 'Title 2']);
    expect(result.data.description).toBe('Description');
  });

  it('should handle workflow with error handling', async () => {
    const mockPage = createMockPage();
    mockPage.$$eval.mockRejectedValue(new Error('Element not found'));

    (pageService.navigateTo as jest.Mock).mockResolvedValue(mockPage);
    (pageService.closePage as jest.Mock).mockResolvedValue(undefined);

    const workflow = {
      version: '1.0' as const,
      actions: [
        {
          id: 'nonExistent',
          action: 'extract' as const,
          target: { type: 'css' as const, value: '.non-existent' },
          options: { multiple: true },
          onError: 'continue' as const, // Action level error handling
        },
      ],
    };

    const result = await service.scrapeAllWithWorkflow(
      'https://example.com',
      workflow,
    );

    expect(result.success).toBe(true); // Should be true because action onError = 'continue'
    expect(result.errors).toEqual([]); // Errors are not collected when action continues
  });
});
