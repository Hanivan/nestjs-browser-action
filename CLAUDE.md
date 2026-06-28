# CLAUDE.md

## Project Overview
NestJS library (`@hanivanrizky/nestjs-browser-action`) — stealth browser automation with CloakBrowser + puppeteer-core. Provides scraping, workflow execution, data cleansing, cookie management, and a connection pool. Published to npm.

## Tech Stack
- **Runtime**: Node ≥18, TypeScript 5, NestJS 11
- **Browser**: CloakBrowser (stealth) + puppeteer-core 24
- **Cleansing**: PipeEngine + 33 built-in pipes (luxon, jsonpath-plus, libxmljs2, html-entities)
- **Package manager**: pnpm 11 — use `pnpm` for all installs
- **Test**: Jest 30 + ts-jest; **Lint**: ESLint 9 + typescript-eslint; **Format**: Prettier

## Repository Structure
```
src/
  browser-action.module.ts   # DynamicModule: forRoot / forRootAsync / register
  services/
    browser-action.service.ts  # scrape / scrapeAll / scrapeWithWorkflow / scrapeContainerFields
    browser-pool.service.ts    # connection pool
    browser-manager.service.ts
    page.service.ts
    cleansing.service.ts       # registerPipe(s), buildPipes (legacy), cleanseWithProfile
    cookie.service.ts
  pipes/
    pipe-engine.ts             # PipeEngine.apply(value, CleanerStepRules, url?)
    pipe-registry.ts           # PIPE_REGISTRY — mutable Record<string, PipeClass>
    profiles.ts                # CLEANSING_PROFILES keyed by CleansingProfile enum
    profiles/                  # price / phone / email / date / currency profiles
    *.pipe.ts                  # 33 concrete pipe implementations
  enums/                       # CleansingType, CleansingProfile, …
  interfaces/                  # CleansingOptions, ScrapeCleansingOptions, WorkflowOptions, …
  types/                       # decode-html.d.ts and other ambient declarations
examples/                      # runnable usage patterns (not compiled, excluded from tsconfig)
docs/features/                 # pipes.md and other feature docs
test/                          # e2e specs (jest-e2e.json config)
```

## Development Commands
```bash
pnpm install                  # install deps
pnpm approve-builds --all     # approve build scripts non-interactively (e.g. libxmljs2)
pnpm build                    # nest build → dist/
pnpm typecheck                # tsc --noEmit (zero errors expected)
pnpm format                   # prettier --write src/ test/
pnpm lint                     # eslint --fix (zero errors expected; warnings OK in src/)
pnpm test                     # jest (363 tests, 37 suites)
pnpm test:cov                 # jest --coverage
pnpm test:e2e                 # jest --config ./test/jest-e2e.json
pnpm release                  # release-it (bumps version, changelog, git tag)
```

