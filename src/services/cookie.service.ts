import { Injectable, Inject } from '@nestjs/common';
import type { Page } from 'puppeteer';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  BROWSER_ACTION_OPTIONS,
  DEFAULT_COOKIE_OPTIONS,
} from '../constants/browser-action.constants';
import type { BrowserActionOptions } from '../interfaces/browser-action-options';
import type {
  CookieSaveOptions,
  CookieLoadOptions,
  CookieSession,
  CookieSessionInfo,
  CookieSessionFile,
} from '../interfaces/cookie-options';
import { LoggerWithLevel } from '../helpers/logger.util';

@Injectable()
export class CookieService {
  private readonly logger: LoggerWithLevel;
  private readonly cookiesDir: string;
  private readonly enabled: boolean;

  constructor(
    @Inject(BROWSER_ACTION_OPTIONS)
    private readonly options: BrowserActionOptions,
  ) {
    this.enabled =
      this.options.cookies?.enabled ?? DEFAULT_COOKIE_OPTIONS.enabled;
    this.cookiesDir =
      this.options.cookies?.cookiesDir ?? DEFAULT_COOKIE_OPTIONS.cookiesDir;
    this.logger = new LoggerWithLevel(
      CookieService.name,
      this.options.logLevel || 'log',
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Sanitize session name to prevent path traversal attacks
   */
  private sanitizeSessionName(sessionName: string): string {
    return sessionName.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Get full file path for a session
   */
  private getSessionPath(sessionName: string, cookiesDir?: string): string {
    const sanitized = this.sanitizeSessionName(sessionName);
    const dir = cookiesDir || this.cookiesDir;
    return path.join(dir, `${sanitized}.json`);
  }

  /**
   * Ensure cookies directory exists
   */
  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      throw new Error(`Failed to create cookies directory: ${dir}`);
    }
  }

  async saveCookies<
    TMetadata extends Record<string, unknown> = Record<string, unknown>,
  >(
    page: Page,
    sessionName: string,
    options?: CookieSaveOptions<TMetadata>,
  ): Promise<CookieSession<TMetadata>> {
    this.logger.debug(`Saving cookies for session: ${sessionName}`);

    const cookiesDir = options?.cookiesDir || this.cookiesDir;
    const sessionPath = this.getSessionPath(sessionName, cookiesDir);
    const sanitized = this.sanitizeSessionName(sessionName);

    await this.ensureDirectory(cookiesDir);

    if (!options?.overwrite) {
      try {
        await fs.access(sessionPath);
        throw new Error(
          `Session '${sessionName}' already exists. Use overwrite: true to replace.`,
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }

    const cookies = await page.cookies();

    const sessionData: CookieSessionFile<TMetadata> = {
      name: sanitized,
      cookies,
      savedAt: new Date().toISOString(),
      url: page.url(),
      metadata: options?.metadata,
    };

    const tempPath = `${sessionPath}.tmp`;
    try {
      await fs.writeFile(
        tempPath,
        JSON.stringify(sessionData, null, 2),
        'utf-8',
      );
      await fs.rename(tempPath, sessionPath);
    } catch (error) {
      // Clean up temp file if something went wrong
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore
      }
      throw new Error(
        `Failed to save cookies to ${sessionPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.logger.log(
      `Saved ${cookies.length} cookies to session: ${sessionName}`,
    );

    return {
      name: sanitized,
      cookies,
      savedAt: new Date(sessionData.savedAt),
      url: sessionData.url,
      metadata: sessionData.metadata,
    };
  }

  async loadCookies<
    TMetadata extends Record<string, unknown> = Record<string, unknown>,
  >(
    page: Page,
    sessionName: string,
    options?: CookieLoadOptions,
  ): Promise<CookieSession<TMetadata>> {
    this.logger.debug(`Loading cookies for session: ${sessionName}`);

    const cookiesDir = options?.cookiesDir || this.cookiesDir;
    const sessionPath = this.getSessionPath(sessionName, cookiesDir);

    let sessionData: CookieSessionFile<TMetadata>;
    try {
      const content = await fs.readFile(sessionPath, 'utf-8');
      sessionData = JSON.parse(content) as CookieSessionFile<TMetadata>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        if (options?.throwIfNotExists !== false) {
          throw new Error(
            `Session '${sessionName}' not found at ${sessionPath}`,
          );
        }
        return {
          name: sessionName,
          cookies: [],
          savedAt: new Date(),
        } as CookieSession<TMetadata>;
      }
      throw new Error(
        `Failed to read session file ${sessionPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      await page.setCookie(...sessionData.cookies);
    } catch (error) {
      this.logger.warn(`Failed to apply some cookies: ${error}`);
    }

    if (sessionData.url) {
      try {
        await page.goto(sessionData.url, { waitUntil: 'domcontentloaded' });
      } catch {
        // Ignore reload errors
      }
    }

    this.logger.log(
      `Loaded ${sessionData.cookies.length} cookies from session: ${sessionName}`,
    );

    return {
      name: sessionData.name,
      cookies: sessionData.cookies,
      savedAt: new Date(sessionData.savedAt),
      url: sessionData.url,
      metadata: sessionData.metadata,
    };
  }

  async deleteCookies(sessionName: string): Promise<void> {
    this.logger.debug(`Deleting session: ${sessionName}`);

    const sessionPath = this.getSessionPath(sessionName);

    try {
      await fs.unlink(sessionPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Session '${sessionName}' not found at ${sessionPath}`);
      }
      throw error;
    }

    this.logger.log(`Deleted session: ${sessionName}`);
  }

  async clearAllCookies(): Promise<void> {
    this.logger.debug('Clearing all cookie sessions');

    const files = await fs.readdir(this.cookiesDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    await Promise.all(
      jsonFiles.map((file) => fs.unlink(path.join(this.cookiesDir, file))),
    );

    this.logger.log(`Cleared ${jsonFiles.length} cookie sessions`);
  }

  async listCookies<
    TMetadata extends Record<string, unknown> = Record<string, unknown>,
  >(): Promise<CookieSessionInfo<TMetadata>[]> {
    this.logger.debug('Listing cookie sessions');

    try {
      const files = await fs.readdir(this.cookiesDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const results = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = path.join(this.cookiesDir, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content) as CookieSessionFile<TMetadata>;
            return {
              name: data.name,
              savedAt: new Date(data.savedAt),
              cookieCount: data.cookies.length,
              url: data.url,
              metadata: data.metadata,
            } as CookieSessionInfo<TMetadata>;
          } catch {
            this.logger.warn(`Skipping invalid session file: ${file}`);
            return null;
          }
        }),
      );

      return results.filter(
        (s): s is CookieSessionInfo<TMetadata> => s !== null,
      );
    } catch {
      // Directory doesn't exist yet
      return [];
    }
  }

  async hasSession(sessionName: string): Promise<boolean> {
    const sessionPath = this.getSessionPath(sessionName);

    try {
      await fs.access(sessionPath);
      return true;
    } catch {
      return false;
    }
  }
}
