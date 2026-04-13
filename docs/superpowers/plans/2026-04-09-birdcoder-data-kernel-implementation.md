# BirdCoder Data Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified data kernel for BirdCoder with domain models, storage abstractions, and SQLite/PostgreSQL-ready schema contracts while removing direct storage access from app-facing modules.

**Architecture:** Define the domain and provider contracts in `@sdkwork/birdcoder-types`, implement shared browser/Tauri-backed repositories in `@sdkwork/birdcoder-commons`, then align appbase auth/user/vip storage and the desktop SQLite schema to the same contract.

**Tech Stack:** TypeScript, React 19, PNPM workspace, Tauri, Rust, SQLite, contract tests.

---

### Task 1: Lock the data-kernel contract with failing tests

**Files:**
- Create: `scripts/data-kernel-contract.test.mjs`
- Create: `scripts/appbase-storage-contract.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing data-kernel contract test**
- [ ] **Step 2: Write the failing appbase storage contract test**
- [ ] **Step 3: Run the targeted tests to confirm they fail before implementation**

### Task 2: Define the shared domain model and provider types

**Files:**
- Create: `packages/sdkwork-birdcoder-types/src/data.ts`
- Modify: `packages/sdkwork-birdcoder-types/src/index.ts`

- [ ] **Step 1: Add domain entity, repository, unit-of-work, provider, dialect, and schema types**
- [ ] **Step 2: Export the new types from the types package**
- [ ] **Step 3: Re-run the data-kernel contract test and confirm it reaches the next missing implementation**

### Task 3: Implement the shared storage kernel and refactor app-facing storage

**Files:**
- Create: `packages/sdkwork-birdcoder-commons/src/storage/dataKernel.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/storage/localStore.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/index.ts`
- Modify: `packages/sdkwork-birdcoder-appbase/src/storage.ts`
- Modify: `packages/sdkwork-birdcoder-appbase/src/pages/UserCenterPage.tsx`
- Modify: `packages/sdkwork-birdcoder-appbase/src/pages/VipPage.tsx`
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/services/impl/MockAuthService.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/services/impl/MockAuthService.ts`

- [ ] **Step 1: Implement provider-neutral repository helpers and canonical storage keys**
- [ ] **Step 2: Replace raw appbase storage reads/writes with the shared repository helpers**
- [ ] **Step 3: Refactor auth mocks to stop using direct `localStorage`**
- [ ] **Step 4: Run the targeted contract tests and confirm they pass**

### Task 4: Align the desktop SQLite schema and docs

**Files:**
- Modify: `packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs`
- Modify: `docs/架构/07-数据模型-状态模型-接口契约.md`
- Modify: `docs/架构/15-工作台偏好-终端运行时-本地存储补充标准.md`
- Modify: `docs/架构/16-终端主机会话-运行配置-本地存储标准.md`
- Modify: `docs/架构/18-多数据库抽象-Provider-迁移标准.md`
- Modify: `docs/step/03-领域模型-接口契约-数据标准冻结.md`
- Modify: `docs/step/08-terminal主机会话-cli集成-sqlite标准化.md`
- Modify: `docs/prompts/反复执行Step指令.md`

- [ ] **Step 1: Extend the SQLite schema and migration history to match the shared model**
- [ ] **Step 2: Update the architecture, step, and prompt docs to reflect the implemented contract**
- [ ] **Step 3: Run the targeted tests, `pnpm typecheck`, and `pnpm docs:build`**
