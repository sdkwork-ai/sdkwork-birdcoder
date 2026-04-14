# BirdCoder Runtime Truth Repair Design

## Goal

Repair the BirdCoder runtime so the user-visible AI, terminal, and host integrations report and execute one coherent truth across web, desktop, and server modes. The target is to remove simulated success paths where the UI currently presents real functionality while the underlying runtime is still mock or authority-only.

## Recommended Approach

### Option A: Strict runtime truth repair

- Route coding-session creation, turn execution, approvals, and projections through the existing `coreReadService` and `coreWriteService` contracts instead of generating assistant output in the page layer.
- Promote the Rust coding-server host from authority-only turn creation to turn execution that emits real session events, artifacts, and approval checkpoints.
- Preserve browser-host behavior only for explicitly safe read-only interactions; block or disable destructive terminal fallbacks that currently bypass governance.
- Replace desktop shell-string Git execution with parameterized command execution that is safe on Windows and does not rely on `sh -c`.
- Normalize distribution API base-url semantics so `global` and `cn` manifests use the same path contract.

### Option B: Keep dual runtime paths but label local fallback explicitly

- Leave local mock streaming and browser-side command simulation in place.
- Mark those paths as preview-only or unavailable in the UI and docs.
- This lowers engineering effort, but it preserves architectural drift and keeps production behavior split by host mode.

### Option C: Disable unstable surfaces until the real runtime exists

- Turn off code chat execution, debug entrypoints, publish entrypoints, Git operations, and browser terminal writes until the real runtime path is complete.
- This is the safest short-term containment move, but it removes too much product value and does not satisfy the repository's multi-host AI IDE claims.

## Chosen Design

Use Option A.

### Coding-session runtime

- `CodePage` and `StudioPage` stop streaming assistant output from `chatEngine` in the page layer.
- User messages continue to enter through `projectService.addCodingSessionMessage`, but assistant-side truth moves behind `coreWriteClient.createCodingSessionTurn` plus `coreReadClient` projection reloads.
- `useProjects.sendMessage()` becomes a runtime-orchestration helper that:
  - persists the user message,
  - creates a placeholder assistant message only when a local projection mirror needs it,
  - triggers the remote turn,
  - refreshes session state from the projection store,
  - stops synthesizing file changes or command results from mock tool calls.

### Server turn execution

- The Rust host keeps the existing route surface, but `POST /api/core/v1/coding-sessions/{id}/turns` must no longer stop at `turn.started`.
- Turn execution will emit a deterministic minimal runtime sequence based on the selected engine descriptor:
  - `turn.started`
  - `message.delta` or `message.completed`
  - `tool.call.requested` when the engine emits tool requests
  - `artifact.upserted` for projected patch or command artifacts
  - `approval.required` when tool risk requires approval
  - `turn.completed` or `turn.failed`
- The first repair slice does not require live network LLM access. It requires server-owned runtime truth, not real vendor inference.

### Terminal governance

- Desktop terminal execution continues to use the existing governance evaluation and audit flow.
- Browser-host fallback must stop mutating the file tree through ad-hoc `touch`, `mkdir`, `rm`, and `mv` handlers.
- In browser mode, non-read-only commands will be blocked with the same governance messaging used by the terminal runtime. Safe read-only commands may still render simulated output if they do not mutate state.

### Desktop Git integration

- Code workbench Git actions move from `Command.create('sh', ['-c', ...])` to an explicit command helper.
- The helper must:
  - invoke `git` directly,
  - pass arguments positionally,
  - use working-directory parameters instead of `cd && ...`,
  - validate branch names and commit messages before execution,
  - keep Tauri shell capability scoped to `git` instead of a generic `sh`.

### Host and distribution contract

- `DistributionManifest.apiBaseUrl` becomes a base host path without embedded surface duplication.
- The HTTP transport remains responsible for appending `/api/<surface>/v1/...`.
- Existing tests that currently freeze `/api/api/...` must be realigned to the normalized contract.

## Testing Strategy

- Add or update focused contract tests for:
  - front-end coding-session orchestration no longer consuming `chatEngine.sendMessageStream()` directly,
  - Rust host turn execution producing a completed projection with events and artifacts,
  - browser terminal fallback rejecting destructive commands through governance,
  - desktop Git capability and command execution safety,
  - normalized distribution URL generation for `cn` and `global`.
- Run the narrowest commands first, then widen to the cross-host contract baseline.

## Out of Scope

- Replacing mock engine responses with real third-party network calls in this slice.
- Rebuilding the UI shell or package topology unrelated to runtime truth.
- Adding new product surfaces beyond repairing the current code, studio, terminal, and host contracts.
