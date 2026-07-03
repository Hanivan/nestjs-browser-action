import { BrowserHealthCheck } from './browser-health-check';
import { BrowserHolder } from './browser-holder';
import { LoggerWithLevel } from '../utils/logger.util';
import type { Browser } from 'puppeteer-core';

function mockBrowser(versionImpl: () => Promise<string>): Browser {
  return {
    connected: true,
    version: jest.fn().mockImplementation(versionImpl),
  } as unknown as Browser;
}

describe('BrowserHealthCheck', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('pings browser.version() on the configured interval', () => {
    const browser = mockBrowser(() => Promise.resolve('HeadlessChrome/1.0'));
    const holder = new BrowserHolder(browser);
    const logger = new LoggerWithLevel('test', 'error');
    const check = new BrowserHealthCheck('hc', holder, logger);

    check.start(1000);
    jest.advanceTimersByTime(3000);

    expect(browser.version).toHaveBeenCalledTimes(3);
    check.stop();
  });

  it('logs a warning when the ping rejects, without throwing', async () => {
    const browser = mockBrowser(() =>
      Promise.reject(new Error('disconnected')),
    );
    const holder = new BrowserHolder(browser);
    const logger = new LoggerWithLevel('test', 'error');
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation();
    const check = new BrowserHealthCheck('hc', holder, logger);

    check.start(1000);
    jest.advanceTimersByTime(1000);
    // Let the rejected promise's .catch() microtask run before asserting.
    await Promise.resolve();
    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('hc'));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('disconnected'),
    );
    check.stop();
    warnSpy.mockRestore();
  });

  it('does not proactively call holder.relaunch on failure (passive only)', async () => {
    const browser = mockBrowser(() => Promise.reject(new Error('down')));
    const holder = new BrowserHolder(browser);
    const relaunchSpy = jest.spyOn(holder, 'relaunch');
    const logger = new LoggerWithLevel('test', 'error');
    jest.spyOn(logger, 'warn').mockImplementation();
    const check = new BrowserHealthCheck('hc', holder, logger);

    check.start(1000);
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();

    expect(relaunchSpy).not.toHaveBeenCalled();
    check.stop();
  });

  it('stop() clears the interval — no further pings after stopping', () => {
    const browser = mockBrowser(() => Promise.resolve('v1'));
    const holder = new BrowserHolder(browser);
    const logger = new LoggerWithLevel('test', 'error');
    const check = new BrowserHealthCheck('hc', holder, logger);

    check.start(1000);
    jest.advanceTimersByTime(1000);
    expect(browser.version).toHaveBeenCalledTimes(1);

    check.stop();
    jest.advanceTimersByTime(5000);
    expect(browser.version).toHaveBeenCalledTimes(1);
  });

  it('stop() before start() does not throw', () => {
    const browser = mockBrowser(() => Promise.resolve('v1'));
    const holder = new BrowserHolder(browser);
    const logger = new LoggerWithLevel('test', 'error');
    const check = new BrowserHealthCheck('hc', holder, logger);

    expect(() => check.stop()).not.toThrow();
  });
});
