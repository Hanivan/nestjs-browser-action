import { BrowserHolder } from './browser-holder';
import { LoggerWithLevel } from '../utils/logger.util';

/**
 * Passive liveness ping for a named browser. Pings `browser.version()` on
 * an interval; on failure, logs a warning only. Does NOT proactively call
 * `BrowserHolder.relaunch()` — the existing reactive recovery via
 * `PageSession.ensureAlive()` on the next real call is unchanged. This
 * class is pure observability.
 */
export class BrowserHealthCheck {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly name: string,
    private readonly holder: BrowserHolder,
    private readonly logger: LoggerWithLevel,
  ) {}

  start(intervalMs: number): void {
    this.timer = setInterval(() => {
      void this.holder.browser.version().catch((err: unknown) => {
        this.logger.warn(
          `[HEALTH:${this.name}] browser unreachable: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
