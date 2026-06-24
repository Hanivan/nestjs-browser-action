import { BrowserActionService } from './browser-action.service';
import { PageService } from './page.service';
import { CookieService } from './cookie.service';
import { CleansingService } from './cleansing.service';

const mockPage = {
  $eval: jest.fn().mockResolvedValue('value'),
  $$eval: jest.fn().mockResolvedValue(['value']),
  evaluate: jest.fn().mockResolvedValue('value'),
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

describe('BrowserActionService scrape options passthrough', () => {
  let service: BrowserActionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BrowserActionService(
      mockPageService,
      mockCookieService,
      mockCleansingService,
    );
  });

  it('passes interceptResource option to navigateTo in scrape()', async () => {
    await service.scrape(
      'https://example.com',
      { title: 'h1' },
      { interceptResource: true },
    );
    expect(mockPageService.navigateTo).toHaveBeenCalledWith(
      'https://example.com',
      undefined,
      undefined,
      true,
    );
  });

  it('passes useRandomUserAgent: sets a userAgent in cloak', async () => {
    await service.scrape(
      'https://example.com',
      { title: 'h1' },
      { useRandomUserAgent: true },
    );
    const call = (mockPageService.navigateTo as jest.Mock).mock.calls[0];
    const cloak = call[2];
    expect(cloak).toBeDefined();
    expect(typeof cloak.userAgent).toBe('string');
    expect(cloak.userAgent).toContain('Chrome');
  });
});
