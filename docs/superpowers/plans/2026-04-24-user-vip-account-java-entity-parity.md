# User VIP Account Java Entity Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align BirdCoder canonical user, VIP, and account standards with `spring-ai-plus-business-entity` without compatibility debt.

**Architecture:** Java entity tables are canonical. BirdCoder TypeScript schema metadata and Rust SQLite schema mirror those tables, while UI membership screens consume canonical VIP membership fields and derive display projections locally. Remote business remains routed through generated app SDK/appbase wrappers.

**Tech Stack:** TypeScript workspace metadata, Node contract tests, Rust `rusqlite` local user-center runtime, generated OpenAPI schema definitions.

---

### Task 1: Strict Parity Contract

**Files:**
- Modify: `scripts/user-center-plus-entity-standard-contract.test.mjs`
- Read: `spring-ai-plus-business-entity/src/main/java/com/sdkwork/spring/ai/plus/entity/**`

- [ ] Add expected Java table and column lists for user, tenant, account, and VIP entities.
- [ ] Assert TypeScript data definitions expose every canonical table.
- [ ] Assert Rust `CREATE TABLE` blocks expose every canonical table.
- [ ] Assert Java `PlusTenantSupportEntity` physical columns use non-null tenant, organization, and data-scope defaults.
- [ ] Assert `plus_vip_user` does not include `vip_level_name`, `monthly_credits`, or `seat_limit`.
- [ ] Run `node scripts/user-center-plus-entity-standard-contract.test.mjs` and confirm it fails before implementation.

### Task 2: TypeScript Canonical Data Definitions

**Files:**
- Modify: `packages/sdkwork-birdcoder-types/src/data.ts`
- Modify: `packages/sdkwork-birdcoder-types/src/storageBindings.ts`

- [ ] Add entity names for canonical account and VIP tables.
- [ ] Replace `vip_subscription` canonical columns with Java `PlusVipUser` columns.
- [ ] Add canonical account and VIP table definitions.
- [ ] Keep display/plan fields out of canonical table definitions.
- [ ] Run the strict parity contract and confirm the TypeScript portion is green or only Rust/API failures remain.

### Task 3: Rust Local Schema And Payloads

**Files:**
- Modify: `packages/sdkwork-birdcoder-server/src-host/src/user_center.rs`
- Modify: `packages/sdkwork-birdcoder-types/src/server-api.ts`
- Modify: `packages/sdkwork-birdcoder-server/src/index.ts`

- [ ] Replace `plus_vip_user` local schema with Java `PlusVipUser` fields.
- [ ] Add local SQLite schema for canonical account and VIP tables.
- [ ] Update VIP membership request/payload structs to canonical fields: `vipLevelId`, `pointBalance`, `totalRechargedPoints`, `validFrom`, `validTo`, `lastActiveTime`, and `remark`.
- [ ] Update loading/upserting/building membership payloads to use canonical fields only.
- [ ] Update OpenAPI and generated client types for the local user-center membership endpoint.

### Task 4: UI Projection From Canonical Membership

**Files:**
- Modify: `packages/sdkwork-birdcoder-workbench-state/src/userProfileState.ts`
- Modify: `packages/sdkwork-birdcoder-user/src/storage.ts`
- Modify: `packages/sdkwork-birdcoder-user/src/vip-surface.ts`
- Modify: `scripts/birdcoder-user-storage-contract.test.mjs`

- [ ] Change stored membership snapshot to Java `PlusVipUser`-shaped fields.
- [ ] Map runtime canonical fields into the local snapshot.
- [ ] Derive plan title, included points, and seat-like UI values from plan metadata, not from `plus_vip_user`.
- [ ] Update storage contract to use canonical membership fields.

### Task 5: Verification

**Commands:**
- `node scripts/user-center-plus-entity-standard-contract.test.mjs`
- `pnpm.cmd test:user-center-standard`
- `pnpm.cmd check:identity-standard`
- `pnpm.cmd typecheck`

- [ ] Run targeted contract first.
- [ ] Run the user-center standard suite.
- [ ] Run the identity standard suite.
- [ ] Run TypeScript typecheck.
- [ ] If full lint is feasible after targeted checks, run `pnpm.cmd lint`; if unrelated dirty-worktree failures block it, report exact failures.
