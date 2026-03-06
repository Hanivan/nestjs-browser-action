import { Test, TestingModule } from '@nestjs/testing';
import { PageService } from './page-service';
import { BrowserManagerService } from './browser-manager.service';
import { Browser, Page } from 'puppeteer';

describe('PageService', () => {
  let service: PageService;
  let browserManager: BrowserManagerService;
  let mockBrowser: jest.Mocked<Browser>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(async () => {
    mockPage = {
      goto: jest.fn(),
      close: jest.fn(),
      screenshot: jest.fn(),
      pdf: jest.fn(),
    } as any;

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PageService,
        {
          provide: BrowserManagerService,
          useValue: {
            getBrowser: jest.fn().mockResolvedValue(mockBrowser),
            releaseBrowser: jest.fn(),
            getLogLevel: jest.fn().mockReturnValue('log' as const),
          },
        },
      ],
    }).compile();

    service = module.get<PageService>(PageService);
    browserManager = module.get<BrowserManagerService>(BrowserManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a new page', async () => {
    const page = await service.createPage();
    expect(page).toBeDefined();
    expect(browserManager.getBrowser).toHaveBeenCalled();
  });

  it('should navigate to URL', async () => {
    await service.createPage();
    const page = await service.navigateTo('https://example.com');
    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://example.com',
      undefined,
    );
  });
});
