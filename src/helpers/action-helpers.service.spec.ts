import { Test, TestingModule } from '@nestjs/testing';
import { ActionHelpersService } from './action-helpers.service';
import { PageService } from '../services/page-service';
import { Page } from 'puppeteer';

describe('ActionHelpersService', () => {
  let service: ActionHelpersService;
  let mockPage: jest.Mocked<Page>;

  beforeEach(async () => {
    mockPage = {
      goto: jest.fn(),
      screenshot: jest.fn(),
      pdf: jest.fn(),
      $eval: jest.fn(),
      close: jest.fn(),
      waitForSelector: jest.fn(),
      evaluate: jest.fn(),
    } as jest.Mocked<Page>;

    const mockPageService = {
      createPage: jest.fn().mockResolvedValue(mockPage),
      closePage: jest.fn().mockResolvedValue(undefined),
      navigateTo: jest.fn().mockImplementation(async (url: string) => {
        await mockPage.goto(url);
        return mockPage;
      }),
      getLogLevel: jest.fn().mockReturnValue('log' as const),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionHelpersService,
        {
          provide: PageService,
          useValue: mockPageService,
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
});
