# BirdCoder Runtime Truth Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove simulated success paths from BirdCoder's AI, terminal, desktop Git, and distribution runtime contracts so user-visible behavior matches server and host truth.

**Architecture:** First freeze the repaired behavior with focused failing contracts. Then move the page layer off direct mock streaming, promote the Rust host turn route to emit completed runtime projections, block browser-host destructive terminal fallbacks behind governance, and replace desktop shell-string Git execution with explicit safe command invocation. Finally realign the distribution API base-url contract and rerun the high-signal repository checks.

**Tech Stack:** TypeScript, React, Node.js contract tests, Rust Axum host, Tauri capability JSON

---

### Task 1: Freeze the repaired runtime truth as failing contracts

**Files:**
- Modify: `scripts/server-runtime-transport-contract.test.ts`
- Modify: `scripts/server-runtime-transport-contract.test.ts`
- Modify: `scripts/host-runtime-contract.test.ts`
- Modify: `scripts/terminal-governance-contract.test.ts`
- Modify: `scripts/desktop-tauri-dev-contract.test.mjs`
- Create or modify: targeted tests for `useProjects` runtime orchestration if none exist

- [ ] **Step 1: Add a CN/global distribution URL contract**

Freeze one normalized expectation: both distributions provide a base URL that combines with `/api/<surface>/v1/...` exactly once.

- [ ] **Step 2: Add a browser terminal governance contract**

Assert that browser-host fallback does not perform destructive file operations for commands such as `rm -rf`, `mv`, or `touch` when governance would block them.

- [ ] **Step 3: Add a desktop Git safety contract**

Assert that the desktop capability scopes shell execution to `git` and that workbench Git actions no longer build `sh -c` command strings.

- [ ] **Step 4: Add a coding-session orchestration contract**

Assert that the front-end session send path does not directly stream assistant output from `chatEngine.sendMessageStream()` when runtime clients are present.

- [ ] **Step 5: Run the narrow failing tests**

Run the new focused test commands and confirm they fail for the current broken behavior.

### Task 2: Repair the distribution and host-runtime URL contract

**Files:**
- Modify: `packages/sdkwork-birdcoder-distribution/src/manifests/cn.ts`
- Modify: `packages/sdkwork-birdcoder-distribution/src/manifests/global.ts` if needed for symmetry
- Modify: `packages/sdkwork-birdcoder-server/src/index.ts`
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts` only if normalization helper changes are required
- Modify: related tests from Task 1

- [ ] **Step 1: Normalize manifest base URLs**

Make `apiBaseUrl` represent the host base path, not a partially expanded API prefix.

- [ ] **Step 2: Keep transport URL assembly centralized**

Preserve URL concatenation in the HTTP transport and update tests to assert the normalized behavior.

- [ ] **Step 3: Run the URL-focused tests**

Confirm the distribution/runtime transport tests pass.

### Task 3: Move front-end coding sessions onto runtime truth

**Files:**
- Modify: `packages/sdkwork-birdcoder-commons/src/hooks/useProjects.ts`
- Modify: `packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx`
- Modify: `packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx`
- Modify: `packages/sdkwork-birdcoder-commons/src/context/ideServices.ts` only if wiring changes are needed
- Modify: new or existing coding-session contracts from Task 1

- [ ] **Step 1: Write or extend the failing send-message orchestration test**

Cover the current anti-pattern: front-end code should not synthesize assistant content from `chatEngine.sendMessageStream()` when the runtime clients exist.

- [ ] **Step 2: Refactor `useProjects.sendMessage()`**

Persist the user message, trigger remote turn creation, and refresh mirrored session state without locally generating assistant text, tool calls, file changes, or command results.

- [ ] **Step 3: Adjust `CodePage` and `StudioPage` expectations if needed**

Make the pages treat projection-backed updates as the source of truth.

- [ ] **Step 4: Run the targeted coding-session tests**

Verify the page-layer runtime orchestration now passes.

### Task 4: Promote the Rust coding-server turn route from authority-only to runtime-producing

**Files:**
- Modify: `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- Modify: `packages/sdkwork-birdcoder-server/src/index.ts` only if TypeScript contract helpers must stay aligned
- Modify: Rust tests covering `create_coding_session_turn`

