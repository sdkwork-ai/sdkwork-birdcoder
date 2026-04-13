# BirdCoder Workbench Runtime Design

## Goal

Tighten the BirdCoder workbench so `code`, `studio`, and `terminal` share one kernel contract for engine selection, runtime sessions, and local persistence. The target is a stronger AI IDE runtime without changing the current product shape.

## Recommended Approach

### Option A: Tighten the existing kernel

- Keep the current package topology and extend `sdkwork-birdcoder-commons` as the single runtime contract layer.
- Split `codeEngineId` from chat model selection so engine routing and model choice stop leaking into each other.
- Make terminal sessions project-aware and restorable from SQLite-backed storage.
- Move prompt/history state off raw `localStorage` calls and onto the existing storage bridge.

### Option B: Rebuild page state per mode

- Rewrite `CodePage`, `StudioPage`, and `TerminalPage` around new mode-specific stores.
- This gives cleaner page code, but it duplicates runtime rules and increases migration risk.

### Option C: Add a new host runtime package first

- Extract a host-only registry before touching UI/runtime behavior.
- This may be useful later, but it does not solve the current user-facing gaps fast enough.

## Chosen Design

Use Option A.

### Runtime contracts

- `WorkbenchPreferences` owns `codeEngineId` and a separate `codeModelId`.
- `UniversalChat` consumes engine and model as separate inputs.
- `CodePage` and `StudioPage` share the same engine/model preference flow.

### Terminal runtime

- Terminal snapshots become project-aware through `workspaceId` and `projectId`.
- Layout persistence is keyed per project, not one global layout for every workspace.
- The terminal UI exposes recent session restore so Codex, Gemini, Claude Code, and OpenCode CLI tabs can be resumed quickly.

### Local persistence

- Chat prompt history, saved prompts, and per-chat input history move to `getStoredJson/setStoredJson`.
- Desktop keeps using SQLite through the existing Tauri bridge; web/mock still falls back to namespaced browser storage.
- Structured terminal session columns remain the source of truth for runtime recovery.

## Out of Scope

- Replacing the current mock terminal renderer with a full PTY backend in this slice.
- Reworking unrelated user/profile/settings storage outside the runtime changes above.
