import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { releaseBrowserName, releasePageCount } from '../common/tokens';
import { BrowserHolder } from './browser-holder';
import type { BrowserHealthCheck } from './browser-health-check';

/**
 * Factory-provided named browsers have no lifecycle hooks of their own —
 * this holder is what Nest actually calls `onApplicationShutdown` on, so the
 * browser gets closed/disconnected and its name released back to the
 * process-level registry (`common/tokens.ts`) on app shutdown.
 *
 * Reads the browser through the shared `BrowserHolder`, so a browser
 * relaunched by a `PageSession` after the bootstrap one died is the one that
 * gets closed.
 */
@Injectable()
export class NamedBrowserShutdown implements OnApplicationShutdown {
  constructor(
    private readonly name: string,
    private readonly holder: BrowserHolder,
    private readonly isRemote: boolean,
    private readonly healthCheck?: BrowserHealthCheck,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    this.healthCheck?.stop();
    try {
      const browser = this.holder.browser;
      if (browser.connected) {
        if (this.isRemote) await browser.disconnect();
        else await browser.close();
      }
    } catch {
      /* browser already gone */
    } finally {
      releaseBrowserName(this.name);
      releasePageCount(this.name);
    }
  }
}
