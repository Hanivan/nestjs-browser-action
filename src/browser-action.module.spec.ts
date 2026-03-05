import { Test, TestingModule } from '@nestjs/testing';
import { BrowserActionModule } from './browser-action.module';
import { BrowserManagerService } from './services/browser-manager.service';
import { PageService } from './services/page-service';
import { ActionHelpersService } from './helpers/action-helpers.service';

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
    expect(module.get(PageService)).toBeDefined();
    expect(module.get(ActionHelpersService)).toBeDefined();

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
    expect(module.get(PageService)).toBeDefined();
    expect(module.get(ActionHelpersService)).toBeDefined();

    await module.close();
  });
});
