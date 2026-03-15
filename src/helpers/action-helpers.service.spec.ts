import { Test, TestingModule } from '@nestjs/testing';
import { ActionHelpersService } from './action-helpers.service';
import { PageService } from '../services/page-service';
import { CookieService } from '../services/cookie.service';
import { WorkflowDefinition } from '../interfaces/workflow-options';

describe('ActionHelpersService', () => {
  let service: ActionHelpersService;
  let mockPage: any;

  beforeEach(async () => {
    mockPage = {
      goto: jest.fn(),
      screenshot: jest.fn(),
      pdf: jest.fn(),
      $eval: jest.fn(),
      close: jest.fn(),
      waitForSelector: jest.fn(),
      evaluate: jest.fn(),
    } as any;

    const mockPageService = {
      createPage: jest.fn().mockResolvedValue(mockPage),
      closePage: jest.fn().mockResolvedValue(undefined),
      navigateTo: jest.fn().mockImplementation(async (url: string) => {
        await mockPage.goto(url);
        return mockPage;
      }),
      getLogLevel: jest.fn().mockReturnValue('log' as const),
    };

    const mockCookieService = {
      saveCookies: jest.fn(),
      loadCookies: jest.fn(),
      deleteCookies: jest.fn(),
      listCookies: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionHelpersService,
        {
          provide: PageService,
          useValue: mockPageService,
        },
        {
          provide: CookieService,
          useValue: mockCookieService,
        },
      ],
    }).compile();

    service = module.get<ActionHelpersService>(ActionHelpersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should take screenshot', async () => {
    mockPage.screenshot.mockResolvedValue(Buffer.from('fake screenshot'));

    const result = await service.takeScreenshot(
      'https://example.com',
      '/tmp/test.png',
    );

    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com');
    expect(mockPage.screenshot).toHaveBeenCalledWith({ path: '/tmp/test.png' });
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should generate PDF', async () => {
    mockPage.pdf.mockResolvedValue(Buffer.from('fake pdf'));

    await service.generatePDF('https://example.com', '/tmp/test.pdf');

    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com');
    expect(mockPage.pdf).toHaveBeenCalledWith({ path: '/tmp/test.pdf' });
  });

  it('should scrape data', async () => {
    mockPage.$eval.mockResolvedValue('test content');

    const result = await service.scrape('https://example.com', { title: 'h1' });

    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com');
    expect(result).toEqual({ title: 'test content' });
  });

  describe('Cookie workflow actions', () => {
    let mockCookieService: any;

    beforeEach(() => {
      mockCookieService = {
        saveCookies: jest.fn(),
        loadCookies: jest.fn(),
        deleteCookies: jest.fn(),
        listCookies: jest.fn(),
      };
      (service as any).cookieService = mockCookieService;
    });

    it('should execute saveCookies action', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            action: 'saveCookies',
            value: 'test-session',
            options: { overwrite: true },
          },
        ],
      };

      await service.scrapeWithActions('https://example.com', workflow);

      expect(mockCookieService.saveCookies).toHaveBeenCalledWith(
        expect.any(Object),
        'test-session',
        expect.objectContaining({ overwrite: true }),
      );
    });

    it('should execute loadCookies action', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            action: 'loadCookies',
            value: 'test-session',
          },
        ],
      };

      await service.scrapeWithActions('https://example.com', workflow);

      expect(mockCookieService.loadCookies).toHaveBeenCalledWith(
        expect.any(Object),
        'test-session',
        expect.any(Object),
      );
    });

    it('should execute clearCookies action', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            action: 'clearCookies',
            value: 'test-session',
          },
        ],
      };

      await service.scrapeWithActions('https://example.com', workflow);

      expect(mockCookieService.deleteCookies).toHaveBeenCalledWith(
        'test-session',
      );
    });

    it('should execute listCookies action and store result in context', async () => {
      const mockSessions = [
        { name: 'session1', savedAt: new Date(), cookieCount: 3 },
        { name: 'session2', savedAt: new Date(), cookieCount: 5 },
      ];
      mockCookieService.listCookies.mockResolvedValue(mockSessions);

      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            id: 'allSessions',
            action: 'listCookies',
          },
        ],
      };

      const result = await service.scrapeWithActions(
        'https://example.com',
        workflow,
      );

      expect(result.data.allSessions).toEqual(mockSessions);
    });

    it('should handle saveCookies with metadata', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            action: 'saveCookies',
            value: 'test-session',
            options: {
              metadata: {
                username: 'test@example.com',
                loginMethod: 'email',
              },
            },
          },
        ],
      };

      await service.scrapeWithActions('https://example.com', workflow);

      expect(mockCookieService.saveCookies).toHaveBeenCalledWith(
        expect.any(Object),
        'test-session',
        expect.objectContaining({
          metadata: {
            username: 'test@example.com',
            loginMethod: 'email',
          },
        }),
      );
    });

    it('should skip loadCookies on error when onError: skip', async () => {
      mockCookieService.loadCookies.mockRejectedValue(
        new Error('Session not found'),
      );

      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            action: 'loadCookies',
            value: 'nonexistent',
            onError: 'skip',
          },
        ],
      };

      await service.scrapeWithActions('https://example.com', workflow);

      expect(mockCookieService.loadCookies).toHaveBeenCalled();
    });
  });
});
