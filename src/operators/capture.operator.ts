import { promises as fs } from 'fs';
import { dirname } from 'path';
import type { Page, ScreenshotOptions, PDFOptions } from 'puppeteer-core';
import { LoggerWithLevel } from '../utils/logger.util';
import type { TlsFingerprint } from '../interfaces/tls-fingerprint';

/**
 * Stateless page-level capture logic (screenshot / PDF / TLS fingerprint)
 * shared by BrowserActionService and (later) PageController. Constructed
 * per-caller with the deps it needs; holds no per-request page state.
 */
export class CaptureOperator {
  constructor(
    private readonly logger: LoggerWithLevel,
    private debugLogMaxLength: number,
  ) {}

  setDebugLogMaxLength(n: number): void {
    this.debugLogMaxLength = n;
  }

  async screenshot(
    page: Page,
    path: string,
    options?: ScreenshotOptions,
  ): Promise<Buffer> {
    const result = await page.screenshot({ path, ...options });
    return result as unknown as Buffer;
  }

  async pdf(page: Page, path: string, options?: PDFOptions): Promise<Buffer> {
    const pdf = await page.pdf({ path, ...options });
    return Buffer.from(pdf);
  }

  async tlsFingerprint(page: Page, path: string): Promise<TlsFingerprint> {
    const rawJson = await page.evaluate(() => document.body.innerText);

    const data = JSON.parse(rawJson) as Record<string, unknown>;
    const fingerprint = this.buildTlsFingerprint(data);

    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, JSON.stringify(fingerprint, null, 2), 'utf-8');

    this.logger.log(`Saved TLS fingerprint to ${path}`);
    return fingerprint;
  }

  private buildTlsFingerprint(data: Record<string, unknown>): TlsFingerprint {
    const tls = (data.tls ?? {}) as Record<string, unknown>;
    const http2 = (data.http2 ?? {}) as Record<string, unknown>;

    const extensions = Array.isArray(tls.extensions)
      ? (tls.extensions as Array<Record<string, unknown>>)
      : [];
    const sentFrames = Array.isArray(http2.sent_frames)
      ? (http2.sent_frames as Array<Record<string, unknown>>)
      : [];
    const headersFrame = sentFrames.find(
      (frame) => frame.frame_type === 'HEADERS',
    );

    return {
      capturedAt: new Date().toISOString(),
      ip: (data.ip as string) ?? '',
      httpVersion: (data.http_version as string) ?? '',
      method: (data.method as string) ?? '',
      userAgent: (data.user_agent as string) ?? '',
      ja3: (tls.ja3 as string) ?? '',
      ja3Hash: (tls.ja3_hash as string) ?? '',
      ja4: (tls.ja4 as string) ?? '',
      ja4_r: tls.ja4_r as string | undefined,
      peetprint: (tls.peetprint as string) ?? '',
      peetprintHash: (tls.peetprint_hash as string) ?? '',
      ciphers: Array.isArray(tls.ciphers) ? (tls.ciphers as string[]) : [],
      tlsExtensions: extensions.map((ext) => String(ext.name)),
      akamaiFingerprint: (http2.akamai_fingerprint as string) ?? '',
      akamaiFingerprintHash: (http2.akamai_fingerprint_hash as string) ?? '',
      headers: Array.isArray(headersFrame?.headers)
        ? (headersFrame.headers as string[])
        : [],
      raw: data,
    };
  }
}
