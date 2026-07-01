import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import type { Browser } from 'puppeteer-core';
import { connect } from 'puppeteer-core';
import {
  BROWSER_ACTION_OPTIONS,
  DEFAULT_POOL_OPTIONS,
  DEFAULT_REMOTE_OPTIONS,
  ERROR_MESSAGES,
} from '../constants/browser-action.constants';
import type {
  BrowserActionOptions,
  CloakOptions,
  RemoteOptions,
} from '../interfaces/browser-action-options';
import type { LogLevel } from '@nestjs/common';
import { sanitizeForLog } from '../utils/sanitize.util';
import { LoggerWithLevel } from '../utils/logger.util';
import { delay } from '../utils/delay.util';
import { loadCloakPuppeteer } from '../utils/cloak.loader';

/** Security: Chromium flags that must never be passed via user input */
const BLOCKED_CHROMIUM_FLAGS = new Set([
  '--remote-debugging-port',
  '--remote-allow-origins',
  '--load-extension',
  '--disable-web-security',
  '--no-sandbox',
  '--disable-features=IsolateOrigins',
  '--disable-site-isolation-trials',
  '--allow-running-insecure-content',
  '--reduce-security-for-testing',
  '--disable-setuid-sandbox',
  '--single-process',
  '--no-zygote',
]);

