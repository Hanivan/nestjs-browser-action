# Cookie Management

Persistent cookie management for session handling and authentication state preservation.

## Overview

The cookie management system allows you to:

- (^_^) **Save** cookies after login for reuse
- (｡•̀ᴗ-)✧ **Load** saved cookies to restore sessions
- (╥_╥) **Clear** cookie sessions when no longer needed
- (°_°)! **List** all saved sessions
- (o_o) **Check** if session exists

## CookieService

### Signature

```typescript
class CookieService {
  saveCookies(
    page: Page,
    sessionName: string,
    options?: SaveCookieOptions
  ): Promise<void>;

  loadCookies(
    page: Page,
    sessionName: string,
    options?: LoadCookieOptions
  ): Promise<void>;

  deleteCookies(sessionName: string): Promise<void>;

  clearAllCookies(): Promise<void>;

  listCookies(): Promise<CookieSessionInfo[]>;

  hasCookieSession(sessionName: string): Promise<boolean>;
}
```

## Examples

### Basic Save & Load

```typescript
import { CookieService, PageService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class AuthService {
  constructor(
    private readonly cookieService: CookieService,
    private readonly pageService: PageService,
  ) {}

  async loginAndSave() {
    const page = await this.pageService.navigateTo('https://example.com/login');

    // Perform login
    await page.type('#email', 'user@example.com');
    await page.type('#password', 'password123');
    await page.click('#login-button');
    await page.waitForNavigation();

    // Save cookies after successful login
    await this.cookieService.saveCookies(page, 'user-session', {
      metadata: {
        username: 'user@example.com',
        loginTime: new Date().toISOString(),
      },
    });

    await this.pageService.closePage();
  }

  async reuseSession() {
    const page = await this.pageService.navigateTo('https://example.com');

    // Load saved session
    await this.cookieService.loadCookies(page, 'user-session');

    // Already logged in!
    const welcomeElement = await page.$('.user-profile');
    console.log('Logged in:', welcomeElement !== null);

    await this.pageService.closePage();
  }
}
```

### Workflow Integration

#### Save Cookies After Login

```typescript
const workflow = {
  version: '1.0' as const,
  actions: [
    {
      action: 'navigate' as const,
      value: 'https://example.com/login',
    },
    {
      action: 'type' as const,
      target: { type: 'css' as const, value: '#email' },
      value: 'user@example.com',
    },
    {
      action: 'type' as const,
      target: { type: 'css' as const, value: '#password' },
      value: 'password123',
    },
    {
      action: 'click' as const,
      target: { type: 'css' as const, value: '#login-button' },
      options: { waitForNavigation: true },
    },
    {
      // Save cookies after successful login
      action: 'saveCookies' as const,
      value: 'user-session',
      options: {
        overwrite: true,  // Overwrite if exists
        metadata: {
          username: 'user@example.com',
        },
      },
    },
  ],
};

await this.actionHelpers.scrapeWithWorkflow(workflow);
```

#### Load Cookies Before Actions

```typescript
const workflow = {
  version: '1.0' as const,
  actions: [
    {
      // Load existing session (skip if not found)
      action: 'loadCookies' as const,
      value: 'user-session',
      onError: 'skip' as const,  // Continue if session doesn't exist
    },
    {
      // Check if already logged in
      action: 'waitFor' as const,
      target: { type: 'css' as const, value: '.user-profile' },
      options: { timeout: 5000 },
      onError: 'skip' as const,
    },
    {
      // Navigate to login only if not logged in
      action: 'navigate' as const,
      value: 'https://example.com/login',
      condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
    },
    {
      // Login actions only if not already logged in
      action: 'type' as const,
      target: { type: 'css' as const, value: '#email' },
      value: 'user@example.com',
      condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
    },
    {
      action: 'type' as const,
      target: { type: 'css' as const, value: '#password' },
      value: 'password123',
      condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
    },
    {
      action: 'click' as const,
      target: { type: 'css' as const, value: '#login-button' },
      condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
      options: { waitForNavigation: true },
    },
    {
      // Save session after login
      action: 'saveCookies' as const,
      value: 'user-session',
      options: { overwrite: true },
      condition: { unlessExists: { type: 'css' as const, value: '.user-profile' } },
    },
    {
      id: 'userName',
      action: 'extract' as const,
      target: { type: 'css' as const, value: '.user-profile .name' },
    },
  ],
};

const result = await this.actionHelpers.scrapeWithWorkflow(workflow);
```

### Session Management

#### Check if Session Exists

