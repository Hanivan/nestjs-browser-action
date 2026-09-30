/**
 * Ghost cursor: human-like click/hover + Cloudflare challenge solving.
 * Run headed to watch the cursor: HEADLESS=false pnpm test:examples <n>
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { BrowserActionModule, BrowserActionService } from '../index';
import type { WorkflowDefinition } from '../index';

const headless = process.env.HEADLESS !== 'false';

@Module({
  imports: [
    BrowserActionModule.forRoot({
      launchOptions: { headless },
      pool: { min: 1, max: 1 },
    }),
  ],
})
class AppModule {}

// Example 1: CF interstitial ("Just a moment...") — managed mode usually auto-passes.
async function cfInterstitial(service: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    cursor: { type: 'ghost', debug: !headless },
    actions: [
      { id: 'cf', action: 'solveChallenge' },
      { id: 'title', action: 'evaluate', value: 'document.title' },
    ],
  };

  const result = await service.scrapeWithWorkflow<{
    cf: string;
    title: string;
  }>('https://lkmn.link/', workflow);

  console.log('CF interstitial:', result.data);
}

// Example 2: checkboxes behind CF — ghost clicks on real inputs.
async function checkboxes(service: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    cursor: { type: 'ghost', debug: !headless },
    actions: [
      { id: 'cf', action: 'solveChallenge' },
      { action: 'waitFor', target: { type: 'css', value: '#myCheckbox' } },
      { action: 'click', target: { type: 'css', value: '#myCheckbox' } },
      { action: 'click', target: { type: 'css', value: '#multichk1' } },
      { action: 'click', target: { type: 'css', value: '#multichk3' } },
      {
        id: 'state',
        action: 'evaluate',
        value: `() => ({
          single: document.querySelector('#myCheckbox').checked,
          message: document.querySelector('#message').textContent.trim(),
          multi: [...document.querySelectorAll('.myCheckbox')].map((c) => c.checked),
        })`,
      },
    ],
  };

  const result = await service.scrapeWithWorkflow<{
    cf: string;
    state: { single: boolean; message: string; multi: boolean[] };
  }>('https://qaautomationlabs.com/testing/checkbox.php', workflow);

  console.log('Checkboxes:', JSON.stringify(result.data));
}

// Example 3: JS-rendered Turnstile (no `.cf-turnstile` wrapper) — solveChallenge
// finds it by its response input and ghost-clicks the checkbox if managed mode
// doesn't auto-pass. Does not submit the form.
async function turnstileWidget(service: BrowserActionService) {
  const workflow: WorkflowDefinition = {
    version: '1.0',
    cursor: { type: 'ghost', debug: !headless },
    actions: [
      {
        action: 'waitFor',
        target: { type: 'css', value: '[name="cfTurnstileResponse"]' },
      },
      { id: 'cf', action: 'solveChallenge' },
    ],
  };

  const result = await service.scrapeWithWorkflow<{ cf: string }>(
    'https://newda.linkeun.com/',
    workflow,
  );

  console.log('Turnstile widget:', result.data.cf);
}

if (require.main === module) {
  void (async () => {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    const service = await app.resolve(BrowserActionService);
    try {
      await cfInterstitial(service);
      await checkboxes(service);
      await turnstileWidget(service);
    } finally {
      await app.close();
    }
  })();
}
