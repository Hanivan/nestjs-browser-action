import { Module, DynamicModule, Provider, Global } from '@nestjs/common';
import type { Browser, Page } from 'puppeteer-core';
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
import { NamedBrowserShutdown } from './services/named-browser-shutdown';
import { BrowserHolder } from './services/browser-holder';
import { BROWSER_ACTION_OPTIONS } from './constants';
import {
  claimBrowserName,
  getBrowserToken,
  getBrowserHolderToken,
  getPageToken,
  getPageControllerToken,
  getNamedOptionsToken,
} from './common/tokens';
import {
  launchLocalBrowser,
  connectRemoteBrowser,
  validateRemoteOptions,
} from './utils/browser-launcher';
import { LoggerWithLevel } from './utils/logger.util';
import { PipeEngine } from './pipes/pipe-engine';
import {
  ExtractionOperator,
  ContainerOperator,
  WorkflowOperator,
  PaginationOperator,
  CaptureOperator,
} from './operators';
import { PageSession } from './services/page-session';
import { PageController } from './services/page-controller';
import type { BrowserActionOptions } from './interfaces/browser-action-options';
import { DEFAULT_DEBUG_LOG_MAX_LENGTH } from './constants/browser-action.constants';

@Global()
@Module({})
export class BrowserActionModule {
  /**
   * @deprecated Pool mode (no `name`) is deprecated; pass `name` to register a named browser instead. Removal targeted v1.0.
   */
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

