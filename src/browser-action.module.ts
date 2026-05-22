import { Module, DynamicModule, Provider, Global } from '@nestjs/common';
import {
  BrowserActionModuleOptions,
  BrowserActionAsyncModuleOptions,
} from './browser-action.module-definition';
import { BrowserPoolService } from './services/browser-pool.service';
import { BrowserManagerService } from './services/browser-manager.service';
import { PageService } from './services/page.service';
import { BrowserActionService } from './services/browser-action.service';
import { CookieService } from './services/cookie.service';
import { CleansingService } from './services/cleansing.service';
import { BROWSER_ACTION_OPTIONS } from './constants';

@Global()
@Module({})
export class BrowserActionModule {
  static register(options: BrowserActionModuleOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: BROWSER_ACTION_OPTIONS,
      useValue: options,
    };

    return {
      module: BrowserActionModule,
      providers: [optionsProvider],
      exports: [],
    };
  }

  static forRoot(options: BrowserActionModuleOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: BROWSER_ACTION_OPTIONS,
      useValue: options,
    };

    return {
      module: BrowserActionModule,
      providers: [
        optionsProvider,
        BrowserPoolService,
        BrowserManagerService,
        PageService,
        BrowserActionService,
        CookieService,
        CleansingService,
      ],
      exports: [
        BrowserManagerService,
        PageService,
        BrowserActionService,
        CookieService,
        CleansingService,
      ],
    };
  }

  static forRootAsync(options: BrowserActionAsyncModuleOptions): DynamicModule {
    const asyncOptionsProvider: Provider = {
      provide: BROWSER_ACTION_OPTIONS,
      useFactory: async (...args: unknown[]) => {
        return await options.useFactory(...args);
      },
      inject: options.inject || [],
    };

    return {
      module: BrowserActionModule,
      imports: options.imports || [],
      providers: [
        asyncOptionsProvider,
        BrowserPoolService,
        BrowserManagerService,
        PageService,
        BrowserActionService,
        CookieService,
        CleansingService,
      ],
      exports: [
        BrowserManagerService,
        PageService,
        BrowserActionService,
        CookieService,
        CleansingService,
      ],
    };
  }

  async onModuleDestroy() {
    // Cleanup is handled by BrowserPoolService
  }
}
