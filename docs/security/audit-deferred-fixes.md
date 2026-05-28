# Security Audit — Deferred Architectural Fixes

> **Status:** Identified and documented, not yet implemented.  
> **Audit Date:** 2025-05-28  
> **Related:** See `graphify-out/memory/` for full audit findings and applied patches.

---

## Item 1: Workflow Validation Layer

### Problem

`WorkflowDefinition` is a declarative JSON format that maps directly to privileged browser operations with **zero intermediate validation**. Every field flows straight to execution:

| Workflow Field | Maps To | Current Behavior |
|---|---|---|
| `action` | `dispatchAction()` switch case | Any string accepted; throws `Unknown pipe type` at runtime only |
| `value` | Browser API arguments | Passed raw to `page.goto()`, `page.evaluate()`, `page.screenshot()`, etc. |
| `target.value` | CSS/XPath selectors | Used directly in `page.$()` / `document.evaluate()` |
| `options` | Action parameters (timeout, retry, delay, etc.) | No bounds checking; `retry: Infinity` causes infinite loops |
| `cloak` | Per-workflow stealth config override | Bypasses module-level cloak validation entirely |
| `interceptResource` | Resource blocking toggle | No validation; boolean-ish value accepted |

An attacker who can submit a `WorkflowDefinition` (e.g., via an API endpoint, a webhook, a config file, or a queue message) has **full control** over:
- Which browser operations run
- What URLs are visited
- What JavaScript executes
- What files are written
- What proxies/extensions are loaded
- How long the process hangs

### Why Deferred

Implementing a proper validation layer is **architectural**, not a quick patch. It requires:

1. **New file:** `src/validators/workflow.validator.ts`
   - Schema validation for `WorkflowDefinition`, `WorkflowAction`, `ActionTarget`, `ActionOptions`
   - Whitelist of allowed `action` values
   - Bounds checking for `retry`, `retryDelay`, `timeout`, `delay`
   - URL protocol validation for `navigate` / `screenshot` / `evaluate` actions
   - Path sanitization for `screenshot` paths
   - `cloak` override restrictions (e.g., disallow per-workflow cloak if module config disables it)
   - `PipeConfig` validation (type exists, properties are safe, regex patterns are safe)

2. **Integration points:**
   - `BrowserActionService.executeAction()` — call validator before dispatch
   - `BrowserActionService.scrapeWithWorkflow()` — validate full workflow before execution
   - `BrowserActionService.scrape()` — validate any inline pipe configs
   - Potentially: `CleansingService.buildPipes()` — validate `PipeConfig[]` independently

3. **Error handling strategy:**
   - Fail fast at workflow start (not mid-execution)
   - Clear validation errors that tell the caller which action/field is invalid
   - Option to run in "lenient mode" (skip unknown actions) vs "strict mode" (throw)

4. **Breaking change risk:**
   - Existing users may rely on passing arbitrary properties in `PipeConfig` or `ActionOptions`
   - The current `PipeConfig` type is `[key: string]: unknown` — extremely permissive
   - A validator that enforces strict schemas would break legitimate (if unusual) use cases

### Recommended Implementation

```typescript
// src/validators/workflow.validator.ts
export class WorkflowValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly action?: string,
    message?: string,
  ) {
    super(message || `Invalid workflow field: ${field}`);
  }
}

export function validateWorkflow(
  workflow: WorkflowDefinition,
  options?: { allowCloakOverride?: boolean; maxActions?: number },
): void {
  // 1. Validate action count
  if (workflow.actions.length > (options?.maxActions ?? 100)) {
    throw new WorkflowValidationError('actions', undefined, 'Too many actions');
  }

  // 2. Validate each action
  const validActions = new Set([/* ... */]);
  for (const action of workflow.actions) {
    if (!validActions.has(action.action)) {
      throw new WorkflowValidationError('action', action.action, 'Invalid action type');
    }
    if (action.options?.retry !== undefined && action.options.retry > 100) {
      throw new WorkflowValidationError('options.retry', action.action);
    }
    if (action.options?.retryDelay !== undefined && action.options.retryDelay > 300_000) {
      throw new WorkflowValidationError('options.retryDelay', action.action);
    }
    // ... etc
  }

  // 3. Validate cloak override policy
  if (workflow.cloak && !options?.allowCloakOverride) {
    throw new WorkflowValidationError('cloak', undefined, 'Per-workflow cloak override is disabled');
  }
}
```

