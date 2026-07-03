import {
  Module,
  DynamicModule,
  Provider,
  Global,
  LogLevel,
} from '@nestjs/common';
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
import { BrowserHealthCheck } from './services/browser-health-check';
import { BROWSER_ACTION_OPTIONS } from './constants';
import {
  claimBrowserName,
  getBrowserToken,
  getBrowserHolderToken,
  getPageToken,
  getPageControllerToken,
  getNamedOptionsToken,
  registerPages,
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
import {
  DEFAULT_DEBUG_LOG_MAX_LENGTH,
  DEFAULT_MAX_PAGES_WARNING,
} from './constants/browser-action.constants';

const POOL_MODE_SERVICES = [
  BrowserPoolService,
  BrowserManagerService,
  PageService,
  BrowserActionService,
  CookieService,
  CleansingService,
] as const;

const POOL_MODE_EXPORTS = [
  BrowserManagerService,
  PageService,
  BrowserActionService,
  CookieService,
  CleansingService,
] as const;

function resolveLogLevel(
  logLevel: LogLevel | LogLevel[] | undefined,
): LogLevel {
  return (Array.isArray(logLevel) ? logLevel[0] : logLevel) || 'log';
}

async function launchNamedBrowser(
  options: BrowserActionModuleOptions,
): Promise<Browser> {
  const logger = new LoggerWithLevel(
    'BrowserActionModule',
    resolveLogLevel(options.logLevel),
  );
  if (options.remote) {
    return await connectRemoteBrowser(options.remote, logger);
  }

  const browser = await launchLocalBrowser(options, undefined, logger);
  logger.warn(
    'Call app.enableShutdownHooks() in main.ts to ensure graceful browser cleanup on Ctrl+C',
  );
  const childProcess = browser.process();
  if (childProcess) {
    process.once('exit', () => {
      if (!childProcess.killed) childProcess.kill();
    });
  }
  return browser;
}

/**
 * Test-only alias — `launchNamedBrowser` itself stays unexported (internal
 * wiring for `forNamedBrowser`/`forNamedBrowserAsync`); this lets
 * browser-action.module.spec.ts drive it directly without going through
 * Nest's DI container.
 */
export const __test__launchNamedBrowser = launchNamedBrowser;

function namedBrowserHolderProvider(name: string): Provider {
  return {
    provide: getBrowserHolderToken(name),
    useFactory: (browser: Browser): BrowserHolder => new BrowserHolder(browser),
    inject: [getBrowserToken(name)],
  };
}

function getHealthCheckToken(name: string): string {
  return `${getBrowserToken(name)}HealthCheck`;
}

function namedBrowserHealthCheckProvider(
  name: string,
  optionsToken: string,
): Provider {
  return {
    provide: getHealthCheckToken(name),
    useFactory: (
      holder: BrowserHolder,
      options: BrowserActionModuleOptions,
    ): BrowserHealthCheck | undefined => {
      if (!options.healthCheck) return undefined;
      const logger = new LoggerWithLevel(
        'BrowserActionModule',
        resolveLogLevel(options.logLevel),
      );
      const check = new BrowserHealthCheck(name, holder, logger);
      check.start(options.healthCheck.intervalMs);
      return check;
    },
    inject: [getBrowserHolderToken(name), optionsToken],
  };
}

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
   * Pool mode (no `name`) and named-browser mode (with `name`) are both
   * fully supported. Pass `name` to register a named browser instead.
   */
  static forRoot(options: BrowserActionModuleOptions): DynamicModule {
    if (options.name) return this.forNamedBrowser(options);

    const optionsProvider: Provider = {
      provide: BROWSER_ACTION_OPTIONS,
      useValue: options,
    };

    return {
      module: BrowserActionModule,
      providers: [optionsProvider, ...POOL_MODE_SERVICES],
      exports: [...POOL_MODE_EXPORTS],
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
      useFactory: (): Promise<Browser> => launchNamedBrowser(options),
    };
    const holderProvider = namedBrowserHolderProvider(name);
    const optionsToken = getNamedOptionsToken(name);
    const healthCheckProvider = namedBrowserHealthCheckProvider(
      name,
      optionsToken,
    );
    const shutdownProvider: Provider = {
      provide: `${getBrowserToken(name)}Shutdown`,
      useFactory: (
        holder: BrowserHolder,
        healthCheck?: BrowserHealthCheck,
      ): NamedBrowserShutdown =>
        new NamedBrowserShutdown(name, holder, !!options.remote, healthCheck),
      inject: [getBrowserHolderToken(name), getHealthCheckToken(name)],
    };

    return {
      module: BrowserActionModule,
      global: true,
      providers: [
        optionsProvider,
        browserProvider,
        holderProvider,
        healthCheckProvider,
        shutdownProvider,
      ],
      exports: [browserProvider, holderProvider, optionsProvider],
    };
  }

  /**
   * Pool mode (no `name`) and named-browser mode (with `name`) are both
   * fully supported. Pass `name` to register a named browser instead.
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
      providers: [asyncOptionsProvider, ...POOL_MODE_SERVICES],
      exports: [...POOL_MODE_EXPORTS],
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
      useFactory: (resolved: BrowserActionModuleOptions): Promise<Browser> =>
        launchNamedBrowser(resolved),
      inject: [optionsToken],
    };
    const holderProvider = namedBrowserHolderProvider(name);
    const healthCheckProvider = namedBrowserHealthCheckProvider(
      name,
      optionsToken,
    );
    const shutdownProvider: Provider = {
      provide: `${getBrowserToken(name)}Shutdown`,
      useFactory: (
        holder: BrowserHolder,
        resolved: BrowserActionModuleOptions,
        healthCheck?: BrowserHealthCheck,
      ): NamedBrowserShutdown =>
        new NamedBrowserShutdown(name, holder, !!resolved.remote, healthCheck),
      inject: [
        getBrowserHolderToken(name),
        optionsToken,
        getHealthCheckToken(name),
      ],
    };

    return {
      module: BrowserActionModule,
      global: true,
      imports: options.imports || [],
      providers: [
        optionsProvider,
        browserProvider,
        holderProvider,
        healthCheckProvider,
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
          const debugLen =
            options.debugLogMaxLength ?? DEFAULT_DEBUG_LOG_MAX_LENGTH;
          const logger = new LoggerWithLevel(
            `PageController:${browserName}/${pageName}`,
            resolveLogLevel(options.logLevel),
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

    const pageCountGuardProvider: Provider = {
      provide: `${getBrowserToken(browserName)}PageCountGuard_${pages.join(',')}`,
      useFactory: (options: BrowserActionModuleOptions): void => {
        const total = registerPages(browserName, pages.length);
        const max = options.maxPages ?? DEFAULT_MAX_PAGES_WARNING;
        if (total > max) {
          const logger = new LoggerWithLevel(
            'BrowserActionModule',
            resolveLogLevel(options.logLevel),
          );
          logger.warn(
            `Named browser "${browserName}" has ${total} registered pages, ` +
              `exceeding the configured maxPages (${max}). This is a sanity ` +
              `warning, not an enforced limit — review your forFeature() calls.`,
          );
        }
      },
      inject: [getNamedOptionsToken(browserName)],
    };

    return {
      module: BrowserActionModule,
      providers: [...providers, pageCountGuardProvider],
      exports: providers,
    };
  }

  async onModuleDestroy() {
    // Cleanup is handled by BrowserPoolService
  }
}
