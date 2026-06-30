import { Test, TestingModule } from '@nestjs/testing';
import { BrowserPoolService } from './browser-pool.service';
import { Browser } from 'puppeteer-core';
import { BROWSER_ACTION_OPTIONS } from '../constants/browser-action.constants';

// Mock the loader so the real ESM-only cloakbrowser import never runs in tests;
// remote CDP goes through puppeteer-core.
const mockCloak = {
  launch: jest.fn(),
  launchPersistentContext: jest.fn(),
};
jest.mock('../utils/cloak.loader', () => ({
  loadCloakPuppeteer: () => Promise.resolve(mockCloak),
}));
jest.mock('puppeteer-core', () => ({
  connect: jest.fn(),
}));

const puppeteerCore = require('puppeteer-core');

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
    mockCloak.launch.mockImplementation(async () => {
      const mockBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        newPage: jest.fn(),
        connected: true,
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

  it('evicts a disconnected browser from available pool on acquire and returns a healthy one', async () => {
    await service.onModuleInit(); // 2 browsers in pool (min: 2)

    const b1 = await service.acquire();
    const b2 = await service.acquire();

    // Simulate b1 disconnecting mid-flight (Chrome crash) before release
    (b1 as any).connected = false;
    service.release(b1);
    service.release(b2);

    // acquire() must skip the dead b1, evict it, and return the healthy b2
    const acquired = await service.acquire();
    expect(acquired).toBe(b2);
    expect(service.getAvailableCount()).toBe(0); // b2 is now in use
  });

  it('should initialize pool with min browsers on module init', async () => {
    await service.onModuleInit();

    expect(service.getPoolSize()).toBe(2);
    expect(mockCloak.launch).toHaveBeenCalledTimes(2);
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

    // launchOptions is forwarded to CloakBrowser's launchOptions passthrough,
    // and headless is also lifted to the top level CloakBrowser reads.
    expect(mockCloak.launch).toHaveBeenCalledWith({
      headless: true,
      launchOptions: {
        headless: true,
        args: ['--no-sandbox'],
      },
    });
    expect(mockCloak.launch).toHaveBeenCalledTimes(2); // min: 2 browsers
    expect(puppeteerCore.connect).not.toHaveBeenCalled();
  });

  it('should lift launchOptions.headless=false to the top level so headful launches work', async () => {
    const headfulOptions = {
      ...mockOptions,
      launchOptions: {
        headless: false,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserPoolService,
        {
          provide: BROWSER_ACTION_OPTIONS,
          useValue: headfulOptions,
        },
      ],
    }).compile();

    const service = module.get<BrowserPoolService>(BrowserPoolService);
    await service.onModuleInit();

    expect(mockCloak.launch).toHaveBeenCalledWith({
      headless: false,
      launchOptions: {
        headless: false,
      },
    });
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
      // Mock puppeteerCore.connect
      puppeteerCore.connect = jest.fn();
    });

    it('should connect on first attempt', async () => {
      const mockBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        connected: true,
        on: jest.fn(),
      } as unknown as Browser;
      (puppeteerCore.connect as jest.Mock).mockResolvedValue(mockBrowser);

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

      expect(puppeteerCore.connect).toHaveBeenCalledTimes(2); // min: 2 browsers
      expect(puppeteerCore.connect).toHaveBeenCalledWith({
        browserURL: 'http://localhost:9222',
      });
    });

    it('should retry on connection failure', async () => {
      let attempts = 0;
      (puppeteerCore.connect as jest.Mock).mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Connection refused');
        }
        const mockBrowser = {
          close: jest.fn().mockResolvedValue(undefined),
          connected: true,
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
      (puppeteerCore.connect as jest.Mock).mockRejectedValue(
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
        connected: true,
        on: jest.fn(),
      } as unknown as Browser;

      puppeteerCore.connect = jest.fn().mockResolvedValue(mockBrowser);

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
      expect(puppeteerCore.connect).toHaveBeenCalled();
      expect(mockCloak.launch).not.toHaveBeenCalled();
    });

    it('should connect using browserWSEndpoint when provided', async () => {
      const mockBrowser = {
        close: jest.fn().mockResolvedValue(undefined),
        connected: true,
        on: jest.fn(),
      } as unknown as Browser;

      puppeteerCore.connect = jest.fn().mockResolvedValue(mockBrowser);

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

      expect(puppeteerCore.connect).toHaveBeenCalledWith({
        browserWSEndpoint: 'ws://localhost:9222/devtools/page/abc123',
      });
    });
  });
});

