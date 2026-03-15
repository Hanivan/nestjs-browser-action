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
    this.logger.log(`Saving cookies for session: ${sessionName}`, 'debug');

    const cookiesDir = options?.cookiesDir || this.cookiesDir;
    const sessionPath = this.getSessionPath(sessionName, cookiesDir);
    const sanitized = this.sanitizeSessionName(sessionName);

    // Ensure directory exists
    await this.ensureDirectory(cookiesDir);

    // Check if file exists (unless overwrite is true)
    if (!options?.overwrite) {
      try {
        await fs.access(sessionPath);
        throw new Error(
          `Session '${sessionName}' already exists. Use overwrite: true to replace.`,
        );
      } catch {
        // File doesn't exist, which is what we want
      }
    }

    // Get cookies from page
    const cookies = await page.cookies();

    // Create session data
    const sessionData: CookieSessionFile<TMetadata> = {
      name: sanitized,
      cookies,
      savedAt: new Date().toISOString(),
      url: page.url(),
      metadata: options?.metadata,
    };

    // Write to temp file first, then rename (atomic operation)
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
    this.logger.log(`Loading cookies for session: ${sessionName}`, 'debug');

    const cookiesDir = options?.cookiesDir || this.cookiesDir;
    const sessionPath = this.getSessionPath(sessionName, cookiesDir);

    // Check if file exists
    try {
      await fs.access(sessionPath);
    } catch {
      if (options?.throwIfNotExists !== false) {
        throw new Error(`Session '${sessionName}' not found at ${sessionPath}`);
      }
      // Return empty session if not exists and throwIfNotExists is false
      return {
        name: sessionName,
        cookies: [],
        savedAt: new Date(),
      } as CookieSession<TMetadata>;
    }

    // Read and parse file
    let sessionData: CookieSessionFile<TMetadata>;
    try {
      const content = await fs.readFile(sessionPath, 'utf-8');
      sessionData = JSON.parse(content) as CookieSessionFile<TMetadata>;
    } catch (error) {
      throw new Error(
        `Failed to read session file ${sessionPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Apply cookies to page
    try {
      await page.setCookie(...sessionData.cookies);
    } catch (error) {
      this.logger.log(`Failed to apply some cookies: ${error}`, 'warn');
    }

    // Reload page to activate cookies
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
    this.logger.log(`Deleting session: ${sessionName}`, 'debug');

    const sessionPath = this.getSessionPath(sessionName);

    // Check if file exists
    try {
      await fs.access(sessionPath);
    } catch {
      throw new Error(`Session '${sessionName}' not found at ${sessionPath}`);
    }

    // Delete file
    await fs.unlink(sessionPath);

    this.logger.log(`Deleted session: ${sessionName}`);
  }

  async clearAllCookies(): Promise<void> {
    this.logger.log('Clearing all cookie sessions', 'debug');

    const files = await fs.readdir(this.cookiesDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const filePath = path.join(this.cookiesDir, file);
      await fs.unlink(filePath);
    }

    this.logger.log(`Cleared ${jsonFiles.length} cookie sessions`);
  }

  async listCookies<
    TMetadata extends Record<string, unknown> = Record<string, unknown>,
  >(): Promise<CookieSessionInfo<TMetadata>[]> {
    this.logger.log('Listing cookie sessions', 'debug');

    try {
      const files = await fs.readdir(this.cookiesDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const sessions: CookieSessionInfo<TMetadata>[] = [];

      for (const file of jsonFiles) {
        const filePath = path.join(this.cookiesDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content) as CookieSessionFile<TMetadata>;

          sessions.push({
            name: data.name,
            savedAt: new Date(data.savedAt),
            cookieCount: data.cookies.length,
            url: data.url,
            metadata: data.metadata,
          });
        } catch {
          // Skip invalid files
          this.logger.log(`Skipping invalid session file: ${file}`, 'warn');
        }
      }

      return sessions;
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