### Risk if Not Implemented

- **CRITICAL:** Any endpoint that accepts workflow JSON is an arbitrary code execution surface
- **HIGH:** Attackers can cause infinite loops, write arbitrary files, or exfiltrate data
- The individual patches (URL validation, retry caps, etc.) mitigate the **symptoms** but the root cause — untrusted input driving execution — remains

---

## Item 2: Proxy Credential Leakage in Logs

### Problem

`CloakOptions.proxy` contains sensitive credentials:

```typescript
interface CloakOptions {
  proxy?: {
    server: string;      // e.g., "http://proxy.example.com:8080"
    username?: string;   // e.g., "myuser"
    password?: string;   // e.g., "mypassword"
  };
}
```

These values are:
1. Spread into `cloakOptions` in `BrowserPoolService.launchLocal()`
2. Passed to CloakBrowser's `launch()` / `launchPersistentContext()`
3. Potentially logged by:
   - `BrowserPoolService` debug logs (though currently not logging the full options)
   - Puppeteer/CloakBrowser internal logging
   - Error stack traces from failed launches
   - Any future logging added to the launch path

Additionally, `browserURL` and `browserWSEndpoint` in `RemoteOptions` may contain embedded credentials:
- `ws://user:pass@chrome.example.com:9222`
- `http://user:pass@chrome.example.com:9222/json/version`

### Why Deferred

1. **Scope is broad:** Need to audit **all log sites** across 6+ files for accidental credential exposure
2. **External dependency:** CloakBrowser and puppeteer-core may log internally — outside our control
3. **No current evidence of leakage:** The existing `BrowserPoolService` logs only log the mode (`Remote CDP` vs `Local CloakBrowser`), not the full options
4. **Remediation is mechanical but tedious:** Requires adding a `sanitizeForLog()` utility and applying it at every log site that touches options

### Recommended Implementation

```typescript
// src/utils/sanitize.util.ts
export function sanitizeForLog(value: unknown): unknown {
  if (typeof value === 'string') {
    // Mask credentials in URLs
    return value.replace(
      /(\w+:\/\/)([^:]+):([^@]+)@/g,
      '$1***:***@',
    );
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (['password', 'secret', 'token', 'apiKey'].includes(k)) {
        result[k] = '***';
      } else {
        result[k] = sanitizeForLog(v);
      }
    }
    return result;
  }
  return value;
}
```

Apply to:
- `BrowserPoolService` — sanitize `cloakOptions` before any debug logging
- Any error handlers that stringify options into error messages
- Consider monkey-patching `console.log` in production (not recommended, but common)

### Risk if Not Implemented

- **MEDIUM:** Proxy credentials may leak into log aggregation systems (Datadog, Splunk, CloudWatch)
- **MEDIUM:** If logs are exposed (e.g., via a debug endpoint, a support ticket, or a breach), attacker gains proxy access
- Lower immediate risk because current code doesn't actively log the full options

---

## Summary

| Item | Severity | Effort | Priority | Blocker |
|---|---|---|---|---|
| Workflow Validation Layer | **CRITICAL** | High | P0 | Architectural; requires new module + integration points |
| Proxy Credential Leakage | MEDIUM | Medium | P2 | Broad scope; mechanical but tedious audit |

Both items are **documented and tracked** in this file. They should be scheduled as follow-up work after the current patch set is reviewed and merged.
