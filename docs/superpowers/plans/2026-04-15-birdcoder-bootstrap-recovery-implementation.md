# BirdCoder Bootstrap And Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee a minimum usable workspace/project context at authority startup and restore the most relevant workspace/project/tab context after restart or crash.

**Architecture:** Add an idempotent Rust authority bootstrap for workspace and project records, then add a small shared recovery module in commons so the shell app resolves startup state from persisted recovery context and stored session inventory instead of hardcoded ids.

**Tech Stack:** Rust host (`rusqlite`, `axum`), TypeScript, React, localStore-backed persistence, script-based contract tests.

---

### Task 1: Rust Authority Bootstrap

**Files:**
- Modify: `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`

- [ ] **Step 1: Write the failing Rust tests**

Add tests for:
- empty provider authority bootstraps one default workspace and one starter project
- existing workspace with no projects gets one starter project without replacing the workspace

- [ ] **Step 2: Run the Rust tests to verify failure**

Run: `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_from_sqlite_file_bootstraps_`
Expected: FAIL because the current authority loader does not create bootstrap workspace/project rows

- [ ] **Step 3: Implement minimum bootstrap logic**

Add an idempotent helper in `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` that:
- runs after provider authority schema/materialization is available
- inserts a deterministic default workspace when none exists
- inserts a deterministic starter project when none exists
- preserves existing user-created workspaces and projects

- [ ] **Step 4: Run the Rust tests to verify pass**

Run: `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_from_sqlite_file_bootstraps_`
Expected: PASS

### Task 2: Shared Workbench Recovery Resolver

**Files:**
- Create: `packages/sdkwork-birdcoder-commons/src/workbench/recovery.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/workbench.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/index.ts`
- Test: `scripts/workbench-startup-recovery-contract.test.ts`

- [ ] **Step 1: Write the failing TypeScript contract test**

Cover:
- valid recovery snapshot wins
- invalid snapshot falls back to session inventory
- missing recovery data falls back to first available workspace/project

- [ ] **Step 2: Run the contract test to verify failure**

Run: `pnpm.cmd exec tsx scripts/workbench-startup-recovery-contract.test.ts`
Expected: FAIL because the recovery resolver module does not exist yet

- [ ] **Step 3: Implement the minimal recovery module**

Add pure functions for:
- normalizing the persisted recovery snapshot
- resolving startup workspace id
- resolving startup project id
- building the persisted recovery snapshot

- [ ] **Step 4: Run the contract test to verify pass**

Run: `pnpm.cmd exec tsx scripts/workbench-startup-recovery-contract.test.ts`
Expected: PASS

### Task 3: App Shell Integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `packages/sdkwork-birdcoder-shell/src/legacy/LegacyBirdcoderApp.tsx` only if needed for import path cleanup
- Test: `scripts/workbench-startup-recovery-contract.test.ts`

- [ ] **Step 1: Extend the failing contract test**

Add assertions that:
- `src/App.tsx` no longer hardcodes `ws-1`
- app startup consumes the new recovery resolver
- app startup persists recovery context

- [ ] **Step 2: Run the contract test to verify failure**

Run: `pnpm.cmd exec tsx scripts/workbench-startup-recovery-contract.test.ts`
Expected: FAIL because the app still hardcodes startup ids

- [ ] **Step 3: Implement the app integration**

Update `src/App.tsx` so it:
- removes hardcoded workspace startup ids
- loads session inventory on startup
- resolves workspace/project from recovery + inventory + available data
- persists tab/workspace/project recovery state
- marks graceful exit on unload

- [ ] **Step 4: Run the contract test to verify pass**

Run: `pnpm.cmd exec tsx scripts/workbench-startup-recovery-contract.test.ts`
Expected: PASS

### Task 4: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused Rust verification**

Run: `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_from_sqlite_file_bootstraps_`
Expected: PASS

- [ ] **Step 2: Run focused TypeScript verification**

Run: `pnpm.cmd exec tsx scripts/workbench-startup-recovery-contract.test.ts`
Expected: PASS

- [ ] **Step 3: Run existing adjacent regression coverage**

Run: `pnpm.cmd exec tsx scripts/session-inventory-contract.test.ts`
Expected: PASS
