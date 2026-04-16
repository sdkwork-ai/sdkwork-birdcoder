# BirdCoder Session Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add truthful project-level and session-level refresh actions so BirdCoder reloads Codex-native sessions and session messages from authority sources instead of only repainting cached local state.

**Architecture:** Introduce a shared workbench refresh orchestrator that routes refreshes by session source, backed by a reusable native Codex session store/parser. Wire Code and Studio to the shared refresh entrypoints, then refresh the App-level session inventory so project trees, startup recovery, and visible chat history stay in sync.

**Tech Stack:** TypeScript, React, local persisted project/session mirror, BirdCoder commons workbench modules, script-based contract tests, existing i18n locale modules.

---

## File Structure

- `packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionStore.ts`
  - New authority reader for Codex native sessions.
  - Owns `CODEX_HOME` resolution, session file discovery, summary parsing, and transcript parsing.
- `packages/sdkwork-birdcoder-commons/src/workbench/sessionInventory.ts`
  - Keeps inventory-only behavior but consumes the shared native store instead of owning duplicate parsing logic.
- `packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionMirror.ts`
  - Continues to own project attribution and mirror persistence, but gains the ability to upsert full message state.
- `packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts`
  - New shared project/session refresh orchestrator used by Code and Studio.
- `packages/sdkwork-birdcoder-commons/src/workbench.ts`
  - Shared export surface for new refresh helpers.
- `packages/sdkwork-birdcoder-commons/src/index.ts`
  - Root export surface for app consumers and tests.
- `src/App.tsx`
  - Refreshes top-level `sessionInventory` and passes a single reload callback into Code and Studio pages.
- `packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx`
  - Calls shared refresh helpers and preserves selected project/session state.
- `packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx`
  - Adds project/session refresh actions to the sidebar UI and context menus.
- `packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx`
  - Calls shared refresh helpers and preserves selected project/session state.
- `packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx`
  - Adds Studio refresh actions to the project/session picker UI.
- `packages/sdkwork-birdcoder-i18n/src/locales/en/code/sidebar.ts`
  - English copy for Code refresh actions and status messages.
- `packages/sdkwork-birdcoder-i18n/src/locales/zh/code/sidebar.ts`
  - Chinese copy for Code refresh actions and status messages.
- `packages/sdkwork-birdcoder-i18n/src/locales/en/studio/workspace.ts`
  - English copy for Studio refresh actions and status messages.
- `packages/sdkwork-birdcoder-i18n/src/locales/zh/studio/workspace.ts`
  - Chinese copy for Studio refresh actions and status messages.
- `scripts/native-codex-session-message-sync-contract.test.ts`
  - Verifies native Codex transcript parsing and idempotent message synchronization.
- `scripts/session-refresh-orchestrator-contract.test.ts`
  - Verifies project/session refresh orchestration and authority branching.
- `scripts/app-session-inventory-refresh-contract.test.mjs`
  - Verifies `src/App.tsx` reloads session inventory and passes the refresh callback to both Code and Studio.
- `scripts/code-session-refresh-ui-contract.test.mjs`
  - Verifies Code sidebar refresh controls and handler wiring.
- `scripts/studio-session-refresh-ui-contract.test.mjs`
  - Verifies Studio refresh controls and handler wiring.

### Task 0: Execution Preflight

**Files:**
- Verify only

- [ ] **Step 1: Create an isolated worktree before implementation**

Run: `git worktree add ..\\sdkwork-birdcoder-session-refresh -b feat/session-refresh`
Expected: A clean worktree is created so the dirty main workspace is not mixed with implementation edits.

- [ ] **Step 2: Confirm the spec and plan are available in the worktree**

Run: `Get-Content docs/superpowers/specs/2026-04-16-birdcoder-session-refresh-design.md`
Expected: The approved design is visible from the implementation worktree.

### Task 1: Native Codex Transcript Authority

**Files:**
- Create: `packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionStore.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/workbench/sessionInventory.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionMirror.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/workbench.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/index.ts`
- Test: `scripts/native-codex-session-message-sync-contract.test.ts`
- Test: `scripts/native-codex-session-mirror-contract.test.ts`
- Test: `scripts/session-inventory-contract.test.ts`

- [ ] **Step 1: Write the failing native Codex transcript contract test**

Cover:
- native session JSONL is resolved from `CODEX_HOME/sessions`
- transcript parsing returns deterministic user and assistant messages
- repeated synchronization does not duplicate messages
- parse failure preserves previously stored messages

- [ ] **Step 2: Run the new contract test to verify failure**

Run: `node --experimental-strip-types scripts/native-codex-session-message-sync-contract.test.ts`
Expected: FAIL because the native transcript authority module and message-sync behavior do not exist yet.

- [ ] **Step 3: Extract the shared native Codex authority reader**

Implement `packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionStore.ts` with focused helpers for:
- resolving `CODEX_HOME`
- walking session JSONL files
- reading a specific native session by BirdCoder session id
- parsing summary metadata
- parsing a user-visible transcript into `BirdCoderChatMessage[]`

Update `sessionInventory.ts` to consume the new store helpers instead of owning duplicate filesystem parsing.

