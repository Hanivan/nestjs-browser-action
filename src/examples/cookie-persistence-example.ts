import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { BrowserActionModule, BrowserActionService } from '../index';
import type { WorkflowDefinition } from '../index';

/**
 * Example: Login workflow with cookie persistence
 *
 * This workflow demonstrates how to:
 * 1. Try to load an existing session
 * 2. Check if already logged in
 * 3. Perform login if needed
 * 4. Save the session for future use
 */
export const loginWorkflow: WorkflowDefinition = {
  version: '1.0',
  actions: [
    // Try to load existing session (skip if not found)
    {
      action: 'loadCookies',
      value: 'user-session',
      onError: 'skip',
    },

    // Check if we're already logged in (presence of welcome span)
    {
      action: 'waitFor',
      target: { type: 'css', value: 'span.text-lg.font-semibold' },
      options: { timeout: 5000 },
      condition: {
        ifExists: { type: 'css', value: 'span.text-lg.font-semibold' },
      },
      onError: 'skip',
    },

    // If not logged in, navigate to login page
    {
      action: 'navigate',
      value: 'https://www.scrapingcourse.com/login',
      condition: {
        unlessExists: { type: 'css', value: 'span.text-lg.font-semibold' },
      },
    },

    // Wait for login form
    {
      action: 'waitFor',
      target: { type: 'css', value: '#email' },
      condition: {
        unlessExists: { type: 'css', value: 'span.text-lg.font-semibold' },
      },
    },

    // Fill in email
    {
      action: 'type',
      target: { type: 'css', value: '#email' },
      value: '${email}',
      options: { scrollTo: true },
      condition: {
        unlessExists: { type: 'css', value: 'span.text-lg.font-semibold' },
      },
    },

    // Fill in password
    {
      action: 'type',
      target: { type: 'css', value: '#password' },
      value: '${password}',
      options: { scrollTo: true },
      condition: {
        unlessExists: { type: 'css', value: 'span.text-lg.font-semibold' },
      },
    },

    // Click login button
    {
      action: 'click',
      target: { type: 'css', value: 'button[type="submit"]' },
      options: { scrollTo: true, waitForNavigation: true },
      condition: {
        unlessExists: { type: 'css', value: 'span.text-lg.font-semibold' },
      },
    },

    // Wait for successful login
    {
      action: 'waitFor',
      target: { type: 'css', value: 'span.text-lg.font-semibold' },
      options: { timeout: 10000 },
      condition: {
        unlessExists: { type: 'css', value: 'span.text-lg.font-semibold' },
      },
    },

    // Save session for future use
    {
      action: 'saveCookies',
      value: 'user-session',
      options: {
        overwrite: true,
        metadata: {
          username: '${email}',
          loginMethod: 'email',
        },
      },
      condition: {
        unlessExists: { type: 'css', value: 'span.text-lg.font-semibold' },
      },
    },

    // Extract welcome text (e.g. "Welcome, Scraper!")
    {
      id: 'username',
      action: 'extract',
      target: { type: 'css', value: 'span.text-lg.font-semibold' },
    },
  ],
  onError: {
    screenshot: true,
    screenshotPath: './error-screenshot.png',
    continue: false,
  },
};

@Module({
  imports: [
    BrowserActionModule.forRoot({
      launchOptions: { headless: process.env.HEADLESS !== 'false' },
      pool: { min: 1, max: 1 },
      cookies: {
        enabled: true,
        cookiesDir: './storage/cookies',
        defaultSessionName: 'main-session',
      },
    }),
  ],
})
class AppModule {}

/**
 * Example: Usage in a service
 */
export async function runLoginWorkflow(
  actionHelpers: BrowserActionService,
  email: string,
  password: string,
) {
  const result = await actionHelpers.scrapeWithWorkflow<{
    username: string;
  }>('https://www.scrapingcourse.com/', loginWorkflow, {
    email,
    password,
  });

  console.log('Workflow result:', result);
  console.log('Username:', result.data.username);

  return result;
}

if (require.main === module) {
  void (async () => {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    const service = await app.resolve(BrowserActionService);
    try {
      await runLoginWorkflow(service, 'admin@example.com', 'password');
    } finally {
      await app.close();
    }
  })();
}