## Build & Test
- `pnpm build` compiles to `dist/` via `nest build`; `examples/` is excluded from tsconfig
- Jest rootDir is `src/`; test regex `.*\.spec\.ts$`; environment `node`
- `libxmljs2` is a native addon — rebuild after OS/Node upgrades: `pnpm rebuild libxmljs2`
- e2e tests live in `test/` with separate `jest-e2e.json` config
- `dist/` is gitignored and excluded from ESLint; lint warnings on `dist/` files are irrelevant
- To run a single spec: `pnpm test -- browser-action.service.evaluate` (pass the spec filename stem — Jest 30 removed `--testPathPattern`; `--testPathPatterns` doesn't match rootDir-relative paths)

## Code Style
- Single quotes, trailing commas (Prettier config in `.prettierrc`)
- `noImplicitAny: false` — avoid `any` in production code; use typed casts (`as unknown as T`)
- Spec files: `no-unsafe-argument` is active — cast with `as unknown as ExpectedType`, not `as any`
- Empty catch blocks require a comment: `catch { /* reason */ }`
- Third-party packages without types → add ambient declaration in `src/types/<pkg>.d.ts`
- ESLint config: `eslint.config.mjs` (flat config, ESLint 9); spec files have relaxed unsafe rules

## Architecture
- **PipeEngine** (`src/pipes/pipe-engine.ts`): core cleansing engine. `apply(value, rules, url?)` runs rules in order: `decode → toLowerCase → toUpperCase → trim → replace[] → custom[] → collapse whitespace`
- **CleanerStepRules**: `{ trim?, toLowerCase?, toUpperCase?, decode?, replace?, merge?, custom? }` — the primary cleansing config format used in `scrape()`, `scrapeAll()`, `scrapeContainerFields()`, workflow `cleanse` action
- **PIPE_REGISTRY**: module-level mutable `Record<string, PipeClass>` — 33 built-in entries; extend with `PIPE_REGISTRY['my-type'] = MyPipe` or `CleansingService.registerPipe()`
- **CleansingService**: still exposes `buildPipes(PipeConfig[])` (legacy) and `cleanseWithProfile()`; `registerPipe`/`registerPipes` silently overwrite (no throw on collision)
- **BrowserActionService** uses `PipeEngine` directly (private field); does NOT call `CleansingService.cleanse()` for scraping
- **CLEANSING_PROFILES**: 5 preset `CleanerStepRules` objects (price, phone, email, date, currency) keyed by `CleansingProfile` enum
- Module registration: `forRoot(options)` / `forRootAsync(options)` for full DI; `register(options)` for lightweight use

## Database
N/A — this is a library with no database dependency.

## API
N/A — this is a library, not a server. Public API is exported from `src/index.ts`.
Key exports: `BrowserActionModule`, `BrowserActionService`, `CleansingService`, `PipeEngine`, `PIPE_REGISTRY`, `CleanerStepRules`, `CleansingType`, `CleansingProfile`, `CLEANSING_PROFILES`

## Environment Variables
None required. All configuration is passed via `BrowserActionModule.forRoot(options)`:
- `cloak` / `remote` / `pool` — browser connection options
- `cookies` — cookie persistence options
- `logLevel` — NestJS log level
- `customPipes` — `Record<string, CleansingPipeClass>` registered on startup

## Deployment
Published to npm as `@hanivanrizky/nestjs-browser-action`. Release flow:
1. `pnpm release` — runs release-it (conventional changelog, git tag, npm publish via `prepublishOnly`)
2. `prepublishOnly` runs `pnpm build` automatically before publish

## Git Workflow
- Main branch: `main`
- Conventional commits (release-it uses `@release-it/conventional-changelog`)
- Husky pre-commit hook runs lint/format — fix before committing, never use `--no-verify`

## Coding Rules
- No `any` in production source; use `as unknown as T` for deliberate type boundary crossings
- Missing types for a package → add `src/types/<pkg>.d.ts` ambient module declaration
- `registerPipe` / `registerPipes` silently overwrite — no need to guard against duplicates
- `PipeEngine.apply()` always returns `string` even after numeric pipes (e.g. `TO_NUMBER`)
- Do not add abstractions, error handling, or features beyond what is asked

## Testing Rules
- Spec files mirror source files (`foo.ts` → `foo.spec.ts`) in the same directory
- Use `as unknown as ExpectedType` (not `as any`) when passing wrong types to test edge cases
- Do NOT mock `PipeEngine` or `CleansingService.cleanse()` in integration tests — use real instances
- `CleansingService` in unit tests can be provided as `useValue: {}` when not under test
- `mockPage` typed as `Page` via `{} as unknown as Page` (not `Partial<Page>`) to satisfy overloads
- Invalid profile name passed to `cleanseWithProfile` returns input unchanged (no throw)
- Unknown pipe types in `PipeEngine.apply()` are silently skipped (no throw)
- Never replace `fs` wholesale in `jest.mock` — always spread `jest.requireActual<typeof import('fs')>('fs')` and override only the methods you need; a bare `jest.mock('fs', () => ({ ... }))` breaks `libxmljs2` bindings (`fs.accessSync` becomes undefined → `TypeError: exists is not a function`)

## Security Rules
- Never commit credentials or `.env` files (none are used by this library)
- `socks-proxy-agent` and `mmdb-lib` are optional dependencies — do not require them unconditionally

## AI Agent Instructions
- Always run `pnpm typecheck && pnpm lint` after editing source files
- After adding tests, update the badge in `README.md` (line 5): `[![Tests: N passed](...)]()` to match actual count from `pnpm test`
- `pnpm approve-builds --all` (not `--yes`) for non-interactive build script approval
- `libxmljs2` may need manual rebuild (`pnpm rebuild libxmljs2`) if native bindings are missing
- When writing cleansing options, use `CleanerStepRules` object format — NOT the legacy `PipeConfig[]` array format
- `dist/` ESLint errors are irrelevant — only lint `src/`

## Common Tasks
**Add a custom pipe**: extend `CleansingPipe`, register with `PIPE_REGISTRY['my-type'] = MyPipe`
**Use a preset profile**: `service.cleanseWithProfile(value, CleansingProfile.PRICE)`
**Cleanse in scrape**: `service.scrape(url, selectors, { pipes: { field: { trim: true, toLowerCase: true } } })`
**Workflow cleanse action**: `{ action: 'cleanse', id: 'out', value: '${var}', options: { pipes: { trim: true } } }`
**Release**: `pnpm release` (runs build + changelog + tag + publish automatically)

## Known Issues
- `libxmljs2` native addon must be compiled for the current Node/OS — rebuild after upgrades
- `dist/` directory triggers ESLint project-service errors when linted — always scope lint to `src/`
- `PipeEngine.apply()` returns `string` even for numeric transform pipes; callers must parse if needed