- [ ] **Step 4: Extend the native mirror to persist refreshed messages**

Update `nativeCodexSessionMirror.ts` so mirror upserts can carry refreshed message arrays for native sessions while keeping project attribution and duplicate cleanup behavior intact.

- [ ] **Step 5: Run the focused native Codex verification**

Run:
- `node --experimental-strip-types scripts/native-codex-session-message-sync-contract.test.ts`
- `node --experimental-strip-types scripts/native-codex-session-mirror-contract.test.ts`
- `node --experimental-strip-types scripts/session-inventory-contract.test.ts`

Expected: PASS. Native summary mirroring still works, inventory still works, and native message synchronization is now deterministic and idempotent.

- [ ] **Step 6: Commit the native Codex authority slice**

Run:
- `git add packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionStore.ts`
- `git add packages/sdkwork-birdcoder-commons/src/workbench/sessionInventory.ts`
- `git add packages/sdkwork-birdcoder-commons/src/workbench/nativeCodexSessionMirror.ts`
- `git add packages/sdkwork-birdcoder-commons/src/workbench.ts`
- `git add packages/sdkwork-birdcoder-commons/src/index.ts`
- `git add scripts/native-codex-session-message-sync-contract.test.ts`
- `git commit -m "feat add codex native session transcript sync"`

Expected: A single focused commit for the native Codex authority layer.

### Task 2: Shared Session Refresh Orchestrator

**Files:**
- Create: `packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/workbench.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/index.ts`
- Test: `scripts/session-refresh-orchestrator-contract.test.ts`

- [ ] **Step 1: Write the failing orchestrator contract test**

Cover:
- project refresh reloads authoritative session inventory for the workspace
- native Codex project refresh reruns the mirror sync before returning
- session refresh reloads messages for native Codex sessions
- session refresh reloads summary plus visible messages for core-backed sessions
- unsupported engines return a typed unsupported result instead of throwing generic UI errors

- [ ] **Step 2: Run the orchestrator contract test to verify failure**

Run: `node --experimental-strip-types scripts/session-refresh-orchestrator-contract.test.ts`
Expected: FAIL because the shared refresh module does not exist.

- [ ] **Step 3: Implement the minimal shared refresh module**

Add `packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts` with:
- `refreshProjectSessions(...)`
- `refreshCodingSessionMessages(...)`
- source detection for native Codex vs. core-backed session
- a concurrency guard keyed by workspace/project/session so duplicate refreshes do not race
- structured result objects for success, unsupported, and failure states

Use:
- the new native Codex authority reader for `codex-native:*` sessions
- `projectService.getProjects(...)` plus `projectService.upsertCodingSession?.(...)` for mirror persistence
- `coreReadService.getCodingSession(...)` and `coreReadService.listCodingSessionEvents(...)` for core-backed refresh truth

- [ ] **Step 4: Run the orchestrator verification**

Run: `node --experimental-strip-types scripts/session-refresh-orchestrator-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the shared refresh orchestrator**

Run:
- `git add packages/sdkwork-birdcoder-commons/src/workbench/sessionRefresh.ts`
- `git add packages/sdkwork-birdcoder-commons/src/workbench.ts`
- `git add packages/sdkwork-birdcoder-commons/src/index.ts`
- `git add scripts/session-refresh-orchestrator-contract.test.ts`
- `git commit -m "feat add shared session refresh orchestrator"`

Expected: A focused commit for shared refresh orchestration.

### Task 3: App Inventory Reload And Page Integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx`
- Modify: `packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx`
- Test: `scripts/app-session-inventory-refresh-contract.test.mjs`

- [ ] **Step 1: Write the failing App integration contract**

Cover:
- `src/App.tsx` owns a reusable `sessionInventory` reload helper
- Code and Studio receive a callback for top-level session inventory refresh
- project refresh paths call both the shared session refresh orchestrator and App inventory reload
- selected project/session state is preserved after refresh

- [ ] **Step 2: Run the App integration contract to verify failure**

Run: `node scripts/app-session-inventory-refresh-contract.test.mjs`
Expected: FAIL because App does not yet expose a reusable session inventory reload callback to Code and Studio.

- [ ] **Step 3: Implement App and page-level refresh handlers**

Update `src/App.tsx` to:
- extract `listStoredSessionInventory(...)` loading into a dedicated reusable callback
- pass an `onSessionInventoryRefresh` prop into `CodePage` and `StudioPage`

Update `CodePage.tsx` and `StudioPage.tsx` to:
- call the shared workbench refresh helpers instead of duplicating refresh logic
- refresh page-local projects after successful authority sync
- preserve selection and input state
- surface success and failure toasts without clearing current content on failure

- [ ] **Step 4: Run the App integration verification**

