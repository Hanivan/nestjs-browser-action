import { Test, TestingModule } from '@nestjs/testing';
import { BrowserManagerService } from './browser-manager.service';
import { BrowserPoolService } from './browser-pool.service';
import { Browser } from 'puppeteer-core';

describe('BrowserManagerService', () => {
  let service: BrowserManagerService;
  let poolService: BrowserPoolService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserManagerService,
        {
          provide: BrowserPoolService,
          useValue: {
            acquire: jest.fn(),
            release: jest.fn(),
            onModuleInit: jest.fn(),
            onModuleDestroy: jest.fn(),
            getLogLevel: jest.fn().mockReturnValue('log' as const),
            getPoolSize: jest.fn().mockReturnValue(0),
            getAvailableCount: jest.fn().mockReturnValue(0),
          },
        },
      ],
    }).compile();

    service = module.get<BrowserManagerService>(BrowserManagerService);
    poolService = module.get<BrowserPoolService>(BrowserPoolService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should acquire browser from pool', async () => {
    const mockBrowser: Partial<Browser> = {};
    (poolService.acquire as jest.Mock).mockResolvedValue(mockBrowser);

    const browser = await service.acquireBrowser();
    expect(browser).toBe(mockBrowser);
    expect(poolService.acquire).toHaveBeenCalled();
  });

  it('should release browser back to pool', async () => {
    const mockBrowser: Partial<Browser> = {};
    service.releaseBrowser(mockBrowser as Browser);

    expect(poolService.release).toHaveBeenCalledWith(mockBrowser);
  });
});