```typescript
const hasCookieSession = await this.cookieService.hasCookieSession('user-session');
console.log('Session exists:', hasCookieSession);  // true/false
```

#### List All Sessions

```typescript
const sessions = await this.cookieService.listCookies();

console.log('Total sessions:', sessions.length);

sessions.forEach(session => {
  console.log(`Session: ${session.name}`);
  console.log(`  Cookies: ${session.cookieCount}`);
  console.log(`  Saved: ${session.savedAt}`);
  if (session.metadata) {
    console.log(`  Metadata:`, session.metadata);
  }
});
```

#### Delete Specific Session

```typescript
await this.cookieService.deleteCookies('user-session');
console.log('Session deleted');
```

#### Clear All Sessions

```typescript
await this.cookieService.clearAllCookies();
console.log('All sessions cleared');
```

## Configuration

### Module Configuration

```typescript
import { Module } from '@nestjs/common';
import { BrowserActionModule } from '@hanivanrizky/nestjs-browser-action';

@Module({
  imports: [
    BrowserActionModule.forRoot({
      cookies: {
        enabled: true,                    // Enable cookie persistence
        cookiesDir: './cookies',          // Directory for cookie files
        autoSave: false,                   // Auto-save after workflows
        autoLoad: false,                   // Auto-load before workflows
        defaultSessionName: 'default',      // Default session name
      },
    }),
  ],
})
export class AppModule {}
```

### Save Cookie Options

```typescript
interface SaveCookieOptions {
  overwrite?: boolean;              // Overwrite existing session (default: false)
  metadata?: Record<string, unknown>; // Additional metadata to store
}
```

**Examples:**

```typescript
// Don't overwrite existing (default)
await this.cookieService.saveCookies(page, 'session');

// Overwrite if exists
await this.cookieService.saveCookies(page, 'session', {
  overwrite: true,
});

// With metadata
await this.cookieService.saveCookies(page, 'session', {
  metadata: {
    username: 'user@example.com',
    lastLogin: new Date().toISOString(),
    userData: { id: 123, role: 'admin' },
  },
});
```

### Load Cookie Options

```typescript
interface LoadCookieOptions {
  throwIfNotExists?: boolean;  // Throw error if session doesn't exist (default: true)
}
```

**Examples:**

```typescript
// Throw error if not found (default)
try {
  await this.cookieService.loadCookies(page, 'session');
} catch (error) {
  console.error('Session not found:', error.message);
}

// Don't throw, just skip
await this.cookieService.loadCookies(page, 'session', {
  throwIfNotExists: false,
});
```

## File Storage

Cookies are stored as JSON files in the configured directory:

```
cookies/
├── user-session.json
├── admin-session.json
└── default.json
```

### Session File Format

```json
{
  "name": "user-session",
  "cookies": [
    {
      "name": "session",
      "value": "encrypted_value",
      "domain": ".example.com",
      "path": "/",
      "expires": 1735689600,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "savedAt": "2024-01-01T12:00:00.000Z",
  "url": "https://example.com",
  "metadata": {
    "username": "user@example.com"
  }
}
```

## Use Cases

### 1. Login Persistence

```typescript
async loginOnce() {
  // First time: Login and save
  const workflow = {
    version: '1.0' as const,
    actions: [
      { action: 'navigate' as const, value: 'https://example.com/login' },
      { action: 'type' as const, target: { type: 'css' as const, value: '#email' }, value: 'user@ex.com' },
      { action: 'type' as const, target: { type: 'css' as const, value: '#pass' }, value: 'pass' },
      { action: 'click' as const, target: { type: 'css' as const, value: '#login-btn' } },
      { action: 'saveCookies' as const, value: 'my-session', options: { overwrite: true } },
    ],
  };

  await this.actionHelpers.scrapeWithWorkflow(workflow);
}

async useSavedSession() {
  // Later: Just load the saved session
  const workflow = {
    version: '1.0' as const,
    actions: [
      { action: 'navigate' as const, value: 'https://example.com/dashboard' },
      { action: 'loadCookies' as const, value: 'my-session' },
      { action: 'waitFor' as const, target: { type: 'css' as const, value: '.dashboard' } },
      { id: 'data', action: 'extract' as const, target: { type: 'css' as const, value: '.data' } },
    ],
  };

  const result = await this.actionHelpers.scrapeWithWorkflow(workflow);
  console.log('Dashboard data:', result.data.data);
}
```

### 2. Multi-User Sessions