Run: `node scripts/app-session-inventory-refresh-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit the App integration slice**

Run:
- `git add src/App.tsx`
- `git add packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx`
- `git add packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx`
- `git add scripts/app-session-inventory-refresh-contract.test.mjs`
- `git commit -m "feat wire app session inventory refresh"`

Expected: A focused commit for top-level inventory and page integration.

### Task 4: Code Sidebar Refresh UX

**Files:**
- Modify: `packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx`
- Modify: `packages/sdkwork-birdcoder-i18n/src/locales/en/code/sidebar.ts`
- Modify: `packages/sdkwork-birdcoder-i18n/src/locales/zh/code/sidebar.ts`
- Test: `scripts/code-session-refresh-ui-contract.test.mjs`
- Test: `scripts/session-sidebar-wording-contract.test.mjs`

- [ ] **Step 1: Write the failing Code UI contract**

Cover:
- project context menu includes `Refresh Sessions`
- session context menu includes `Refresh Messages`
- the sidebar header or active project affordance exposes refresh without blocking current selection
- Code continues to use `Session` wording in visible copy

- [ ] **Step 2: Run the Code UI contract to verify failure**

Run:
- `node scripts/code-session-refresh-ui-contract.test.mjs`
- `node scripts/session-sidebar-wording-contract.test.mjs`

Expected: The new Code refresh contract FAILS because refresh affordances do not exist yet. The existing wording contract should stay PASS throughout the slice.

- [ ] **Step 3: Implement Code sidebar refresh actions**

Update `Sidebar.tsx` to:
- accept `onRefreshProjectSessions` and `onRefreshCodingSessionMessages` props
- render refresh entries in the project and session context menus
- show disabled or loading states while a refresh is active
- keep menus in the existing top-layer portal stack

Add locale keys for refresh labels and refresh success/error feedback in both Code locale files.

- [ ] **Step 4: Run the Code UI verification**

Run:
- `node scripts/code-session-refresh-ui-contract.test.mjs`
- `node scripts/session-sidebar-wording-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the Code sidebar refresh UX**

Run:
- `git add packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx`
- `git add packages/sdkwork-birdcoder-i18n/src/locales/en/code/sidebar.ts`
- `git add packages/sdkwork-birdcoder-i18n/src/locales/zh/code/sidebar.ts`
- `git add scripts/code-session-refresh-ui-contract.test.mjs`
- `git commit -m "feat add code sidebar refresh actions"`

Expected: A focused commit for Code-side refresh affordances.

### Task 5: Studio Refresh UX

**Files:**
- Modify: `packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx`
- Modify: `packages/sdkwork-birdcoder-i18n/src/locales/en/studio/workspace.ts`
- Modify: `packages/sdkwork-birdcoder-i18n/src/locales/zh/studio/workspace.ts`
- Test: `scripts/studio-session-refresh-ui-contract.test.mjs`
- Test: `scripts/session-sidebar-wording-contract.test.mjs`

- [ ] **Step 1: Write the failing Studio UI contract**

Cover:
- Studio project/session menu exposes project refresh and session refresh actions
- the selected project and selected session remain stable after handler wiring
- visible Studio copy continues to use `Session` wording

- [ ] **Step 2: Run the Studio UI contract to verify failure**

Run:
- `node scripts/studio-session-refresh-ui-contract.test.mjs`
- `node scripts/session-sidebar-wording-contract.test.mjs`

Expected: The new Studio refresh contract FAILS because refresh affordances do not exist yet. The wording contract should stay PASS.

- [ ] **Step 3: Implement Studio refresh affordances**

Update `StudioChatSidebar.tsx` to:
- accept project-level and session-level refresh callbacks
- surface refresh controls in the project/session picker without causing layout regressions
- show local loading state only for the active refresh target

Add locale keys for Studio refresh actions and feedback in both Studio locale files.

- [ ] **Step 4: Run the Studio UI verification**

Run:
- `node scripts/studio-session-refresh-ui-contract.test.mjs`
- `node scripts/session-sidebar-wording-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the Studio refresh UX**

Run:
- `git add packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx`
- `git add packages/sdkwork-birdcoder-i18n/src/locales/en/studio/workspace.ts`
- `git add packages/sdkwork-birdcoder-i18n/src/locales/zh/studio/workspace.ts`
- `git add scripts/studio-session-refresh-ui-contract.test.mjs`
- `git commit -m "feat add studio session refresh actions"`

Expected: A focused commit for Studio-side refresh affordances.

### Task 6: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run the new focused refresh tests**

Run:
- `node --experimental-strip-types scripts/native-codex-session-message-sync-contract.test.ts`
- `node --experimental-strip-types scripts/session-refresh-orchestrator-contract.test.ts`
- `node scripts/app-session-inventory-refresh-contract.test.mjs`
- `node scripts/code-session-refresh-ui-contract.test.mjs`
- `node scripts/studio-session-refresh-ui-contract.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run adjacent regression coverage**

Run:
- `node --experimental-strip-types scripts/native-codex-session-mirror-contract.test.ts`
- `node --experimental-strip-types scripts/session-inventory-contract.test.ts`
- `node scripts/session-sidebar-wording-contract.test.mjs`
- `node scripts/code-project-path-contract.test.mjs`

Expected: PASS. Existing mirror behavior, session inventory behavior, session wording, and project-path actions remain correct.

- [ ] **Step 3: Run a targeted typecheck**

Run: `pnpm.cmd exec tsc --noEmit`
Expected: PASS with no new type regressions from the refresh slices.
