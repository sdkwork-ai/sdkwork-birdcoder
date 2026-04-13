# BirdCoder Workbench Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the shared workbench runtime for code, studio, and terminal while keeping BirdCoder's current product shape.

**Architecture:** Separate engine routing from model selection, make terminal sessions project-aware and restorable, then move chat runtime persistence to the existing storage bridge so desktop SQLite and browser fallback stay aligned.

**Tech Stack:** React 19, PNPM workspace, Tauri, SQLite, TypeScript contract tests.

---

### Task 1: Lock runtime contracts with tests

**Files:**
- Create: `scripts/chat-runtime-contract.test.ts`
- Modify: `scripts/workbench-preferences-contract.test.ts`
- Modify: `scripts/terminal-session-contract.test.ts`

- [ ] Add a failing contract for engine/model separation.
- [ ] Add a failing contract for project-aware terminal sessions.
- [ ] Run the targeted contract tests and confirm the new expectations fail first.

### Task 2: Implement shared workbench and chat persistence helpers

**Files:**
- Create: `packages/sdkwork-birdcoder-commons/src/chat/persistence.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/index.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts`
- Modify: `packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx`
- Modify: `packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx`
- Modify: `packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx`

- [ ] Add normalized engine/model helpers and defaults.
- [ ] Replace raw chat `localStorage` access with storage bridge helpers.
- [ ] Wire code/studio pages and UniversalChat to the new engine/model contract.

### Task 3: Implement project-aware terminal recovery

**Files:**
- Modify: `packages/sdkwork-birdcoder-commons/src/terminal/sessions.ts`
- Modify: `packages/sdkwork-birdcoder-terminal/src/pages/TerminalPage.tsx`
- Modify: `packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs`

- [ ] Add session scope fields and filtering.
- [ ] Persist terminal layout by project key.
- [ ] Add recent-session restore UI in TerminalPage.
- [ ] Extend SQLite schema and migration logic for the new terminal columns.

### Task 4: Update architecture docs and verify

**Files:**
- Modify: `docs/架构/15-工作台偏好-终端运行时-本地存储补充标准.md`

- [ ] Document the final engine/model/session/storage standard.
- [ ] Run lint plus the affected contract tests.
- [ ] Run docs build to ensure architecture docs still compile.
