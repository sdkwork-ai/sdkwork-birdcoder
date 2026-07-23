# Development

Read the root `AGENTS.md`, `sdkwork.app.config.json`, the local component
spec, and the task-selected SDKWork standard before editing.

## Integration Rule

```text
composition root
  -> generated owner SDK client
  -> feature service or typed port
  -> UI
```

- Projects, composition, Sessions, Turns, Session Items, Interactions, and
  Runtime Bindings use the Agents App SDK.
- Skills use the Skills App SDK.
- An independently enabled human messaging feature uses the IM SDK. AI
  assistant rows always remain Agents Session Items.
- All protected clients use the application TokenManager.
- Tauri filesystem, Git, worktree, and terminal behavior uses host adapters.

Do not add raw HTTP, manual auth headers, copied DTOs, generated transport
imports, local business tables, Project/Session aliases, or compatibility
fallbacks.

## Commands

```bash
pnpm dev:desktop
pnpm dev:browser:standalone
pnpm build:server
pnpm docs:dev

pnpm check:domain-ownership
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:local-business-storage-boundary
pnpm typecheck
pnpm lint
```

Generation and alignment commands may change files. Inspect their diff, then
run the corresponding read-only validator. Generated files are never edited by
hand.

## Pre-Launch Cutover

When an owner contract replaces an obsolete local capability, remove the local
route, service, DTO, persistence, tests, and documentation in the same change.
Do not keep a dormant branch for compatibility.