@Injectable()
export class BrowserPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: LoggerWithLevel;
  private pool: Browser[] = [];
  private available: Set<Browser> = new Set();
  private inUse: Set<Browser> = new Set();
  private disconnectListeners = new Map<Browser, () => void>();
  private lastUsed = new Map<Browser, number>();
  private waiters: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
  }> = [];
  private minSize: number = DEFAULT_POOL_OPTIONS.min;
  private maxSize: number = DEFAULT_POOL_OPTIONS.max;
  private idleTimeoutMs: number = DEFAULT_POOL_OPTIONS.idleTimeoutMs;
  private acquireTimeoutMs: number = DEFAULT_POOL_OPTIONS.acquireTimeoutMs;
  private currentIndex: number = 0;
  private reaper?: ReturnType<typeof setInterval>;
  private destroyed = false;
  private isShuttingDown = false;
  // Short human-readable id per browser so pool logs are traceable across
  // acquire → release → evict without leaking the full ws endpoint.
  private ids = new WeakMap<Browser, string>();
  private idSeq = 0;

  constructor(
    @Inject(BROWSER_ACTION_OPTIONS)
    private readonly options: BrowserActionOptions,
  ) {
    this.logger = new LoggerWithLevel(
      BrowserPoolService.name,
      (Array.isArray(options.logLevel)
        ? options.logLevel[0]
        : options.logLevel) || 'log',
    );
  }

  async onModuleInit() {
    this.minSize = this.options.pool?.min || DEFAULT_POOL_OPTIONS.min;
    this.maxSize = this.options.pool?.max || DEFAULT_POOL_OPTIONS.max;
    this.idleTimeoutMs =
      this.options.pool?.idleTimeoutMs ?? DEFAULT_POOL_OPTIONS.idleTimeoutMs;
    this.acquireTimeoutMs =
      this.options.pool?.acquireTimeoutMs ??
      DEFAULT_POOL_OPTIONS.acquireTimeoutMs;

    // Validate remote options
    this.validateRemoteOptions(this.options.remote);

    const remote = this.options.remote;
    if (remote?.browserURL) {
      this.logger.log(
        `Browser mode: Remote CDP (browserURL: ${String(sanitizeForLog(remote.browserURL))})`,
      );
    } else if (remote?.browserWSEndpoint) {
      this.logger.log(
        `Browser mode: Remote CDP (WebSocket: ${String(sanitizeForLog(remote.browserWSEndpoint))})`,
      );
    } else {
      this.logger.log('Browser mode: Local CloakBrowser (stealth Chromium)');
    }

    this.logger.warn(
      'Call app.enableShutdownHooks() in main.ts to ensure graceful browser cleanup on Ctrl+C',
    );

    if (this.options.lazyInit) {
      this.logger.log(
        `Browser pool configured (min: ${this.minSize}, max: ${this.maxSize}) — lazy mode, browsers spawn on first use`,
      );
      this.startReaper();
      return;
    }

    this.logger.log(
      `Initializing browser pool (min: ${this.minSize}, max: ${this.maxSize})`,
    );

    // Create browsers in parallel for faster initialization
    const browsers = await Promise.all(
      Array.from({ length: this.minSize }, () => this.createBrowser()),
    );

    browsers.forEach((browser) => {
      this.pool.push(browser);
      this.available.add(browser);
      this.touch(browser);
    });

    this.startReaper();

    this.logger.log(
      `Browser pool initialized with ${this.pool.length} browsers`,
    );
  }

  private touch(browser: Browser): void {
    this.lastUsed.set(browser, Date.now());
  }

  /** Stable short id for a browser (assigned on first sight). */
  private idOf(browser: Browser): string {
    let id = this.ids.get(browser);
    if (!id) {
      id = `b${++this.idSeq}`;
      this.ids.set(browser, id);
    }
    return id;
  }

  /** One-line pool snapshot for `[POOL]` debug logs. */
  private stats(): string {
    return `size=${this.pool.length} avail=${this.available.size} inUse=${this.inUse.size} waiters=${this.waiters.length} max=${this.maxSize}`;
  }

  private startReaper(): void {
    if (this.reaper || this.idleTimeoutMs <= 0) return;
    this.reaper = setInterval(() => this.reapIdle(), this.idleTimeoutMs);
    // Don't keep the event loop alive solely for the reaper.
    this.reaper.unref?.();
  }

  private reapIdle(): void {
    if (this.destroyed) return;
    const now = Date.now();
    for (const browser of Array.from(this.available)) {
      if (this.pool.length <= this.minSize) break;
      const last = this.lastUsed.get(browser) ?? now;
      if (now - last >= this.idleTimeoutMs) {
        const id = this.idOf(browser);
        this.evict(browser);
        void this.closeBrowser(browser);
        this.logger.debug(`[POOL] reaped idle ${id} | ${this.stats()}`);
      }
    }
  }

  getLogLevel(): LogLevel {
    return this.logger.getLogLevel();
  }

  private validateRemoteOptions(remote?: RemoteOptions): void {
    if (!remote) return;

    const hasURL = !!remote.browserURL;
    const hasWSEndpoint = !!remote.browserWSEndpoint;

    if (hasURL && hasWSEndpoint) {
      throw new Error(ERROR_MESSAGES.REMOTE_BOTH_PROVIDED);
    }

    if (!hasURL && !hasWSEndpoint) {
      throw new Error(ERROR_MESSAGES.REMOTE_NONE_PROVIDED);
    }
  }

  private async createBrowser(): Promise<Browser> {
    if (this.options.remote) {
      return await this.connectWithRetry(this.options.remote);
    }

    const browser = await this.launchLocal();

    const disconnectHandler = () => {
      this.logger.warn('Browser disconnected; evicting from pool');
      void this.handleDisconnect(browser);
    };
    browser.on('disconnected', disconnectHandler);
    this.disconnectListeners.set(browser, disconnectHandler);
    return browser;
  }

  private warnOnDangerousFlags(args?: string[]): void {
    if (!args) return;
    for (const arg of args) {
      const flagName = arg.split('=')[0];
      if (BLOCKED_CHROMIUM_FLAGS.has(flagName)) {
        this.logger.warn(
          `Potentially dangerous Chromium flag detected: ${flagName}. ` +
            `Only use this flag if you understand the security implications.`,
        );
      }
    }
  }

  private async launchLocal(cloakOverride?: CloakOptions): Promise<Browser> {
    const { launch, launchPersistentContext } = await loadCloakPuppeteer();

    const cloak: CloakOptions = {
      ...(this.options.cloak ?? {}),
      ...(cloakOverride ?? {}),
    };
    const headless = this.options.launchOptions?.headless ?? cloak.headless;
    const launchOptions = {
      ...(cloak.launchOptions ?? {}),
      ...(this.options.launchOptions as Record<string, unknown> | undefined),
    };
    // Security: warn on potentially dangerous Chromium flags (developer responsibility)
    if (Array.isArray(launchOptions.args)) {
      this.warnOnDangerousFlags(launchOptions.args);
    }
    const cloakOptions = {
      ...cloak,
      ...(typeof headless === 'boolean' ? { headless } : {}),
      launchOptions,
    };

    return cloak.userDataDir
      ? await launchPersistentContext({
          ...cloakOptions,
          userDataDir: cloak.userDataDir,
        })
      : await launch(cloakOptions);
  }

  /**
   * Launch a one-off browser outside the pool with per-call cloak overrides
   * (e.g. proxy/UA rotation). The caller must release it via
   * {@link destroyDedicatedBrowser}. Not supported in remote CDP mode.
   */
  async createDedicatedBrowser(cloakOverride?: CloakOptions): Promise<Browser> {
    if (this.options.remote) {
      throw new Error(
        'Per-call cloak override is not supported in remote CDP mode',
      );
    }
    this.logger.debug('Launching dedicated (off-pool) browser');
    return await this.launchLocal(cloakOverride);
  }

  async destroyDedicatedBrowser(browser: Browser): Promise<void> {
    await this.closeBrowser(browser);
  }

  private async connectWithRetry(
    remoteOptions: RemoteOptions,
  ): Promise<Browser> {
    const {
      browserURL,
      browserWSEndpoint,
      retryMax = DEFAULT_REMOTE_OPTIONS.retryMax,
      retryDelay = DEFAULT_REMOTE_OPTIONS.retryDelay,
    } = remoteOptions;

    const connectOptions: { browserURL?: string; browserWSEndpoint?: string } =
      {};
    if (browserURL) {
      connectOptions.browserURL = browserURL;
    } else if (browserWSEndpoint) {
      connectOptions.browserWSEndpoint = browserWSEndpoint;
    }

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryMax; attempt++) {
      try {
        this.logger.debug(
          `Connecting to remote Chrome (attempt ${attempt}/${retryMax})`,
        );

        const browser = await connect(connectOptions);

        const disconnectHandler = () => {
          this.logger.warn('Remote Chrome disconnected; evicting from pool');
          void this.handleDisconnect(browser);
        };
        browser.on('disconnected', disconnectHandler);
        this.disconnectListeners.set(browser, disconnectHandler);

        this.logger.debug('Successfully connected to remote Chrome');
        return browser;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Connection attempt ${attempt}/${retryMax} failed: ${lastError.message}`,
        );

        if (attempt < retryMax) {
          await delay(retryDelay);
        }
      }
    }

    throw new Error(
      `Failed to connect to remote Chrome after ${retryMax} attempts: ${lastError?.message}`,
    );
  }

  async acquire(): Promise<Browser> {
    // Loop so that a waiter woken by release() re-checks availability rather
    // than blindly assuming a browser is free — two waiters can wake from the
    // same release; only one gets the browser, the other waits again.
    for (;;) {
      if (this.available.size > 0) {
        const browser = this.getNextAvailable();
        this.available.delete(browser);
        // ponytail: evict dead browsers inline — disconnected event fires async
        // so a stale browser can sit in available between release() and acquire().
        if (!browser.connected) {
          this.logger.debug(
            `[POOL] acquire skipped dead ${this.idOf(browser)} — evicting | ${this.stats()}`,
          );
          this.evict(browser);
          continue;
        }
        this.inUse.add(browser);
        this.touch(browser);
        this.logger.debug(
          `[POOL] acquire reuse ${this.idOf(browser)} | ${this.stats()}`,
        );
        return browser;
      }

      if (this.pool.length < this.maxSize) {
        const browser = await this.createBrowser();
        this.pool.push(browser);
        this.inUse.add(browser);
        this.touch(browser);
        this.logger.debug(
          `[POOL] acquire grew ${this.idOf(browser)} | ${this.stats()}`,
        );
        return browser;
      }

      this.logger.debug(
        `[POOL] acquire wait — pool exhausted | ${this.stats()}`,
      );
      await this.waitForAvailable();
    }
  }

  private getNextAvailable(): Browser {
    const browsers = Array.from(this.available);
    const browser = browsers[this.currentIndex % browsers.length];
    this.currentIndex++;
    return browser;
  }

  private waitForAvailable(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const waiter: (typeof this.waiters)[number] = { resolve, reject };
      if (this.acquireTimeoutMs > 0) {
        waiter.timer = setTimeout(() => {
          const idx = this.waiters.indexOf(waiter);
          if (idx >= 0) this.waiters.splice(idx, 1);
          reject(
            new Error(
              `Timed out acquiring browser after ${this.acquireTimeoutMs}ms (pool exhausted)`,
            ),
          );
        }, this.acquireTimeoutMs);
      }
      this.waiters.push(waiter);
    });
  }

  private signalWaiter(): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      if (waiter.timer) clearTimeout(waiter.timer);
      this.logger.debug(`[POOL] wake waiter | ${this.stats()}`);
      waiter.resolve();
    }
  }

  release(browser: Browser): void {
    if (this.inUse.has(browser)) {
      // Evict on return if it died mid-use — keeps available/stats honest and
      // triggers min-pool recreate instead of handing a dead browser back out.
      if (!browser.connected) {
        const id = this.idOf(browser);
        void this.handleDisconnect(browser);
        this.logger.debug(
          `[POOL] release dead ${id} — evicted on return | ${this.stats()}`,
        );
        this.signalWaiter();
        return;
      }
      this.inUse.delete(browser);
      this.available.add(browser);
      this.touch(browser);
      this.logger.debug(
        `[POOL] release ${this.idOf(browser)} | ${this.stats()}`,
      );
    } else {
      this.logger.debug(
        `[POOL] release ignored ${this.idOf(browser)} (not in-use) | ${this.stats()}`,
      );
    }
    this.signalWaiter();
  }

  private evict(browser: Browser): void {
    this.pool = this.pool.filter((b) => b !== browser);
    this.available.delete(browser);
    this.inUse.delete(browser);
    this.lastUsed.delete(browser);
    const handler = this.disconnectListeners.get(browser);
    if (handler) {
      browser.off('disconnected', handler);
      this.disconnectListeners.delete(browser);
    }
    this.logger.debug(`[POOL] evict ${this.idOf(browser)} | ${this.stats()}`);
  }

  private async closeBrowser(browser: Browser): Promise<void> {
    try {
      if (browser.connected) {
        if (this.options.remote) {
          await browser.disconnect();
        } else {
          await browser.close();
        }
      }
    } catch {
      this.logger.error('Error closing browser');
    }
  }

  private async handleDisconnect(browser: Browser): Promise<void> {
    this.evict(browser);
    if (this.destroyed) return;

    // Lazily recreate to keep the pool at >= min.
    try {
      while (this.pool.length < this.minSize && !this.destroyed) {
        const replacement = await this.createBrowser();
        this.pool.push(replacement);
        this.available.add(replacement);
        this.touch(replacement);
        this.logger.debug(
          `[POOL] recreated ${this.idOf(replacement)} to restore min=${this.minSize} | ${this.stats()}`,
        );
        this.signalWaiter();
      }
    } catch {
      this.logger.error('Failed to recreate browser after disconnect');
    }
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  getAvailableCount(): number {
    return this.available.size;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    this.destroyed = true;
    if (this.reaper) {
      clearInterval(this.reaper);
      this.reaper = undefined;
    }
    // Reject any pending acquire() waiters so callers don't hang on shutdown.
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      if (waiter.timer) clearTimeout(waiter.timer);
      waiter.reject(new Error('Browser pool is shutting down'));
    }

    const isRemote = !!this.options.remote;
    this.logger.log(
      isRemote
        ? 'Disconnecting all remote CDP browsers'
        : 'Closing all local browsers',
    );

    await Promise.all(
      this.pool.map(async (browser) => {
        try {
          const handler = this.disconnectListeners.get(browser);
          if (handler) {
            browser.off('disconnected', handler);
            this.disconnectListeners.delete(browser);
          }

          if (browser.connected) {
            if (isRemote) {
              // CDP: disconnect only — do not kill the remote Chrome process
              await browser.disconnect();
            } else {
              // Local: close the browser and all its pages
              await browser.close();
            }
          }
        } catch {
          this.logger.error('Error during browser cleanup');
        }
      }),
    );

    this.pool = [];
    this.available.clear();
    this.inUse.clear();
    this.disconnectListeners.clear();
    this.lastUsed.clear();
    this.logger.log('Browser pool shut down');
  }
}
