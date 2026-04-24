# BirdCoder Project And Session Refresh Design

## Goal

Add production-grade refresh behavior for BirdCoder projects and coding sessions so the UI can reload authoritative engine-backed state instead of only re-rendering cached local data.

The primary target is Codex compatibility because the current product already discovers and mirrors native Codex sessions. The design must also establish a reusable refresh contract for other engines and server-backed sessions.

## Problem

- The current UI has no explicit project-level or session-level refresh action.
- `useProjects.refreshProjects()` only reloads the project list and local mirrored session state. It does not guarantee a reload from the engine's authoritative source.
- Native Codex integration currently mirrors session summaries from `CODEX_HOME/sessions/*.jsonl`, but it does not parse and sync session messages into `BirdCoderCodingSession.messages`.
- The app therefore cannot satisfy the required behavior:
  - project refresh should reload the current engine's session list
  - session refresh should reload the selected session's message list
- If the feature is implemented only in the page layer, Code and Studio will drift and engine-specific logic will spread into UI components.

## Options Considered

### Option A: UI-only refresh

- Add refresh buttons and wire both actions to `refreshProjects()`.
- This is the fastest implementation, but it is only a view refresh.
- It does not reload Codex-native messages and does not provide truthful engine synchronization.

### Option B: Engine-aware authoritative refresh pipeline

- Add a shared workbench refresh orchestrator.
- Project refresh reloads engine-native session inventory, remirrors sessions, refreshes project lists, and refreshes top-level session inventory.
- Session refresh reloads the selected session from the engine's authority and synchronizes messages into local session storage.
- This matches the required user experience and establishes a reusable multi-engine contract.

### Option C: Global event-bus refresh framework first

- Build a global refresh bus across App, Code, Studio, and Terminal.
- This can unify refreshes in the long term, but it adds unnecessary framework work before the core refresh truth exists.

## Chosen Design

Use Option B.

The product needs truthful refresh behavior, not a cosmetic reload. The implementation must therefore introduce a shared engine-aware refresh pipeline and use it from both Code and Studio surfaces.

## Architecture

### 1. Shared refresh orchestrator

Add a new workbench-level refresh module in `@sdkwork/birdcoder-commons/workbench` with two primary entrypoints:

- `refreshProjectSessions(...)`
- `refreshCodingSessionMessages(...)`

These entrypoints are responsible for:

- resolving the current workspace, project, and coding session context
- routing refresh behavior by engine and source type
- preserving existing selection state
- returning structured refresh results for UI feedback and top-level state updates

UI components must call this module instead of embedding engine-specific logic.

### 2. Engine-aware routing

The orchestrator must branch by source truth:

- Native Codex session
  - rescan local native session files from `CODEX_HOME/sessions`
  - mirror summary changes into the matching BirdCoder project
  - parse native session messages from the session JSONL file
  - synchronize parsed messages into local persisted `codingSession.messages`
- Server/core-backed coding session
  - fetch session summary and projection data through `coreReadService`
  - synchronize refreshed assistant and user-visible message state into the local project mirror
- Other engines
  - use the same extension point and return a typed "not supported yet" result until a real authority reader exists

### 3. Top-level session inventory coherence

`src/App.tsx` currently maintains `sessionInventory` separately from the project tree.

Project refresh must therefore also trigger a refresh of top-level session inventory so:

- project trees
- session inventory
- restored startup selections

stay consistent after a refresh.

### 4. UI boundaries

Code and Studio should only own interaction triggers:

- project-level refresh action
- session-level refresh action
- loading state presentation
- success and failure feedback

They must not own:

- Codex JSONL parsing
- core session projection mapping
- local persistence synchronization

## UI And Interaction Design

### Code surface

Add refresh entrypoints to the code sidebar:

- project context menu: `Refresh Sessions`
- session context menu: `Refresh Messages`
- optional top-level refresh affordance for the selected project when one is active

### Studio surface

Add the same refresh actions to the Studio project/session menu:

- selected project refresh
- selected session refresh

All visible wording should use `Session` instead of legacy `Thread` wherever the current UX still mixes them in these refresh paths.

### UX rules

- Refresh must preserve the current project and session selection.
- Refresh must not clear the input box.
- Refresh should use local loading affordances instead of whole-page blocking where possible.
- Refresh completion should emit clear toasts that identify the authority source when known, for example Codex.

## Data Flow

### Project refresh

1. Resolve current workspace and target project.
2. Reload authoritative engine session inventory for the current workspace.
3. For Codex:
   - scan native session files
   - update mirrored session summaries
   - attribute mirrored sessions to the correct project when path information is available
4. Persist mirror updates through project service session storage.
5. Reload project list through `refreshProjects()`.
6. Reload App-level `sessionInventory`.
7. Preserve or repair selection if the refreshed project or selected session changed.

### Session refresh

1. Resolve the selected session and its owning project.
2. Detect whether the session is native Codex, server/core-backed, or other.
3. Reload authoritative session content.
4. Synchronize refreshed message state into local persisted session messages.
5. Reload project list.
6. Reselect the current session so the visible message list updates immediately.

## Native Codex Message Synchronization

### Source

The source of truth is the native Codex session JSONL file already discovered under `CODEX_HOME/sessions`.

### Required parsing behavior

The refresh pipeline must parse enough JSONL event types to rebuild a useful chat transcript:

- session metadata
- user prompts
- assistant message content
- task status markers
- abort or error markers

The parser does not need to perfectly model every Codex internal event in the first slice. It must reliably reconstruct a user-visible message list without duplicating messages across repeated refreshes.

### Persistence rules

- Synchronization must be idempotent.
- Repeated refreshes must not duplicate messages.
- Existing messages should be updated when content can be matched deterministically.
- If parsing fails, existing stored messages must remain intact.

## Server/Core Session Synchronization

For sessions backed by the BirdCoder core API:

- use `coreReadService.getCodingSession(...)`
- use `coreReadService.listCodingSessionEvents(...)`
- optionally use artifacts and checkpoints if needed for richer future mapping

The first slice should at minimum:

- refresh summary state
- refresh assistant message content visible in the chat timeline

The local mirror remains the UI read model, but refresh must come from core truth.

## Error Handling And Recovery

### Failure behavior

- A failed refresh must never wipe current session messages.
- A failed project refresh must never clear the visible project tree.
- If a session disappears from the authority source, the UI should remove it after a successful refresh and repair invalid selection state.

### Concurrency rules

- Prevent overlapping refreshes for the same project or session.
- Ignore stale refresh completions when a newer refresh started later.
- Keep refresh operations idempotent and safe to repeat after crash recovery.

### Crash recovery

The refresh pipeline must work with existing startup recovery:

- mirrored session state remains persisted locally
- refresh can be retried after restart without cleanup steps
- partial refresh failure must not corrupt persisted mirrored data

## Testing Strategy

Add focused contract coverage for the following:

- project refresh triggers native Codex inventory reload and project mirror synchronization
- session refresh for native Codex updates local `messages` without duplication
- session refresh for core-backed sessions reloads truth from `coreReadService`
- Code and Studio wire refresh actions to the same shared workbench refresh module
- App-level session inventory reloads after project refresh
- refresh preserves selected project and selected session
- refresh failure leaves previous visible messages intact

Recommended test lanes:

- new workbench refresh orchestration contract tests
- native Codex message parser contract tests
- page-level UI wiring contract tests for Code and Studio

## Out Of Scope

- Full live streaming synchronization for all engines
- Real-time filesystem watching of native session directories
- Automatic polling-based refresh
- Engine-specific message reconstruction beyond Codex and existing BirdCoder core truth in this slice
