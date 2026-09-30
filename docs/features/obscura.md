# Obscura Backend

[Obscura](https://github.com/h4ckf0r0day/obscura) is a lightweight headless browser written in Rust (V8, no Chromium) that speaks the Chrome DevTools Protocol. It uses about 30 MB of memory per server (CloakBrowser Chromium needs 200 MB or more) and starts instantly.

The library connects to Obscura through the existing [remote CDP mode](../api-reference.md). **You run and manage the Obscura server yourself.** The library only connects to it.

## 1. Run the server

```bash
# Binary (grab the `-stealth` archive for your platform from GitHub Releases)
obscura serve --port 9222 --stealth

# Docker
docker run -d --name obscura -p 127.0.0.1:9222:9222 h4ckf0r0day/obscura
```

The server is ready when it prints `CDP server: ws://127.0.0.1:9222/devtools/browser`.

## 2. Connect

```ts
BrowserActionModule.forRoot({
  remote: { browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser' },
  pool: { min: 3, max: 3 },
});
```

Named-browser mode works the same way: `forRoot({ name: 'main', remote: { ... } })`.

## Concurrency

- Each pool slot opens its **own CDP connection** to the same server. Tested with 10 simultaneous connections against a single server with no errors. Concurrent `scrapeAll` and `scrapeWithWorkflow` calls stay isolated from each other: each result matches its own URL.
- Cookies do not leak between pool slots, because each slot is its own connection. For isolation per call even when calls share a slot (`pool.max` < concurrency), set `multiContext: true`: each call then gets a fresh browser context.
- For light scraping, keep `--workers 1` (Obscura's default). `--workers 4` was slower in testing because of the router hop. Raise it only if the server becomes CPU-bound.
- `obscura serve --max-connections N` (default 128) caps live CDP connections, each of which gets its own thread and V8 isolate. Connections over the cap are refused with a 503, not queued, so keep `pool.max` (summed across every app pointing at the server) at or below it.
- Cookies and storage are in-memory by default. Pass `--storage-dir <dir>` to persist them across server restarts, the equivalent of a persistent profile. The directory is shared by every connection.
- Obscura is headless-only: there is no headed mode, so `launchOptions.headless` has no effect. Debug with `page.screenshot()` or the workflow `screenshot` action.
- On shutdown, remote mode calls `disconnect()`, not `close()`, so the Obscura server keeps running after `app.close()`.
- If the server dies, calls fail with `Failed to connect to remote Chrome after N attempts`. The pool recovers on the next call once the server is back, with no app restart needed.

## Known limits (Obscura v0.2.3)

| Area | Behaviour | Workaround |
|---|---|---|
| `waitUntil: 'networkidle0' \| 'networkidle2'` | Never resolves (the navigation times out) | Use `'load'` or `'domcontentloaded'` |
| Cloudflare interstitial | Stays on "Just a moment...", so `solveChallenge` returns `'failed'` | Use the CloakBrowser backend for Cloudflare-protected sites |
| Some selectors (e.g. `h1` on example.com) | `$eval` / `waitForSelector` can fail even when the element exists | Use a more specific selector or `evaluate` |
| `page.content()` | Stealth mode inflates the HTML | Extract with selectors instead of full HTML |
| `cloak` options, per-call `cloak` override | Not used in remote mode (the override throws) | Configure stealth with the `obscura serve` flags (`--stealth`, `--proxy`, `--user-agent`) |

Ghost cursor, click, hover, type, cookies, request interception, screenshots, and `evaluateOnNewDocument` all work.

## Example

`src/examples/obscura-example.ts` runs concurrent scrapes plus a ghost-cursor workflow against a running server. The endpoint can be overridden with `OBSCURA_WS`.

```bash
obscura serve --port 9222 --stealth &
pnpm test:examples 8
```

## Compare backends

`src/examples/backend-compare-example.ts` starts plain Chrome, CloakBrowser, and Obscura, loads example.com through the lib on each one, and prints the results. Resident memory covers the whole process tree.

```bash
OBSCURA_BIN=/path/to/obscura CHROME_PATH=/usr/bin/google-chrome pnpm test:examples 9
```

Sample run (Linux x64, headless, 3 loads each):

| Backend | Startup | 1st load | Avg load | Idle RSS | Peak RSS |
|---|---|---|---|---|---|
| Chrome | 529 ms | 496 ms | 233 ms | 904 MB | 1093 MB |
| CloakBrowser | 608 ms | 681 ms | 318 ms | 662 MB | 872 MB |
| Obscura | 69 ms | 385 ms | 287 ms | 18 MB | 28 MB |

A backend that is missing (no binary on the path) is skipped.