function createEmitterBrowser(): Browser & { emit: (evt: string) => void } {
  const handlers: Record<string, () => void> = {};
  return {
    connected: true,
    close: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    newPage: jest.fn(),
    on: jest.fn((evt: string, cb: () => void) => {
      handlers[evt] = cb;
    }),
    off: jest.fn((evt: string) => {
      delete handlers[evt];
    }),
    emit: (evt: string) => handlers[evt]?.(),
  } as unknown as Browser & { emit: (evt: string) => void };
}

describe('BrowserPoolService robustness', () => {
  let created: Array<Browser & { emit: (evt: string) => void }>;

  beforeEach(() => {
    created = [];
    mockCloak.launch.mockImplementation(async () => {
      const b = createEmitterBrowser();
      created.push(b);
      return b;
    });
  });

  afterEach(() => jest.clearAllMocks());

  async function makeService(
    pool: Record<string, unknown>,
  ): Promise<BrowserPoolService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserPoolService,
        {
          provide: BROWSER_ACTION_OPTIONS,
          useValue: { logLevel: 'warn' as const, pool },
        },
      ],
    }).compile();
    const svc = module.get<BrowserPoolService>(BrowserPoolService);
    await svc.onModuleInit();
    return svc;
  }

  it('never hands out undefined to concurrent waiters (acquire race)', async () => {
    const svc = await makeService({ min: 1, max: 1 });
    const first = await svc.acquire();
    expect(first).toBeDefined();

    // Two waiters queued while pool is exhausted
    const p1 = svc.acquire();
    const p2 = svc.acquire();

    svc.release(first);
    const a = await p1;
    expect(a).toBeDefined();

    svc.release(a);
    const b = await p2;
    expect(b).toBeDefined();

    await svc.onModuleDestroy();
  });

  it('evicts disconnected browser and recreates to keep min', async () => {
    const svc = await makeService({ min: 2, max: 4 });
    expect(svc.getPoolSize()).toBe(2);

    const dead = created[0];
    dead.emit('disconnected');
    await new Promise((r) => setTimeout(r, 10));

    expect(svc.getPoolSize()).toBe(2); // recreated back to min
    // The dead browser must not be in the pool anymore
    const handed: Browser[] = [];
    handed.push(await svc.acquire());
    handed.push(await svc.acquire());
    expect(handed).not.toContain(dead);

    await svc.onModuleDestroy();
  });

  it('rejects acquire after acquireTimeoutMs when pool exhausted', async () => {
    const svc = await makeService({ min: 1, max: 1, acquireTimeoutMs: 80 });
    const held = await svc.acquire();
    expect(held).toBeDefined();

    await expect(svc.acquire()).rejects.toThrow(/Timed out acquiring browser/);

    await svc.onModuleDestroy();
  });

  it('createDedicatedBrowser launches off-pool and is not pooled', async () => {
    const svc = await makeService({ min: 1, max: 2 });
    const sizeBefore = svc.getPoolSize();

    const dedicated = await svc.createDedicatedBrowser({
      proxy: { server: 'http://proxy:8080' },
    } as never);

    expect(dedicated).toBeDefined();
    expect(svc.getPoolSize()).toBe(sizeBefore); // not added to pool

    await svc.destroyDedicatedBrowser(dedicated);
    expect(dedicated.close).toHaveBeenCalled();

    await svc.onModuleDestroy();
  });

  it('createDedicatedBrowser rejects in remote CDP mode', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserPoolService,
        {
          provide: BROWSER_ACTION_OPTIONS,
          useValue: {
            logLevel: 'warn' as const,
            pool: { min: 1, max: 1 },
            remote: { browserURL: 'http://localhost:9222' },
          },
        },
      ],
    }).compile();
    const svc = module.get<BrowserPoolService>(BrowserPoolService);
    (puppeteerCore.connect as jest.Mock) = jest
      .fn()
      .mockResolvedValue(createEmitterBrowser());
    await svc.onModuleInit();

    await expect(svc.createDedicatedBrowser()).rejects.toThrow(
      /not supported in remote/,
    );

    await svc.onModuleDestroy();
  });

  it('reaps idle browsers down to min after idleTimeoutMs', async () => {
    const svc = await makeService({ min: 1, max: 3, idleTimeoutMs: 50 });
    // grow to 3
    const b1 = await svc.acquire();
    const b2 = await svc.acquire();
    const b3 = await svc.acquire();
    svc.release(b1);
    svc.release(b2);
    svc.release(b3);
    expect(svc.getPoolSize()).toBe(3);

    await new Promise((r) => setTimeout(r, 140));

    expect(svc.getPoolSize()).toBe(1); // reaped down to min

    await svc.onModuleDestroy();
  });
});
