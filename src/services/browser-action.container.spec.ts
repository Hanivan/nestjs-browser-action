import { BrowserActionService } from './browser-action.service';
import { PageService } from './page.service';
import { CookieService } from './cookie.service';
import { CleansingService } from './cleansing.service';
import { ContainerDescriptor } from '../interfaces/types';

const mockPage = {
  evaluate: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockPageService = {
  navigateTo: jest.fn().mockResolvedValue(mockPage),
  closePage: jest.fn().mockResolvedValue(undefined),
  getLogLevel: jest.fn().mockReturnValue('log'),
} as unknown as PageService;

const mockCookieService = {} as CookieService;
const mockCleansingService = {
  buildPipes: jest.fn().mockReturnValue([]),
  cleanse: jest.fn((v) => v),
} as unknown as CleansingService;

// resolve() hands back the same mock page service so navigateTo/closePage
// assertions still observe the calls the service makes per-invocation.
const mockModuleRef = {
  resolve: jest.fn().mockResolvedValue(mockPageService),
} as unknown as import('@nestjs/core').ModuleRef;

describe('BrowserActionService.scrapeContainerFields', () => {
  let service: BrowserActionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BrowserActionService(
      mockPageService,
      mockCookieService,
      mockCleansingService,
      mockModuleRef,
    );
  });

  it('returns extracted items from container nodes', async () => {
    mockPage.evaluate.mockResolvedValue([
      { title: 'Thread A', link: '/a', replies: '5' },
      { title: 'Thread B', link: '/b', replies: '10' },
    ]);

    const descriptor: ContainerDescriptor = {
      container: '//div[@class="thread"]',
      fields: {
        title: { selector: './/a[@class="title"]' },
        link: { selector: './/a[@class="title"]', attribute: 'href' },
        replies: { selector: './/span[@class="replies"]' },
      },
    };

    const result = await service.scrapeContainerFields(
      'https://example.com',
      descriptor,
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      title: 'Thread A',
      link: '/a',
      replies: '5',
    });
    expect(result.pagination).toBeUndefined();
  });

  it('includes pagination result when pagination descriptor is provided', async () => {
    // First evaluate call: container items; second: pagination
    mockPage.evaluate
      .mockResolvedValueOnce([{ title: 'Thread A' }])
      .mockResolvedValueOnce([
        { label: '1', url: 'https://example.com/page/1' },
        { label: '2', url: 'https://example.com/page/2' },
        { label: '3', url: 'https://example.com/page/3' },
      ]);

    const descriptor: ContainerDescriptor = {
      container: '//div[@class="thread"]',
      fields: { title: { selector: './/a' } },
      pagination: {
        container: '//ul[@class="pages"]',
        linkSelector: './/a',
        labelSelector: './/a',
      },
    };

    const result = await service.scrapeContainerFields(
      'https://example.com',
      descriptor,
      {
        currentPage: 1,
      },
    );

    expect(result.pagination).toBeDefined();
    expect(result.pagination!.nextUrl).toBe('https://example.com/page/2');
    expect(result.pagination!.pages).toHaveLength(3);
  });

  it('returns empty items array when no container nodes found', async () => {
    mockPage.evaluate.mockResolvedValue([]);

    const result = await service.scrapeContainerFields('https://example.com', {
      container: '//div[@class="missing"]',
      fields: { title: { selector: './/a' } },
    });

    expect(result.items).toEqual([]);
  });

  it('applies CleanerStepRules pipes to extracted field values', async () => {
    // scrapeContainerFields uses PipeEngine.apply() directly — no CleansingService needed
    mockPage.evaluate.mockResolvedValue([{ title: '  hello  ' }]);

    const result = await service.scrapeContainerFields(
      'https://example.com',
      { container: '//div', fields: { title: { selector: './/a' } } },
      { pipes: { title: { trim: true } } },
    );

    expect(result.items[0]).toEqual({ title: 'hello' });
  });
});
