import { PageController } from './page-controller';
import { PageSession } from './page-session';
import { LoggerWithLevel } from '../utils/logger.util';
import {
  ExtractionOperator,
  CaptureOperator,
  ContainerOperator,
  WorkflowOperator,
  PaginationOperator,
} from '../operators';
import type { Page } from 'puppeteer-core';
import type { WorkflowDefinition } from '../interfaces/workflow-options';

const logger = new LoggerWithLevel('test', 'error');

function mockPage(): Page {
  return {
    isClosed: jest.fn().mockReturnValue(false),
    close: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn().mockResolvedValue(null),
    setRequestInterception: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    $eval: jest.fn(),
    $$eval: jest.fn(),
    evaluate: jest.fn(),
    url: jest.fn().mockReturnValue('https://current.test'),
  } as unknown as Page;
}

function buildController(page: Page, debugLogMaxLength?: number) {
  const session = {
    ensureAlive: jest.fn().mockResolvedValue(page),
    goto: jest.fn().mockResolvedValue(page),
    setInterception: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    page,
    browser: {},
  } as unknown as PageSession;

  const extraction = {
    extractSingle: jest.fn().mockResolvedValue({ title: 'x' }),
    validateSelector: jest.fn(),
    parseSelector: jest.fn().mockReturnValue({ selector: '.x' }),
    extractAllData: jest.fn(),
    extractData: jest.fn(),
    setDebugLogMaxLength: jest.fn(),
  } as unknown as ExtractionOperator;

  const container = {
    executeContainerExtraction: jest
      .fn()
      .mockResolvedValue({ items: [], pagination: undefined }),
    resolvePagination: jest.fn(),
    setDebugLogMaxLength: jest.fn(),
  } as unknown as ContainerOperator;

  const workflow = {
    executeAction: jest.fn().mockResolvedValue(undefined),
    evaluateCondition: jest.fn(),
    setDebugLogMaxLength: jest.fn(),
  } as unknown as WorkflowOperator;

  const pagination = {
    paginateClickNext: jest.fn(),
    paginateLoadMore: jest.fn(),
    paginateInfiniteScroll: jest.fn(),
    paginateUrlIncrement: jest.fn(),
    setDebugLogMaxLength: jest.fn(),
  } as unknown as PaginationOperator;

  const capture = {
    screenshot: jest.fn().mockResolvedValue(Buffer.from('')),
    pdf: jest.fn().mockResolvedValue(Buffer.from('')),
    tlsFingerprint: jest.fn(),
    setDebugLogMaxLength: jest.fn(),
  } as unknown as CaptureOperator;

  const controller = new PageController(
    session,
    extraction,
    container,
    workflow,
    pagination,
    capture,
    logger,
    debugLogMaxLength,
  );

  return {
    controller,
    session,
    extraction,
    container,
    workflow,
    pagination,
    capture,
  };
}

describe('PageController', () => {
  it('scrape: ensureAlive -> goto -> extractSingle, page not closed', async () => {
    const page = mockPage();
    const { controller, session, extraction } = buildController(page);

    const result = await controller.scrape(
      'https://x.test',
      { title: '.title' },
      { pipes: { title: { trim: true } } },
    );

    expect(session.ensureAlive).toHaveBeenCalled();
    expect(session.goto).toHaveBeenCalledWith('https://x.test', undefined);
    expect(extraction.extractSingle).toHaveBeenCalledWith(
      page,
      'https://x.test',
      { title: '.title' },
      { title: { trim: true } },
    );
    expect(page.close).not.toHaveBeenCalled();
    expect(result).toEqual({ title: 'x' });
  });

  it('extract: skips goto entirely, uses current page', async () => {
    const page = mockPage();
    const { controller, session, extraction } = buildController(page);

    await controller.extract({ title: '.title' });

    expect(session.ensureAlive).toHaveBeenCalled();
    expect(session.goto).not.toHaveBeenCalled();
    expect(extraction.extractSingle).toHaveBeenCalled();
  });

  it('goto: delegates to session', async () => {
    const page = mockPage();
    const { controller, session } = buildController(page);

    await controller.goto('https://x.test', { timeout: 1000 });

    expect(session.goto).toHaveBeenCalledWith('https://x.test', {
      timeout: 1000,
    });
  });

  it('scrapeWithWorkflow: rejects invalid workflow before touching session', async () => {
    const page = mockPage();
    const { controller, session } = buildController(page);

    const invalidWorkflow = {
      actions: 'not-an-array',
    } as unknown as WorkflowDefinition;

    await expect(
      controller.scrapeWithWorkflow('https://x.test', invalidWorkflow),
    ).rejects.toThrow();
    expect(session.ensureAlive).not.toHaveBeenCalled();
  });

  it('close: delegates to session', async () => {
    const page = mockPage();
    const { controller, session } = buildController(page);

    await controller.close();

    expect(session.close).toHaveBeenCalled();
  });

  it('scrape: truncates debug logs with the module-level debugLogMaxLength', async () => {
    const page = mockPage();
    const { controller } = buildController(page, 5);
    const debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {
      /* capture only */
    });

    await controller.scrape('https://x.test/very-long-url', { t: '.t' });

    expect(debugSpy).toHaveBeenCalledWith('Scrap…');
    debugSpy.mockRestore();
  });

  it('scrapeWithWorkflow: falls back to module-level debugLogMaxLength when workflow omits it', async () => {
    const page = mockPage();
    const { controller, extraction, workflow } = buildController(page, 42);

    await controller.scrapeWithWorkflow('https://x.test', {
      version: '1',
      actions: [],
    });

    expect(extraction.setDebugLogMaxLength).toHaveBeenCalledWith(42);
    expect(workflow.setDebugLogMaxLength).toHaveBeenCalledWith(42);
  });

  it('scrapeWithWorkflow: workflow debugLogMaxLength overrides module-level value', async () => {
    const page = mockPage();
    const { controller, extraction } = buildController(page, 42);

    await controller.scrapeWithWorkflow('https://x.test', {
      version: '1',
      actions: [],
      debugLogMaxLength: 9,
    });

    expect(extraction.setDebugLogMaxLength).toHaveBeenCalledWith(9);
  });
});
