import { Test } from '@nestjs/testing';
import { BrowserActionModule } from './browser-action.module';
import {
  getBrowserToken,
  getPageToken,
  getPageControllerToken,
  releaseBrowserName,
} from './common/tokens';
import { PageController } from './services/page-controller';
import { BrowserManagerService } from './services/browser-manager.service';
import { PageService } from './services/page.service';
import { BrowserActionService } from './services/browser-action.service';
import type { Browser, Page } from 'puppeteer-core';

jest.mock('./utils/browser-launcher', () => ({
  ...jest.requireActual<typeof import('./utils/browser-launcher')>(
    './utils/browser-launcher',
  ),
  launchLocalBrowser: jest.fn().mockImplementation(
    async () =>
      ({
        connected: true,
        newPage: jest.fn().mockResolvedValue({
          isClosed: jest.fn().mockReturnValue(false),
          close: jest.fn(),
        } as unknown as Page),
        close: jest.fn(),
        process: jest.fn().mockReturnValue(null),
      }) as unknown as Browser,
  ),
}));

describe('BrowserActionModule named + forFeature', () => {
  afterEach(() => {
    releaseBrowserName('stealth');
    releaseBrowserName('dupname');
  });

  it('resolves browser, page, and controller tokens', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        BrowserActionModule.forRoot({ name: 'stealth' }),
        BrowserActionModule.forFeature(['login'], 'stealth'),
      ],
    }).compile();

    expect(moduleRef.get(getBrowserToken('stealth'))).toBeDefined();
    expect(moduleRef.get(getPageToken('login', 'stealth'))).toBeDefined();
    expect(
      moduleRef.get(getPageControllerToken('login', 'stealth')),
    ).toBeInstanceOf(PageController);
    await moduleRef.close();
  });

  it('throws on duplicate browser name', () => {
    BrowserActionModule.forRoot({ name: 'dupname' });
    expect(() => BrowserActionModule.forRoot({ name: 'dupname' })).toThrow(
      /already registered/,
    );
  });

  it('pool mode (no name) still provides BrowserActionService', async () => {
    const module = await Test.createTestingModule({
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
});
