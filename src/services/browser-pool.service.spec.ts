import { Test, TestingModule } from '@nestjs/testing';
import { BrowserPoolService } from './browser-pool.service';
import { Browser } from 'puppeteer';
import { BROWSER_ACTION_OPTIONS } from '../constants/browser-action.constants';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
  connect: jest.fn(),
}));

const puppeteer = require('puppeteer');

describe('BrowserPoolService', () => {
  let service: BrowserPoolService;
  let mockBrowsers: Browser[] = [];

  const mockOptions = {
    launchOptions: { headless: true },
    pool: { min: 2, max: 5 },
    logLevel: 'log' as const,
  };

  beforeEach(async () => {
    // Reset mocks
    mockBrowsers = [];

    // Create mock browser factory
    puppeteer.launch.mockImplementation(async () => {
      const mockBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        newPage: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        on: jest.fn(),
        off: jest.fn(),
      } as unknown as Browser;
      mockBrowsers.push(mockBrowser);
      return mockBrowser;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserPoolService,
        {
          provide: BROWSER_ACTION_OPTIONS,
          useValue: mockOptions,
        },
      ],
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
    await service.onModuleInit();

    expect(service.getPoolSize()).toBe(2);
    expect(puppeteer.launch).toHaveBeenCalledTimes(2);
  });

  it('should acquire browser from pool', async () => {
    await service.onModuleInit();
    const browser = await service.acquire();

    expect(browser).toBeDefined();
    expect(service.getAvailableCount()).toBe(1);
  });

  it('should release browser back to pool', async () => {
    await service.onModuleInit();
    const browser = await service.acquire();
    service.release(browser);

    expect(service.getPoolSize()).toBeGreaterThanOrEqual(2);
    expect(service.getAvailableCount()).toBe(2);
  });

  it('should close all browsers on module destroy', async () => {
    await service.onModuleInit();

    await service.onModuleDestroy();

    expect(mockBrowsers.length).toBe(2);
    mockBrowsers.forEach((browser) => {
      expect(browser.close).toHaveBeenCalled();
    });
  });

  it('should use local launch when remote options are not provided (backward compatibility)', async () => {
    const localOnlyOptions = {
      ...mockOptions,
      launchOptions: {
        headless: true,
        args: ['--no-sandbox'],
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserPoolService,
        {
          provide: BROWSER_ACTION_OPTIONS,
          useValue: localOnlyOptions,
        },
      ],
    }).compile();

    const service = module.get<BrowserPoolService>(BrowserPoolService);
    await service.onModuleInit();

    expect(puppeteer.launch).toHaveBeenCalledWith({
      headless: true,
      args: ['--no-sandbox'],
    });
    expect(puppeteer.launch).toHaveBeenCalledTimes(2); // min: 2 browsers
    expect(puppeteer.connect).not.toHaveBeenCalled();
  });

  describe('Remote connection validation', () => {
    it('should throw if both browserURL and browserWSEndpoint are provided', async () => {
      const invalidOptions = {
        ...mockOptions,
        remote: {
          browserURL: 'http://localhost:9222',
          browserWSEndpoint: 'ws://localhost:9222/devtools/page/123',
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BrowserPoolService,
          {
            provide: BROWSER_ACTION_OPTIONS,
            useValue: invalidOptions,
          },
        ],
      }).compile();

      const invalidService = module.get<BrowserPoolService>(BrowserPoolService);

      await expect(invalidService.onModuleInit()).rejects.toThrow(
        'Exactly one of browserURL or browserWSEndpoint must be provided',
      );
    });

    it('should throw if neither browserURL nor browserWSEndpoint is provided when remote is set', async () => {
      const invalidOptions = {
        ...mockOptions,
        remote: {},
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BrowserPoolService,
          {
            provide: BROWSER_ACTION_OPTIONS,
            useValue: invalidOptions,
          },
        ],
      }).compile();

      const invalidService = module.get<BrowserPoolService>(BrowserPoolService);

      await expect(invalidService.onModuleInit()).rejects.toThrow(
        'Exactly one of browserURL or browserWSEndpoint must be provided',
      );
    });
  });

  describe('Remote connection with retry', () => {
    beforeEach(() => {
      // Mock puppeteer.connect
      puppeteer.connect = jest.fn();
    });

    it('should connect on first attempt', async () => {
      const mockBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(true),
        on: jest.fn(),
      } as unknown as Browser;
      (puppeteer.connect as jest.Mock).mockResolvedValue(mockBrowser);

      const remoteOptions = {
        ...mockOptions,
        remote: {
          browserURL: 'http://localhost:9222',
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BrowserPoolService,
          {
            provide: BROWSER_ACTION_OPTIONS,
            useValue: remoteOptions,
          },
        ],
      }).compile();

      const remoteService = module.get<BrowserPoolService>(BrowserPoolService);
      await remoteService.onModuleInit();

      expect(puppeteer.connect).toHaveBeenCalledTimes(2); // min: 2 browsers
      expect(puppeteer.connect).toHaveBeenCalledWith({
        browserURL: 'http://localhost:9222',
      });
    });

    it('should retry on connection failure', async () => {
      let attempts = 0;
      (puppeteer.connect as jest.Mock).mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Connection refused');
        }
        const mockBrowser = {
          close: jest.fn().mockResolvedValue(undefined),
          isConnected: jest.fn().mockReturnValue(true),
          on: jest.fn(),
        } as unknown as Browser;
        return mockBrowser;
      });

      const remoteOptions = {
        ...mockOptions,
        remote: {
          browserURL: 'http://localhost:9222',
          retryMax: 3,
          retryDelay: 100,
        },
        pool: { min: 1, max: 5 },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BrowserPoolService,
          {
            provide: BROWSER_ACTION_OPTIONS,
            useValue: remoteOptions,
          },
        ],
      }).compile();

      const remoteService = module.get<BrowserPoolService>(BrowserPoolService);
      await remoteService.onModuleInit();

      expect(attempts).toBe(3);
      expect(remoteService.getPoolSize()).toBe(1);
    });

    it('should fail after max retries', async () => {
      (puppeteer.connect as jest.Mock).mockRejectedValue(
        new Error('Connection refused'),
      );

      const remoteOptions = {
        ...mockOptions,
        remote: {
          browserURL: 'http://localhost:9222',
          retryMax: 2,
          retryDelay: 50,
        },
        pool: { min: 1, max: 5 },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BrowserPoolService,
          {
            provide: BROWSER_ACTION_OPTIONS,
            useValue: remoteOptions,
          },
        ],
      }).compile();

      const remoteService = module.get<BrowserPoolService>(BrowserPoolService);

      await expect(remoteService.onModuleInit()).rejects.toThrow(
        'Failed to connect to remote Chrome after 2 attempts',
      );
    });

    it('should use remote connection when both remote and launchOptions are provided', async () => {
      const mockBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(true),
        on: jest.fn(),
      } as unknown as Browser;

      puppeteer.connect = jest.fn().mockResolvedValue(mockBrowser);

      const bothOptions = {
        ...mockOptions,
        remote: {
          browserURL: 'http://localhost:9222',
        },
        launchOptions: {
          headless: true,
        },
        pool: { min: 1, max: 5 },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BrowserPoolService,
          {
            provide: BROWSER_ACTION_OPTIONS,
            useValue: bothOptions,
          },
        ],
      }).compile();

      const service = module.get<BrowserPoolService>(BrowserPoolService);
      await service.onModuleInit();

      // Should use connect, not launch
      expect(puppeteer.connect).toHaveBeenCalled();
      expect(puppeteer.launch).not.toHaveBeenCalled();
    });

    it('should connect using browserWSEndpoint when provided', async () => {
      const mockBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(true),
        on: jest.fn(),
      } as unknown as Browser;

      puppeteer.connect = jest.fn().mockResolvedValue(mockBrowser);

      const wsOptions = {
        ...mockOptions,
        remote: {
          browserWSEndpoint: 'ws://localhost:9222/devtools/page/abc123',
        },
        pool: { min: 1, max: 5 },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BrowserPoolService,
          {
            provide: BROWSER_ACTION_OPTIONS,
            useValue: wsOptions,
          },
        ],
      }).compile();

      const service = module.get<BrowserPoolService>(BrowserPoolService);
      await service.onModuleInit();

      expect(puppeteer.connect).toHaveBeenCalledWith({
        browserWSEndpoint: 'ws://localhost:9222/devtools/page/abc123',
      });
    });
  });
});
