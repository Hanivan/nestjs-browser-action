import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';
import type { WorkflowDefinition } from '@hanivanrizky/nestjs-browser-action';

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

    // Check if we're already logged in
    {
      action: 'waitFor',
      target: { type: 'css', value: '.user-profile' },
      options: { timeout: 5000 },
      condition: { ifExists: { type: 'css', value: '.user-profile' } },
      onError: 'skip',
    },

    // If not logged in, navigate to login page
    {
      action: 'navigate',
      value: 'https://example.com/login',
      condition: { unlessExists: { type: 'css', value: '.user-profile' } },
    },

    // Wait for login form
    {
      action: 'waitFor',
      target: { type: 'css', value: '#email' },
      condition: { unlessExists: { type: 'css', value: '.user-profile' } },
    },

    // Fill in email
    {
      action: 'type',
      target: { type: 'css', value: '#email' },
      value: '${email}',
      options: { scrollTo: true },
      condition: { unlessExists: { type: 'css', value: '.user-profile' } },
    },

    // Fill in password
    {
      action: 'type',
      target: { type: 'css', value: '#password' },
      value: '${password}',
      options: { scrollTo: true },
      condition: { unlessExists: { type: 'css', value: '.user-profile' } },
    },

    // Click login button
    {
      action: 'click',
      target: { type: 'css', value: 'button[type="submit"]' },
      options: { scrollTo: true, waitForNavigation: true },
      condition: { unlessExists: { type: 'css', value: '.user-profile' } },
    },

    // Wait for successful login
    {
      action: 'waitFor',
      target: { type: 'css', value: '.user-profile' },
      options: { timeout: 10000 },
      condition: { unlessExists: { type: 'css', value: '.user-profile' } },
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
      condition: { unlessExists: { type: 'css', value: '.user-profile' } },
    },

    // Extract user data (works whether we just logged in or reused session)
    {
      id: 'username',
      action: 'extract',
      target: { type: 'css', value: '.user-profile .username' },
    },
  ],
  onError: {
    screenshot: true,
    screenshotPath: './error-screenshot.png',
    continue: false,
  },
};

/**
 * Example: Module configuration
 */
export const moduleConfig = {
  imports: [
    BrowserActionModule.forRoot({
      launchOptions: { headless: true },
      cookies: {
        enabled: true,
        cookiesDir: './storage/cookies',
        defaultSessionName: 'main-session',
      },
    }),
  ],
};

/**
 * Example: Usage in a service
 */
export async function runLoginWorkflow(
  actionHelpers: any,
  email: string,
  password: string,
) {
  const result = await actionHelpers.scrapeWithActions<{
    username: string;
  }>('https://example.com', loginWorkflow, {
    email,
    password,
  });

  console.log('Workflow result:', result);
  console.log('Username:', result.data.username);

  return result;
}
