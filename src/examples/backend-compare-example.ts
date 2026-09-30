/**
 * Backend comparison: plain Chrome vs CloakBrowser vs Obscura loading example.com.
 * Each backend is started here, then driven through the lib via `remote`, so the
 * scrape path is identical. Reports startup time, load time, and RSS of the
 * whole browser process tree (peak while loading).
 *
 * Env: CHROME_PATH (default /usr/bin/google-chrome), OBSCURA_BIN (default `obscura`).
 * Unavailable backends are skipped. Linux/macOS only (reads RSS via `ps`).
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { BrowserActionModule, BrowserActionService } from '../index';
import { loadCloakPuppeteer } from '../utils/cloak.loader';

const URL = 'https://example.com/';
const LOADS = 3;

interface Backend {
  name: string;
  endpoint: string;
  pid: number;
  stop: () => Promise<void>;
}

// RSS (MB) summed over pid and all its descendants.
function treeRssMb(root: number): number {
  const rows = execFileSync('ps', ['-eo', 'pid=,ppid=,rss='], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .map((l) => l.trim().split(/\s+/).map(Number));
  const pids = new Set([root]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [pid, ppid] of rows)
      if (pids.has(ppid) && !pids.has(pid)) grew = pids.add(pid) && true;
  }
  const kb = rows.reduce((s, [pid, , rss]) => (pids.has(pid) ? s + rss : s), 0);
  return Math.round(kb / 1024);
}

async function startChrome(): Promise<Backend> {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    headless: true,
  });
  return {
    name: 'Chrome',
    endpoint: browser.wsEndpoint(),
    pid: browser.process()!.pid!,
    stop: () => browser.close(),
  };
}

async function startCloak(): Promise<Backend> {
  const browser = await (await loadCloakPuppeteer()).launch({ headless: true });
  return {
    name: 'CloakBrowser',
    endpoint: browser.wsEndpoint(),
    pid: browser.process()!.pid!,
    stop: () => browser.close(),
  };
}

async function startObscura(): Promise<Backend> {
  const child: ChildProcess = spawn(
    process.env.OBSCURA_BIN ?? 'obscura',
    ['serve', '--port', '9333', '--quiet'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  // --quiet silences logs but not the banner; ready once the port answers.
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    const tick = () =>
      fetch('http://127.0.0.1:9333/json/version').then(
        () => resolve(),
        () => setTimeout(tick, 50),
      );
    tick();
  });
  return {
    name: 'Obscura',
    endpoint: 'ws://127.0.0.1:9333/devtools/browser',
    pid: child.pid!,
    stop: async () => {
      child.kill();
    },
  };
}

async function measure(start: () => Promise<Backend>) {
  const t0 = Date.now();
  let backend: Backend;
  try {
    backend = await start();
  } catch (e) {
    return { skipped: (e as Error).message.split('\n')[0] };
  }
  const startupMs = Date.now() - t0;
  const idleMb = treeRssMb(backend.pid);

  @Module({
    imports: [
      BrowserActionModule.forRoot({
        remote: { browserWSEndpoint: backend.endpoint },
        pool: { min: 1, max: 1 },
      }),
    ],
  })
  class AppModule {}
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const service = await app.resolve(BrowserActionService);

  let peakMb = idleMb;
  const sampler = setInterval(() => {
    peakMb = Math.max(peakMb, treeRssMb(backend.pid));
  }, 100);
  const times: number[] = [];
  let title = '';
  try {
    for (let i = 0; i < LOADS; i++) {
      const t = Date.now();
      const r = await service.scrape(URL, { title: 'title' }, { waitUntil: 'load' });
      times.push(Date.now() - t);
      title = String(r.title);
    }
  } finally {
    clearInterval(sampler);
    await app.close(); // remote mode: disconnect only
    await backend.stop();
  }

  return {
    title,
    startupMs,
    firstLoadMs: times[0],
    avgLoadMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    idleRssMb: idleMb,
    peakRssMb: peakMb,
  };
}

if (require.main === module) {
  void (async () => {
    const results: Record<string, unknown> = {};
    for (const [name, start] of [
      ['Chrome', startChrome],
      ['CloakBrowser', startCloak],
      ['Obscura', startObscura],
    ] as const) {
      console.log(`Measuring ${name}...`);
      results[name] = await measure(start);
    }
    console.table(results);
  })();
}
