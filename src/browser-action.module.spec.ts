import { Test, TestingModule } from '@nestjs/testing';
import type { Browser } from 'puppeteer-core';
import type { ChildProcess } from 'child_process';
import { BrowserActionModule } from './browser-action.module';
import { BrowserManagerService } from './services/browser-manager.service';
import { PageService } from './services/page.service';
import { BrowserActionService } from './services/browser-action.service';
import { LoggerWithLevel } from './utils/logger.util';

describe('BrowserActionModule', () => {
  it('should register module with forRoot', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BrowserActionModule.forRoot({
          launchOptions: { headless: true },
          pool: { min: 1, max: 2 },
        }),
      ],
    }).compile();

    expect(module.get(BrowserManagerService)).toBeDefined();
    expect(await module.resolve(PageService)).toBeDefined();
    expect(await module.resolve(BrowserActionService)).toBeDefined();

    await module.close();
  });

  it('should register module with forRootAsync', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BrowserActionModule.forRootAsync({
          useFactory: () => ({
            launchOptions: { headless: true },
            pool: { min: 1, max: 2 },
          }),
        }),
      ],
    }).compile();

    expect(module.get(BrowserManagerService)).toBeDefined();
    expect(await module.resolve(PageService)).toBeDefined();
    expect(await module.resolve(BrowserActionService)).toBeDefined();

    await module.close();
  });
});

// Mock the launcher module so launchLocalBrowser/connectRemoteBrowser never
// touch a real browser in the launchNamedBrowser tests below.
jest.mock('./utils/browser-launcher', () => ({
  ...jest.requireActual('./utils/browser-launcher'),
  launchLocalBrowser: jest.fn(),
  connectRemoteBrowser: jest.fn(),
}));

import {
  launchLocalBrowser,
  connectRemoteBrowser,
} from './utils/browser-launcher';
import { __test__launchNamedBrowser } from './browser-action.module';
import type { BrowserActionModuleOptions } from './browser-action.module-definition';

function mockBrowser(withProcess: boolean): Browser {
  const proc = withProcess
    ? ({ killed: false, kill: jest.fn() } as unknown as ChildProcess)
    : null;
  return {
    connected: true,
    process: jest.fn().mockReturnValue(proc),
  } as unknown as Browser;
}

describe('launchNamedBrowser', () => {
  afterEach(() => {
    jest.clearAllMocks();
    process.removeAllListeners('exit');
  });

  it('logs the shutdown-hook reminder for a local browser', async () => {
    const browser = mockBrowser(true);
    (launchLocalBrowser as jest.Mock).mockResolvedValue(browser);
    const warnSpy = jest
      .spyOn(LoggerWithLevel.prototype, 'warn')
      .mockImplementation();

    await __test__launchNamedBrowser({
      name: 'x',
    } as BrowserActionModuleOptions);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('enableShutdownHooks'),
    );
    warnSpy.mockRestore();
  });

  it('does NOT log the shutdown-hook reminder for a remote browser', async () => {
    const browser = mockBrowser(false);
    (connectRemoteBrowser as jest.Mock).mockResolvedValue(browser);
    const warnSpy = jest
      .spyOn(LoggerWithLevel.prototype, 'warn')
      .mockImplementation();

    await __test__launchNamedBrowser({
      name: 'x',
      remote: { browserURL: 'http://localhost:9222' },
    } as BrowserActionModuleOptions);

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('enableShutdownHooks'),
    );
    warnSpy.mockRestore();
  });

  it('registers a process exit handler that kills the local browser child process', async () => {
    const browser = mockBrowser(true);
    (launchLocalBrowser as jest.Mock).mockResolvedValue(browser);

    await __test__launchNamedBrowser({
      name: 'x',
    } as BrowserActionModuleOptions);
    process.emit('exit', 0);

    const proc = browser.process() as unknown as { kill: jest.Mock };
    expect(proc.kill).toHaveBeenCalled();
  });

  it('does NOT register an exit handler for a remote browser (no local process)', async () => {
    const browser = mockBrowser(false);
    (connectRemoteBrowser as jest.Mock).mockResolvedValue(browser);

    await __test__launchNamedBrowser({
      name: 'x',
      remote: { browserURL: 'http://localhost:9222' },
    } as BrowserActionModuleOptions);

    expect(process.listenerCount('exit')).toBe(0);
  });

  it('does not kill an already-killed child process on exit', async () => {
    const proc = { killed: true, kill: jest.fn() } as unknown as ChildProcess;
    const browser = {
      connected: true,
      process: jest.fn().mockReturnValue(proc),
    } as unknown as Browser;
    (launchLocalBrowser as jest.Mock).mockResolvedValue(browser);

    await __test__launchNamedBrowser({
      name: 'x',
    } as BrowserActionModuleOptions);
    process.emit('exit', 0);

    expect(proc.kill).not.toHaveBeenCalled();
  });
});

describe('BrowserActionModule named-browser wiring', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('forNamedBrowser accepts healthCheck and maxPages options without throwing at registration time', () => {
    expect(() =>
      BrowserActionModule.forRoot({
        name: `hc-wiring-${Date.now()}`,
        healthCheck: { intervalMs: 5000 },
        maxPages: 3,
      }),
    ).not.toThrow();
  });

  it('forFeature warns when registered page count exceeds maxPages for the named browser', async () => {
    const browserName = `page-guard-${Date.now()}`;
    const warnSpy = jest
      .spyOn(LoggerWithLevel.prototype, 'warn')
      .mockImplementation();
    const browser = {
      connected: true,
      process: jest.fn().mockReturnValue(null),
      newPage: jest.fn().mockResolvedValue({}),
    };
    (launchLocalBrowser as jest.Mock).mockResolvedValue(browser);

    const moduleRef = await Test.createTestingModule({
      imports: [
        BrowserActionModule.forRoot({ name: browserName, maxPages: 1 }),
        BrowserActionModule.forFeature(['a', 'b'], browserName),
      ],
    }).compile();
    await moduleRef.init();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(browserName));
    await moduleRef.close();
    warnSpy.mockRestore();
  });
});
