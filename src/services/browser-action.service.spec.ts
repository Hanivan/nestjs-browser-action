import { Test, TestingModule } from '@nestjs/testing';
import { BrowserActionService } from './browser-action.service';
import { PageService } from './page.service';
import { CookieService } from './cookie.service';
import { CleansingService } from './cleansing.service';
import { WorkflowDefinition } from '../interfaces/workflow-options';

describe('BrowserActionService', () => {
  let service: BrowserActionService;
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
        BrowserActionService,
        {
          provide: PageService,
          useValue: mockPageService,
        },
        {
          provide: CookieService,
          useValue: mockCookieService,
        },
        {
          provide: CleansingService,
          useValue: {},
        },
      ],
    }).compile();

    service = await module.resolve<BrowserActionService>(BrowserActionService);
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

      await service.scrapeWithWorkflow('https://example.com', workflow);

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

      await service.scrapeWithWorkflow('https://example.com', workflow);

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

      await service.scrapeWithWorkflow('https://example.com', workflow);

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

      const result = await service.scrapeWithWorkflow(
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

      await service.scrapeWithWorkflow('https://example.com', workflow);

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

      await service.scrapeWithWorkflow('https://example.com', workflow);

      expect(mockCookieService.loadCookies).toHaveBeenCalled();
    });
  });

  describe('Interaction workflow actions', () => {
    let mockElement: any;

    beforeEach(() => {
      mockElement = {
        hover: jest.fn().mockResolvedValue(undefined),
        evaluate: jest.fn().mockResolvedValue(undefined),
        click: jest.fn().mockResolvedValue(undefined),
      };
      mockPage.$ = jest.fn().mockResolvedValue(mockElement);
      mockPage.keyboard = { press: jest.fn().mockResolvedValue(undefined) };
      mockPage.waitForNetworkIdle = jest.fn().mockResolvedValue(undefined);
      mockPage.reload = jest.fn().mockResolvedValue(undefined);
    });

    it('should execute hover action', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [{ action: 'hover', target: { type: 'css', value: '#menu' } }],
      };

      await service.scrapeWithWorkflow('https://example.com', workflow);

      expect(mockPage.$).toHaveBeenCalledWith('#menu');
      expect(mockElement.hover).toHaveBeenCalled();
    });

    it('should throw on hover when element not found', async () => {
      mockPage.$.mockResolvedValue(null);

      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            action: 'hover',
            target: { type: 'css', value: '#missing' },
          },
        ],
      };

      const result = await service.scrapeWithWorkflow(
        'https://example.com',
        workflow,
      );
      expect(result.errors).toHaveLength(1);
    });

    it('should execute keyPress action', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [{ action: 'keyPress', value: 'Enter' }],
      };

      await service.scrapeWithWorkflow('https://example.com', workflow);

      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    });

    it('should execute clear action', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          { action: 'clear', target: { type: 'css', value: '#email' } },
        ],
      };

      await service.scrapeWithWorkflow('https://example.com', workflow);

      expect(mockPage.$).toHaveBeenCalledWith('#email');
      expect(mockElement.evaluate).toHaveBeenCalled();
    });

    it('should execute waitForNetwork action', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [{ action: 'waitForNetwork' }],
      };

      await service.scrapeWithWorkflow('https://example.com', workflow);

      expect(mockPage.waitForNetworkIdle).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: expect.any(Number) }),
      );
    });

    it('should execute waitForNetwork with custom timeout', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [{ action: 'waitForNetwork', options: { timeout: 5000 } }],
      };

      await service.scrapeWithWorkflow('https://example.com', workflow);

      expect(mockPage.waitForNetworkIdle).toHaveBeenCalledWith({
        timeout: 5000,
      });
    });

    it('should execute reload action', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [{ action: 'reload' }],
      };

      await service.scrapeWithWorkflow('https://example.com', workflow);

      expect(mockPage.reload).toHaveBeenCalledWith(
        expect.objectContaining({ waitUntil: 'load' }),
      );
    });

    it('should execute reload with custom waitUntil', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [{ action: 'reload', options: { waitUntil: 'networkidle0' } }],
      };

      await service.scrapeWithWorkflow('https://example.com', workflow);

      expect(mockPage.reload).toHaveBeenCalledWith(
        expect.objectContaining({ waitUntil: 'networkidle0' }),
      );
    });
  });

  describe('extract with as option', () => {
    beforeEach(() => {
      mockPage.$$eval = jest.fn();
      mockPage.$ = jest.fn();
    });

    it('should extract entire page HTML when no target', async () => {
      mockPage.content = jest
        .fn()
        .mockResolvedValue('<html><body>page</body></html>');

      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [{ id: 'pageHtml', action: 'extract' }],
      };

      const result = await service.scrapeWithWorkflow(
        'https://example.com',
        workflow,
      );

      expect(mockPage.content).toHaveBeenCalled();
      expect(result.data.pageHtml).toBe('<html><body>page</body></html>');
    });

    it('should extract innerHTML when as: html', async () => {
      const mockElement = {
        evaluate: jest.fn().mockResolvedValue('<b>hello</b>'),
      };
      mockPage.$.mockResolvedValue(mockElement);

      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            id: 'content',
            action: 'extract',
            target: { type: 'css', value: '.article' },
            options: { as: 'html' },
          },
        ],
      };

      const result = await service.scrapeWithWorkflow(
        'https://example.com',
        workflow,
      );

      expect(result.data.content).toBe('<b>hello</b>');
    });

    it('should extract outerHTML when as: outerHtml', async () => {
      const mockElement = {
        evaluate: jest
          .fn()
          .mockResolvedValue('<div class="card"><b>hi</b></div>'),
      };
      mockPage.$.mockResolvedValue(mockElement);

      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            id: 'card',
            action: 'extract',
            target: { type: 'css', value: '.card' },
            options: { as: 'outerHtml' },
          },
        ],
      };

      const result = await service.scrapeWithWorkflow(
        'https://example.com',
        workflow,
      );

      expect(result.data.card).toBe('<div class="card"><b>hi</b></div>');
    });

    it('should extract attribute when as: attribute', async () => {
      const mockElement = {
        evaluate: jest.fn().mockResolvedValue('https://example.com/page'),
      };
      mockPage.$.mockResolvedValue(mockElement);

      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            id: 'href',
            action: 'extract',
            target: { type: 'css', value: 'a.link' },
            options: { as: 'attribute', attribute: 'href' },
          },
        ],
      };

      const result = await service.scrapeWithWorkflow(
        'https://example.com',
        workflow,
      );

      expect(result.data.href).toBe('https://example.com/page');
    });
  });

  describe('action retry/retryDelay', () => {
    it('retries a failing action up to options.retry then succeeds', async () => {
      let attempts = 0;
      mockPage.evaluate = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) throw new Error('transient');
        return 'ok';
      });

      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            id: 'val',
            action: 'evaluate',
            value: 'doStuff',
            options: { retry: 2, retryDelay: 1 },
          },
        ],
      };

      const result = await service.scrapeWithWorkflow(
        'https://example.com',
        workflow,
      );

      expect(attempts).toBe(3);
      expect(result.success).toBe(true);
      expect(result.data.val).toBe('ok');
    });

    it('fails after exhausting retries', async () => {
      mockPage.evaluate = jest
        .fn()
        .mockRejectedValue(new Error('always fails'));

      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            action: 'evaluate',
            value: 'doStuff',
            options: { retry: 1, retryDelay: 1 },
          },
        ],
      };

      const result = await service.scrapeWithWorkflow(
        'https://example.com',
        workflow,
      );

      expect(mockPage.evaluate).toHaveBeenCalledTimes(2); // 1 try + 1 retry
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('navigate action options', () => {
    it('passes waitUntil/timeout to page.goto', async () => {
      const workflow: WorkflowDefinition = {
        version: '1.0',
        actions: [
          {
            action: 'navigate',
            value: 'https://example.com/page',
            options: { waitUntil: 'networkidle0', timeout: 1234 },
          },
        ],
      };

      await service.scrapeWithWorkflow('https://example.com', workflow);

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/page', {
        waitUntil: 'networkidle0',
        timeout: 1234,
      });
    });
  });

  describe('scrape @attr parsing', () => {
    it('extracts an attribute when selector has trailing @attr', async () => {
      mockPage.$eval = jest.fn().mockResolvedValue('a description');

      const result = await service.scrape('https://example.com', {
        description: 'meta[name="description"]@content',
      });

      expect(mockPage.$eval).toHaveBeenCalledWith(
        'meta[name="description"]',
        expect.any(Function),
        'content',
      );
      expect(result.description).toBe('a description');
    });
  });

  describe('per-call cloak override', () => {
    it('forwards options.cloak to navigateTo for scrape', async () => {
      mockPage.$eval = jest.fn().mockResolvedValue('x');
      const cloak = { proxy: { server: 'http://proxy:8080' } } as any;

      await service.scrape('https://example.com', { t: 'h1' }, { cloak });

      const navMock = (service as any).pageService.navigateTo as jest.Mock;
      expect(navMock).toHaveBeenCalledWith(
        'https://example.com',
        undefined,
        cloak,
      );
    });

    it('forwards workflow.cloak to navigateTo for scrapeWithWorkflow', async () => {
      const cloak = { proxy: { server: 'http://proxy:8080' } } as any;
      const workflow: WorkflowDefinition = {
        version: '1.0',
        cloak,
        actions: [],
      };

      await service.scrapeWithWorkflow('https://example.com', workflow);

      const navMock = (service as any).pageService.navigateTo as jest.Mock;
      expect(navMock).toHaveBeenCalledWith(
        'https://example.com',
        undefined,
        cloak,
      );
    });
  });

  describe('evaluate() with a function', () => {
    it('passes a function through to page.evaluate', async () => {
      const fn = () => 42;
      mockPage.evaluate = jest.fn().mockResolvedValue(42);

      const result = await service.evaluate('https://example.com', fn);

      expect(mockPage.evaluate).toHaveBeenCalledWith(fn);
      expect(result).toBe(42);
    });
  });
});
