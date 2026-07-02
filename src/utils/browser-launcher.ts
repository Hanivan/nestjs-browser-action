import type { Browser } from 'puppeteer-core';
import { connect } from 'puppeteer-core';
import type {
  BrowserActionOptions,
  CloakOptions,
  RemoteOptions,
} from '../interfaces/browser-action-options';
import {
  DEFAULT_REMOTE_OPTIONS,
  ERROR_MESSAGES,
} from '../constants/browser-action.constants';
import { loadCloakPuppeteer } from './cloak.loader';
import { LoggerWithLevel } from './logger.util';
import { delay } from './delay.util';

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

export function validateRemoteOptions(remote?: RemoteOptions): void {
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

function warnOnDangerousFlags(args?: string[], logger?: LoggerWithLevel): void {
  if (!args) return;
  for (const arg of args) {
    const flagName = arg.split('=')[0];
    if (BLOCKED_CHROMIUM_FLAGS.has(flagName)) {
      logger?.warn(
        `Potentially dangerous Chromium flag detected: ${flagName}. ` +
          `Only use this flag if you understand the security implications.`,
      );
    }
  }
}

export async function launchLocalBrowser(
  base: BrowserActionOptions,
  cloakOverride?: CloakOptions,
  logger?: LoggerWithLevel,
): Promise<Browser> {
  const { launch, launchPersistentContext } = await loadCloakPuppeteer();

  const cloak: CloakOptions = {
    ...(base.cloak ?? {}),
    ...(cloakOverride ?? {}),
  };
  const headless = base.launchOptions?.headless ?? cloak.headless;
  const launchOptions = {
    ...(cloak.launchOptions ?? {}),
    ...(base.launchOptions as Record<string, unknown> | undefined),
  };
  // Security: warn on potentially dangerous Chromium flags (developer responsibility)
  if (Array.isArray(launchOptions.args)) {
    warnOnDangerousFlags(launchOptions.args, logger);
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

export async function connectRemoteBrowser(
  remote: RemoteOptions,
  logger?: LoggerWithLevel,
): Promise<Browser> {
  const {
    browserURL,
    browserWSEndpoint,
    retryMax = DEFAULT_REMOTE_OPTIONS.retryMax,
    retryDelay = DEFAULT_REMOTE_OPTIONS.retryDelay,
  } = remote;

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
      logger?.debug(
        `Connecting to remote Chrome (attempt ${attempt}/${retryMax})`,
      );

      const browser = await connect(connectOptions);

      logger?.debug('Successfully connected to remote Chrome');
      return browser;
    } catch (error) {
      lastError = error as Error;
      logger?.warn(
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
