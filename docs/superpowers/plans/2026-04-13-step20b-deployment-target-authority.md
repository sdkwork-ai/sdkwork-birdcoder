# Step 20B Deployment Target Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote `deployment_target` from schema-only definition into real shared repository, route, facade, and first consumer authority after `20A team_member` closure.

**Architecture:** Keep the closure aligned with the existing Step 17 representative app/admin pattern. Freeze one project-scoped admin target-read lane on the shared provider-backed repository/query path, then wire the generated facade, in-process transport, and Rust host to the same `/api/admin/v1/projects/:projectId/deployment-targets` authority so every runtime converges on one target catalog truth.

**Tech Stack:** TypeScript, shared generated coding-server client, shared table repositories, in-process app/admin transport, Rust host Axum routes, contract tests, VitePress docs, release docs.

---

### Task 1: Freeze the Step 20B contract surface

**Files:**
- Modify: `packages/sdkwork-birdcoder-types/src/server-api.ts`
- Modify: `packages/sdkwork-birdcoder-server/src/index.ts`
- Modify: `packages/sdkwork-birdcoder-types/src/generated/coding-server-client.ts`
- Modify: `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`
- Test: `scripts/coding-server-route-contract.test.ts`
- Test: `scripts/generated-app-admin-client-facade-contract.test.ts`

- [ ] **Step 1: Write the failing route and facade tests**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Write the minimal contract implementation**
- [ ] **Step 4: Run tests to verify they pass**

### Task 2: Close the shared repository and query lane

**Files:**
- Modify: `packages/sdkwork-birdcoder-types/src/data.ts`
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts`
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts`
- Test: `scripts/provider-backed-console-contract.test.ts`

- [ ] **Step 1: Write the failing repository/query test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write the minimal shared repository/query implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 3: Close the in-process transport and shared facade consumer

**Files:**
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts`
- Test: `scripts/app-admin-sdk-consumer-contract.test.ts`

- [ ] **Step 1: Write the failing transport/consumer test**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Write the minimal transport implementation**
- [ ] **Step 4: Run tests to verify they pass**

### Task 4: Close the Rust host route on the same authority path

**Files:**
- Modify: `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`
- Test: targeted Rust route assertions in `packages/sdkwork-birdcoder-server/src-host/src/lib.rs`

- [ ] **Step 1: Write the failing Rust host route and OpenAPI assertions**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Write the minimal Rust host implementation**
- [ ] **Step 4: Run tests to verify they pass**

### Task 5: Backwrite docs and release after green verification

**Files:**
- Modify: `docs/step/20-runtime-data-kernel-v2剩余实体Authority闭环.md`
- Modify: `docs/step/README.md`
- Modify: `docs/step/90-架构能力-Step-目录-证据映射矩阵.md`
- Modify: `docs/step/97-Step完成后的架构回写与能力兑现清单.md`
- Modify: `docs/step/99-Step总执行矩阵与最短路径总表.md`
- Modify: `docs/架构/07-数据模型-状态模型-接口契约.md`
- Modify: `docs/架构/18-多数据库抽象-Provider-迁移标准.md`
- Modify: `docs/prompts/反复执行Step指令.md`
- Create: `docs/release/release-2026-04-13-08.md`
- Modify: `docs/release/releases.json`

- [ ] **Step 1: Backwrite only after code and tests are green**
- [ ] **Step 2: Record that Step 20 is fully closed and the next undefined Step can be selected**
- [ ] **Step 3: Add the next release note and registry entry**
