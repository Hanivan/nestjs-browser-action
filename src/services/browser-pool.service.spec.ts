import { Test, TestingModule } from '@nestjs/testing';
import { BrowserPoolService } from './browser-pool.service';
import { Browser } from 'puppeteer';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

const puppeteer = require('puppeteer');

describe('BrowserPoolService', () => {
  let service: BrowserPoolService;
  let mockBrowsers: Browser[] = [];

  beforeEach(async () => {
    // Reset mocks
    mockBrowsers = [];

    // Create mock browser factory
    puppeteer.launch.mockImplementation(async () => {
      const mockBrowser: Partial<Browser> = {
        close: jest.fn().mockResolvedValue(undefined),
        newPage: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        on: jest.fn(),
      };
      mockBrowsers.push(mockBrowser);
      return mockBrowser;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [BrowserPoolService],
    }).compile();

    service = module.get<BrowserPoolService>(BrowserPoolService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize pool with min browsers on module init', async () => {
    const launchOptions = { headless: true };
    await service.onModuleInit(launchOptions, 2, 5);

    expect(service.getPoolSize()).toBe(2);
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
  });

  it('should acquire browser from pool', async () => {
    await service.onModuleInit({ headless: true }, 2, 5);
    const browser = await service.acquire();

    expect(browser).toBeDefined();
    expect(service.getAvailableCount()).toBe(1);
  });

  it('should release browser back to pool', async () => {
    await service.onModuleInit({ headless: true }, 2, 5);
    const browser = await service.acquire();
    service.release(browser);

    expect(service.getPoolSize()).toBeGreaterThanOrEqual(2);
    expect(service.getAvailableCount()).toBe(2);
  });

  it('should close all browsers on module destroy', async () => {
    await service.onModuleInit({ headless: true }, 2, 5);

    await service.onModuleDestroy();

    expect(mockBrowsers.length).toBe(2);
    mockBrowsers.forEach((browser) => {
      expect(browser.close).toHaveBeenCalled();
    });
  });
});