  /**
   * Note: pool mode (no `name`) is deprecated; pass `name` to register a
   * named browser instead. Removal targeted v1.0.
   */
  static forRoot(options: BrowserActionModuleOptions): DynamicModule {
    if (options.name) return this.forNamedBrowser(options);

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

  private static forNamedBrowser(
    options: BrowserActionModuleOptions,
  ): DynamicModule {
    const name = options.name!;
    claimBrowserName(name);
    if (options.remote) validateRemoteOptions(options.remote);

    const optionsProvider: Provider = {
      provide: getNamedOptionsToken(name),
      useValue: options,
    };
    const browserProvider: Provider = {
      provide: getBrowserToken(name),
      useFactory: async (): Promise<Browser> => {
        const logLevel =
          (Array.isArray(options.logLevel)
            ? options.logLevel[0]
            : options.logLevel) || 'log';
        const logger = new LoggerWithLevel('BrowserActionModule', logLevel);
        return options.remote
          ? await connectRemoteBrowser(options.remote, logger)
          : await launchLocalBrowser(options, undefined, logger);
      },
    };
    const holderProvider: Provider = {
      provide: getBrowserHolderToken(name),
      useFactory: (browser: Browser): BrowserHolder =>
        new BrowserHolder(browser),
      inject: [getBrowserToken(name)],
    };
    const shutdownProvider: Provider = {
      provide: `${getBrowserToken(name)}Shutdown`,
      useFactory: (holder: BrowserHolder): NamedBrowserShutdown =>
        new NamedBrowserShutdown(name, holder, !!options.remote),
      inject: [getBrowserHolderToken(name)],
    };

    return {
      module: BrowserActionModule,
      global: true,
      providers: [
        optionsProvider,
        browserProvider,
        holderProvider,
        shutdownProvider,
      ],
      exports: [browserProvider, holderProvider, optionsProvider],
    };
  }

  /**
   * Note: pool mode (no `name`) is deprecated; pass `name` to register a
   * named browser instead. Removal targeted v1.0.
   */
  static forRootAsync(options: BrowserActionAsyncModuleOptions): DynamicModule {
    if (options.name) return this.forNamedBrowserAsync(options);

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

  private static forNamedBrowserAsync(
    options: BrowserActionAsyncModuleOptions,
  ): DynamicModule {
    const name = options.name!;
    claimBrowserName(name);

    const optionsToken = getNamedOptionsToken(name);
    const optionsProvider: Provider = {
      provide: optionsToken,
      useFactory: async (...args: unknown[]) => {
        const resolved = await options.useFactory(...args);
        if (resolved.remote) validateRemoteOptions(resolved.remote);
        return resolved;
      },
      inject: options.inject || [],
    };
    const browserProvider: Provider = {
      provide: getBrowserToken(name),
      useFactory: async (
        resolved: BrowserActionModuleOptions,
      ): Promise<Browser> => {
        const logLevel =
          (Array.isArray(resolved.logLevel)
            ? resolved.logLevel[0]
            : resolved.logLevel) || 'log';
        const logger = new LoggerWithLevel('BrowserActionModule', logLevel);
        return resolved.remote
          ? await connectRemoteBrowser(resolved.remote, logger)
          : await launchLocalBrowser(resolved, undefined, logger);
      },
      inject: [optionsToken],
    };
    const holderProvider: Provider = {
      provide: getBrowserHolderToken(name),
      useFactory: (browser: Browser): BrowserHolder =>
        new BrowserHolder(browser),
      inject: [getBrowserToken(name)],
    };
    const shutdownProvider: Provider = {
      provide: `${getBrowserToken(name)}Shutdown`,
      useFactory: (
        holder: BrowserHolder,
        resolved: BrowserActionModuleOptions,
      ): NamedBrowserShutdown =>
        new NamedBrowserShutdown(name, holder, !!resolved.remote),
      inject: [getBrowserHolderToken(name), optionsToken],
    };

    return {
      module: BrowserActionModule,
      global: true,
      imports: options.imports || [],
      providers: [
        optionsProvider,
        browserProvider,
        holderProvider,
        shutdownProvider,
      ],
      exports: [browserProvider, holderProvider, optionsProvider],
    };
  }

  static forFeature(pages: string[], browserName = 'default'): DynamicModule {
    const providers: Provider[] = pages.flatMap((pageName) => {
      const pageProvider: Provider = {
        provide: getPageToken(pageName, browserName),
        useFactory: async (browser: Browser): Promise<Page> =>
          await browser.newPage(),
        inject: [getBrowserToken(browserName)],
      };
      const controllerProvider: Provider = {
        provide: getPageControllerToken(pageName, browserName),
        useFactory: (
          holder: BrowserHolder,
          page: Page,
          options: BrowserActionOptions,
        ): PageController => {
          const logLevel =
            (Array.isArray(options.logLevel)
              ? options.logLevel[0]
              : options.logLevel) || 'log';
          const debugLen =
            options.debugLogMaxLength ?? DEFAULT_DEBUG_LOG_MAX_LENGTH;
          const logger = new LoggerWithLevel(
            `PageController:${browserName}/${pageName}`,
            logLevel,
          );
          const pipeEngine = new PipeEngine();
          const extraction = new ExtractionOperator(pipeEngine, logger);
          const container = new ContainerOperator(
            extraction,
            pipeEngine,
            logger,
          );
          const cleansingService = new CleansingService(options);
          const cookieService = new CookieService(options);
          const workflow = new WorkflowOperator(
            extraction,
            container,
            pipeEngine,
            cleansingService,
            logger,
            () => cookieService,
          );
          const pagination = new PaginationOperator(logger);
          const capture = new CaptureOperator(logger);
          const session = new PageSession(
            browserName,
            holder,
            page,
            options,
            logger,
          );
          return new PageController(
            session,
            extraction,
            container,
            workflow,
            pagination,
            capture,
            logger,
            debugLen,
          );
        },
        inject: [
          getBrowserHolderToken(browserName),
          getPageToken(pageName, browserName),
          getNamedOptionsToken(browserName),
        ],
      };
      return [pageProvider, controllerProvider];
    });

    return { module: BrowserActionModule, providers, exports: providers };
  }

  async onModuleDestroy() {
    // Cleanup is handled by BrowserPoolService
  }
}
