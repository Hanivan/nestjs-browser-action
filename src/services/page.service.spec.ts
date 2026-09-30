import { Test, TestingModule } from '@nestjs/testing';
import { PageService } from './page.service';
import { BrowserManagerService } from './browser-manager.service';
import { Browser, Page } from 'puppeteer-core';
import { BROWSER_ACTION_OPTIONS } from '../constants/browser-action.constants';
import type { BrowserActionOptions } from '../interfaces/browser-action-options';

describe('PageService', () => {
  let service: PageService;
  let browserManager: BrowserManagerService;
  let mockBrowser: jest.Mocked<Browser>;
  let mockPage: jest.Mocked<Page>;

  let options: BrowserActionOptions;

  beforeEach(async () => {
    options = {};
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
        { provide: BROWSER_ACTION_OPTIONS, useFactory: () => options },
        {
          provide: BrowserManagerService,
          useValue: {
            acquireBrowser: jest.fn().mockResolvedValue(mockBrowser),
            releaseBrowser: jest.fn(),
            getLogLevel: jest.fn().mockReturnValue('log' as const),
          },
        },
      ],
    }).compile();

    service = await module.resolve<PageService>(PageService);
    browserManager = module.get<BrowserManagerService>(BrowserManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a new page', async () => {
    const page = await service.createPage();
    expect(page).toBeDefined();
    expect(browserManager.acquireBrowser).toHaveBeenCalled();
  });

  it('should navigate to URL', async () => {
    await service.createPage();
    const page = await service.navigateTo('https://example.com');
    expect(mockPage.goto).toHaveBeenCalledWith(
      'https://example.com',
      undefined,
    );
  });

  describe('multiContext', () => {
    const ctxPage = { close: jest.fn() } as unknown as Page;
    let ctx: { newPage: jest.Mock; close: jest.Mock };

    beforeEach(() => {
      ctx = {
        newPage: jest.fn().mockResolvedValue(ctxPage),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (
        mockBrowser as unknown as { createBrowserContext: jest.Mock }
      ).createBrowserContext = jest.fn().mockResolvedValue(ctx);
    });

    it('opens the page in a fresh context with contextOptions', async () => {
      options.multiContext = true;
      options.contextOptions = { proxyServer: 'http://p:1' };
      const page = await service.createPage();
      expect(page).toBe(ctxPage);
      expect(
        (mockBrowser as unknown as { createBrowserContext: jest.Mock })
          .createBrowserContext,
      ).toHaveBeenCalledWith({ proxyServer: 'http://p:1' });
      expect(mockBrowser.newPage).not.toHaveBeenCalled();
    });

    it('closes the context before releasing the browser', async () => {
      options.multiContext = true;
      const order: string[] = [];
      ctx.close.mockImplementation(async () => {
        order.push('ctx.close');
      });
      (browserManager.releaseBrowser as jest.Mock).mockImplementation(() => {
        order.push('release');
      });
      await service.createPage();
      await service.closePage();
      expect(order).toEqual(['ctx.close', 'release']);
    });

    it('closes the context when newPage fails', async () => {
      options.multiContext = true;
      ctx.newPage.mockRejectedValue(new Error('boom'));
      await expect(service.createPage()).rejects.toThrow('boom');
      expect(ctx.close).toHaveBeenCalled();
      expect(browserManager.releaseBrowser).toHaveBeenCalledWith(mockBrowser);
    });

    it('uses the default context when multiContext is off', async () => {
      await service.createPage();
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(
        (mockBrowser as unknown as { createBrowserContext: jest.Mock })
          .createBrowserContext,
      ).not.toHaveBeenCalled();
    });
  });
});