- [ ] **Step 1: Extend the failing Rust turn-route tests**

Freeze the repaired expectation: creating a turn must lead to more than a `turn.started` event and must surface either a completed message or an approval-producing operation with artifacts.

- [ ] **Step 2: Implement deterministic server-owned turn execution**

Create a minimal execution pipeline in the Rust host that appends completed events, projected artifacts, and checkpoint state into the projection store.

- [ ] **Step 3: Keep approval semantics coherent**

If a turn yields an approval checkpoint, make the resulting operation and runtime state match the same approval semantics already used by approval submission.

- [ ] **Step 4: Run the Rust host tests**

Confirm the updated `create turn` route now passes its route and projection tests.

### Task 5: Enforce terminal governance in browser host and remove destructive fallback writes

**Files:**
- Modify: `packages/sdkwork-birdcoder-terminal/src/pages/TerminalPage.tsx`
- Modify: `packages/sdkwork-birdcoder-commons/src/terminal/runtime.ts` if browser helper surfaces are needed
- Modify: `scripts/terminal-governance-contract.test.ts`

- [ ] **Step 1: Freeze destructive browser fallback as blocked behavior**

Ensure browser mode no longer mutates files for destructive or side-effecting commands.

- [ ] **Step 2: Refactor terminal browser fallback**

Route browser fallback through governance evaluation and only allow safe read-only simulated responses.

- [ ] **Step 3: Run the terminal governance tests**

Confirm both desktop and browser-host semantics stay coherent.

### Task 6: Replace desktop Git shell strings with explicit safe command execution

**Files:**
- Modify: `packages/sdkwork-birdcoder-code/src/components/TopBar.tsx`
- Modify: `packages/sdkwork-birdcoder-desktop/src-tauri/capabilities/default.json`
- Modify: `scripts/desktop-tauri-dev-contract.test.mjs`
- Add helper module if needed under `packages/sdkwork-birdcoder-code/src/`

- [ ] **Step 1: Freeze the anti-pattern in tests**

Assert the desktop Git UI no longer uses `Command.create('sh', ['-c', ...])`.

- [ ] **Step 2: Implement safe Git command execution**

Introduce a helper that executes `git` directly with positional arguments and a validated working directory.

- [ ] **Step 3: Narrow Tauri shell capability**

Update the desktop capability to allow `git` instead of generic `sh`.

- [ ] **Step 4: Run desktop host safety tests**

Confirm the capability and UI contracts pass.

### Task 7: Remove remaining user-visible fake-success entrypoints

**Files:**
- Modify: `packages/sdkwork-birdcoder-code/src/pages/useCodeRunEntryActions.ts`
- Modify: `packages/sdkwork-birdcoder-code/src/components/TopBar.tsx`
- Modify: related UI contracts if present

- [ ] **Step 1: Replace fake-success debug and publish paths**

Make clearly unavailable flows fail explicitly or route into real runtime-backed behavior instead of toasts that claim success.

- [ ] **Step 2: Update or add UI-facing tests**

Freeze the repaired user-visible behavior for debug and publish entrypoints.

- [ ] **Step 3: Run the targeted UI checks**

Verify the fake-success regressions are closed.

### Task 8: Verification before completion

**Files:**
- Modify: none

- [ ] **Step 1: Run focused repair checks**

Run the new and updated targeted tests added in Tasks 1-7.

- [ ] **Step 2: Run cross-host contract checks**

Run:
- `pnpm check:release-flow`
- `pnpm check:ci-flow`

If runtime or host cost is too high, at minimum run the narrowest updated contracts plus the relevant Rust test command and report any remaining unrun gates explicitly.
