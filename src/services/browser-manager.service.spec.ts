import { Test, TestingModule } from '@nestjs/testing';
import { BrowserManagerService } from './browser-manager.service';
import { BrowserPoolService } from './browser-pool.service';

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
    const mockBrowser = {} as any;
    (poolService.acquire as jest.Mock).mockResolvedValue(mockBrowser);

    const browser = await service.getBrowser();
    expect(browser).toBe(mockBrowser);
    expect(poolService.acquire).toHaveBeenCalled();
  });

  it('should release browser back to pool', async () => {
    const mockBrowser = {} as any;
    service.releaseBrowser(mockBrowser);

    expect(poolService.release).toHaveBeenCalledWith(mockBrowser);
  });
});
