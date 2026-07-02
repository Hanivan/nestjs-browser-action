import { BrowserHolder } from './browser-holder';
import type { Browser } from 'puppeteer-core';

function mockBrowser(connected: boolean): Browser {
  return { connected } as unknown as Browser;
}

describe('BrowserHolder', () => {
  it('returns the current browser without calling factory when already connected', async () => {
    const browser = mockBrowser(true);
    const holder = new BrowserHolder(browser);
    const factory = jest.fn();

    await expect(holder.relaunch(factory)).resolves.toBe(browser);
    expect(factory).not.toHaveBeenCalled();
  });

  it('relaunches via factory when browser is disconnected and updates browser', async () => {
    const dead = mockBrowser(false);
    const fresh = mockBrowser(true);
    const holder = new BrowserHolder(dead);
    const factory = jest.fn().mockResolvedValue(fresh);

    await expect(holder.relaunch(factory)).resolves.toBe(fresh);
    expect(holder.browser).toBe(fresh);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('dedups concurrent relaunches — factory called exactly once', async () => {
    const dead = mockBrowser(false);
    const fresh = mockBrowser(true);
    const holder = new BrowserHolder(dead);
    const factory = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          process.nextTick(() => resolve(fresh));
        }),
    );

    const [a, b] = await Promise.all([
      holder.relaunch(factory),
      holder.relaunch(factory),
    ]);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(a).toBe(fresh);
    expect(b).toBe(fresh);
    expect(holder.browser).toBe(fresh);
  });

  it('clears the in-flight lock after failure so a later relaunch retries', async () => {
    const dead = mockBrowser(false);
    const fresh = mockBrowser(true);
    const holder = new BrowserHolder(dead);
    const factory = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(fresh);

    await expect(holder.relaunch(factory)).rejects.toThrow('boom');
    await expect(holder.relaunch(factory)).resolves.toBe(fresh);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