```typescript
// Admin session
await this.cookieService.saveCookies(page, 'admin-session', {
  metadata: { role: 'admin', permissions: ['read', 'write', 'delete'] },
});

// User session
await this.cookieService.saveCookies(page, 'user-session', {
  metadata: { role: 'user', permissions: ['read'] },
});

// Load appropriate session based on user
const sessionName = userRole === 'admin' ? 'admin-session' : 'user-session';
await this.cookieService.loadCookies(page, sessionName);
```

### 3. Session Rotation

```typescript
async rotateSession() {
  const oldSession = 'old-session';
  const newSession = 'new-session';

  const page = await this.pageService.navigateTo('https://example.com');

  // Load old session
  await this.cookieService.loadCookies(page, oldSession, {
    throwIfNotExists: false,
  });

  // Perform actions to get new session
  await page.click('#refresh-token');
  await page.waitForNavigation();

  // Save new session
  await this.cookieService.saveCookies(page, newSession, {
    overwrite: true,
  });

  // Delete old session
  await this.cookieService.deleteCookies(oldSession);

  await this.pageService.closePage();
}
```

### 4. Temporary Sessions

```typescript
async tempWorkflow() {
  const workflow = {
    version: '1.0' as const,
    actions: [
      { action: 'navigate' as const, value: 'https://example.com' },
      { action: 'loadCookies' as const, value: 'temp-session', onError: 'skip' as const },
      // ... workflow actions ...
      { action: 'clearCookies' as const, value: 'temp-session' },  // Cleanup after
    ],
  };

  await this.actionHelpers.scrapeWithWorkflow(workflow);
}
```

## Error Handling

```typescript
async safeCookieLoad(page: Page, sessionName: string) {
  try {
    await this.cookieService.loadCookies(page, sessionName);
    console.log(`Session ${sessionName} loaded successfully`);
  } catch (error) {
    if (error.message.includes('not found')) {
      console.log(`Session ${sessionName} does not exist, skipping...`);
    } else {
      console.error('Failed to load session:', error);
    }
  }
}

async safeCookieSave(page: Page, sessionName: string) {
  try {
    await this.cookieService.saveCookies(page, sessionName, {
      overwrite: false,  // Don't overwrite existing
    });
    console.log(`Session ${sessionName} saved successfully`);
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}
```

## Best Practices

1. **Use descriptive session names:**
   ```typescript
   'user-session-john@example.com'
   'admin-session-2024-01-01'
   ```

2. **Add metadata for context:**
   ```typescript
   metadata: {
     username: 'user@example.com',
     environment: 'production',
     lastLogin: new Date().toISOString(),
   }
   ```

3. **Handle missing sessions gracefully:**
   ```typescript
   onError: 'skip'  // Skip action if session doesn't exist
   throwIfNotExists: false  // Don't throw error
   ```

4. **Clean up old sessions:**
   ```typescript
   // Delete when no longer needed
   await this.cookieService.deleteCookies('temp-session');
   ```

5. **Use overwrite carefully:**
   ```typescript
   overwrite: true  // Only when intentionally refreshing session
   overwrite: false  // Default: preserve existing sessions
   ```

## Features

- **Persistent Storage:** Cookies saved to disk as JSON
- **Session Metadata:** Store additional context with sessions
- **Multiple Sessions:** Support multiple concurrent sessions
- **Error Tolerant:** Graceful handling of missing sessions
- **Workflow Integration:** Use in workflows with save/load/clear actions
- **Type-Safe:** Full TypeScript support
- **URL Validation:** Loaded session URLs are validated (only `http:`/`https:` allowed)
- **Path Traversal Prevention:** `cookiesDir` options are restricted to the configured directory

## Security

### Stored URL Validation

When `loadCookies()` restores a session, the saved `url` field is validated before navigating. Only `http:` and `https:` protocols are allowed, preventing stored open redirects to `file:`, `javascript:`, or other protocols.

### Path Traversal Prevention

The `cookiesDir` option in `saveCookies()` and `loadCookies()` is validated to ensure it stays within the configured cookies directory. Attempting to use a path outside the base directory throws an error.

### Session Name Sanitization

Session names are sanitized before use in filesystem paths. Only alphanumeric characters, underscores, and hyphens are allowed. Special characters are replaced with underscores.

## Related Methods

- [Workflow Actions](../workflow-actions.md#cookie-actions) - Cookie workflow actions
- [scrapeWithWorkflow()](../methods/workflow.md) - Workflow-based automation
- [PageService](../methods/browser-control.md#pageservice) - Page management

## See Also

- [Workflow Documentation](../methods/workflow.md)
- [Cookie Options](../api-reference.md#cookie-options)
