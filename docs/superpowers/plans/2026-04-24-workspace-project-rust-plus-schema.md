# Workspace Project Rust Plus Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Rust `workspace/project` persistence and API payloads with the Plus-style entity standard already applied in TypeScript.

**Architecture:** Extend the Rust schema parity contract first, then update the server authority schema, migrations, payload structs, and create/update/read SQL so old SQLite databases and new databases behave consistently. Mirror the required schema additions in the desktop bootstrap authority so desktop/server stay structurally aligned.

**Tech Stack:** Rust, rusqlite, Axum, TypeScript contract scripts, SQLite migrations

---

### Task 1: Lock the Rust schema contract

**Files:**
- Modify: `scripts/rust-workspace-project-schema-parity-contract.test.mjs`

- [ ] Add `data_scope` to the required workspace columns.
- [ ] Add `data_scope`, `user_id`, `parent_id`, `parent_uuid`, and `parent_metadata` to the required project columns.
- [ ] Run `node scripts/rust-workspace-project-schema-parity-contract.test.mjs` and confirm it fails for the missing Rust columns.

### Task 2: Align server Rust schema and migrations

**Files:**
- Modify: `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`

- [ ] Add the missing `workspace/project` columns to the `CREATE TABLE` declarations.
- [ ] Extend schema-upgrade column ensure lists so old SQLite files receive the new columns.
- [ ] Extend workspace/project backfill logic so the new columns are populated with canonical defaults.

### Task 3: Align server payloads and CRUD paths

**Files:**
- Modify: `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`

- [ ] Add the new fields to `WorkspacePayload`, `ProjectPayload`, `CreateWorkspaceRequest`, `UpdateWorkspaceRequest`, `CreateProjectRequest`, and `UpdateProjectRequest`.
- [ ] Update workspace/project read queries plus row mappers to load the new fields.
- [ ] Update create/update SQL so the new fields persist and round-trip through the API.
- [ ] Update embedded/demo payload fixtures that construct `WorkspacePayload` or `ProjectPayload`.

### Task 4: Mirror desktop schema

**Files:**
- Modify: `packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs`

- [ ] Add the missing workspace/project columns to the desktop `CREATE TABLE` statements.
- [ ] Update bootstrap workspace insert SQL so the new required/defaulted columns are seeded consistently.

### Task 5: Verify the slice

**Files:**
- Modify if needed: `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`

- [ ] Run `node scripts/rust-workspace-project-schema-parity-contract.test.mjs`.
- [ ] Run `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml rust_sqlite_provider_schema_upgrade_adds_plus_business_columns -- --exact` if needed, or the nearest targeted Rust verification available after compile feedback.
- [ ] Run any targeted TypeScript or contract verification needed only if Rust-facing API surface changes require it.
