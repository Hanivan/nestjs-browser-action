import { Logger, LogLevel } from '@nestjs/common';

/**
 * Shared logging utility with configurable log level filtering.
 * Used across all services to provide consistent logging behavior.
 */
export class LoggerWithLevel {
  private readonly logger: Logger;
  private logLevel: LogLevel;

  constructor(context: string, logLevel: LogLevel = 'log') {
    this.logger = new Logger(context);
    this.logLevel = logLevel;
  }

  /**
   * Update the log level at runtime.
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get the current log level.
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Check if a message at the given level should be logged.
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex <= currentLevelIndex;
  }

  /**
   * Log a message at the specified level.
   */
  log(message: string, level: LogLevel = 'log'): void {
    if (!this.shouldLog(level)) {
      return;
    }

    switch (level) {
      case 'error':
        this.logger.error(message);
        break;
      case 'warn':
        this.logger.warn(message);
        break;
      case 'debug':
        this.logger.debug(message);
        break;
      case 'verbose':
        this.logger.verbose(message);
        break;
      default:
        this.logger.log(message);
    }
  }
}
