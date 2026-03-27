import { Test, TestingModule } from '@nestjs/testing';
import { BrowserActionModule } from './browser-action.module';
import { CleansingService } from './services/cleansing.service';
import { ActionHelpersService } from './helpers/action-helpers.service';

describe('BrowserActionModule - Cleansing Service Registration', () => {
  it('should provide CleansingService when using forRoot', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BrowserActionModule.forRoot({ pool: { min: 1, max: 3 } })],
    }).compile();

    expect(module.get(CleansingService)).toBeDefined();
    expect(await module.resolve(ActionHelpersService)).toBeDefined();
  });

  it('should export CleansingService for use in other modules', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [BrowserActionModule.forRoot({ pool: { min: 1, max: 3 } })],
    }).compile();

    const cleansingservice = moduleRef.get(CleansingService);

    expect(cleansingservice).toBeInstanceOf(CleansingService);
  });

  it('should provide CleansingService when using forRootAsync', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BrowserActionModule.forRootAsync({
          useFactory: () => ({ pool: { min: 1, max: 3 } }),
        }),
      ],
    }).compile();

    expect(module.get(CleansingService)).toBeDefined();
    expect(await module.resolve(ActionHelpersService)).toBeDefined();
  });
});
