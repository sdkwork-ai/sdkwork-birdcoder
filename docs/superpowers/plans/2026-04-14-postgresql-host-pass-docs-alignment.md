# PostgreSQL Host-Pass Docs Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze and remove stale live-docs language that still describes PostgreSQL live smoke as blocked-before-first-pass even though this host already has a recorded DSN-backed `passed` run.

**Architecture:** Extend the existing live-docs governance baseline with a focused PostgreSQL host-pass truth contract. Then realign Step 17/18/19 lane docs and release-governance docs to one consistent current truth: host-pass is recorded, future reruns may still report `blocked | failed | passed`, and those future reruns are the only valid reason to reopen the lane.

**Tech Stack:** Node.js, existing `scripts/live-docs-governance-baseline.test.mjs`, Markdown docs, release registry JSON

---

### Task 1: Freeze the PostgreSQL host-pass truth as a failing docs contract

**Files:**
- Modify: `scripts/live-docs-governance-baseline.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a PostgreSQL host-pass docs contract that rejects stale phrases such as “remains blocked”, “active environment gate”, or “blocked until first passed” inside the affected live docs.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/live-docs-governance-baseline.test.mjs`
Expected: FAIL because multiple Step 17/18/19 docs still preserve blocked-state language as current truth.

### Task 2: Realign the affected live docs

**Files:**
- Modify: `docs/架构/10-开发流程-质量门禁-评估标准.md`
- Modify: `docs/step/13-发布就绪-github-flow-灰度回滚闭环.md`
- Modify: `docs/step/17E-Coding-Server-OpenAPI-Export-And-Server-Release-Sidecar.md`
- Modify: `docs/step/17F-Coding-Server-Finalized-OpenAPI-Governance-And-Codegen-Input.md`
- Modify: `docs/step/17G-Coding-Server-Finalized-OpenAPI-Types-Codegen-Lane.md`
- Modify: `docs/step/17H-Coding-Server-Finalized-Typed-Client-Codegen-Lane.md`
- Modify: `docs/step/17I-Coding-Server-Shared-Generated-App-Admin-Facade-Lane.md`
- Modify: `docs/step/17J-Default-IDE-Services-Shared-Generated-Facade-Adoption-Lane.md`
- Modify: `docs/step/17K-App-Admin-Wrapper-Removal-Lane.md`
- Modify: `docs/step/17L-Shared-Core-Read-Facade-Lane.md`
- Modify: `docs/step/17M-Shared-Core-Projection-Read-Facade-Lane.md`
- Modify: `docs/step/17N-App-Team-Surface-Split-Lane.md`
- Modify: `docs/step/17O-Default-IDE-Release-Service-Adoption-Lane.md`
- Modify: `docs/step/17P-Default-IDE-Core-Read-Adoption-Lane.md`
- Modify: `docs/step/17Q-App-Level-Coding-Session-Projection-Consumer-Adoption-Lane.md`
- Modify: `docs/step/17R-Shared-Core-Facade-Exclusion-Governance-Lane.md`
- Modify: `docs/step/17S-Real-Core-Create-Coding-Session-Route-Lane.md`
- Modify: `docs/step/17T-Typed-Core-Create-Coding-Session-Facade-And-Consumer-Adoption-Lane.md`
- Modify: `docs/step/17U-Typed-Core-Create-Coding-Session-Turn-Facade-And-Consumer-Adoption-Lane.md`
- Modify: `docs/step/17V-Real-Core-Engine-Capability-And-Model-Catalog-Lane.md`
- Modify: `docs/step/17W-Real-Core-Approval-Decision-Lane.md`
- Modify: `docs/step/17X-Real-App-Document-Catalog-Lane.md`
- Modify: `docs/step/17Y-Real-Admin-Audit-Lane.md`
- Modify: `docs/step/17Z-Real-App-Deployment-Catalog-Lane.md`
- Modify: `docs/step/17ZA-Real-Admin-Deployment-Governance-Lane.md`
- Modify: `docs/step/18A-Engine-Source-Mirror-Truth-Lane.md`
- Modify: `docs/step/18B-Coding-Server-Engine-Truth-Promotion.md`
- Modify: `docs/step/18C-Rust-Host-Engine-Truth-Artifact-Lane.md`
- Modify: `docs/step/18D-Rust-Host-Engine-Route-Parity-Lane.md`
- Modify: `docs/step/18E-Engine-Governance-Release-Flow-Promotion-Lane.md`
- Modify: `docs/step/18F-Engine-Governance-Score-Surface-Lane.md`
- Modify: `docs/step/18G-Engine-Governance-Packaged-Release-Evidence-Lane.md`
- Modify: `docs/step/19-Governance-Regression-Deterministic-Baseline-Lane.md`
- Modify: `docs/step/19A-Web-Bundle-Segmentation-And-Production-Build-Lane.md`

- [ ] **Step 1: Replace stale blocked-state-as-current-truth language**

Use one consistent current-truth sentence family: PostgreSQL live smoke already has a recorded DSN-backed `passed` report on this host; only future reruns may reopen the lane through `blocked | failed | passed`.

- [ ] **Step 2: Preserve historical context without preserving stale current truth**

When a lane previously recorded blocked evidence, rephrase it as checkpoint-local history and point to the later host-pass closure recorded in `release-2026-04-13-04`.

- [ ] **Step 3: Run docs contract to verify it passes**

Run: `node scripts/live-docs-governance-baseline.test.mjs`
Expected: PASS

### Task 3: Backwrite release closure

**Files:**
- Modify: `docs/prompts/反复执行Step指令.md`
- Create: `docs/release/release-2026-04-14-02.md`
- Modify: `docs/release/releases.json`

- [ ] **Step 1: Add the prompt truth override**

Append a new closure override item that freezes the PostgreSQL host-pass docs-truth alignment.

- [ ] **Step 2: Add the release note and registry entry**

Register `release-2026-04-14-02`, carrying forward from `release-2026-04-14-01`.

### Task 4: Fresh verification before completion

**Files:**
- Modify: none

- [ ] **Step 1: Run the core verification commands**

Run:
- `node scripts/live-docs-governance-baseline.test.mjs`
- `node scripts/sdkwork-birdcoder-architecture-contract.test.mjs`
- `node scripts/check-release-closure.mjs`

Expected: all pass with fresh output.
