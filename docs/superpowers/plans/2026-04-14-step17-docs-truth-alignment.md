# Step 17 Docs Truth Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze Step 17 closure truth with an executable docs contract, then realign Step 17, architecture, and release writeback docs to the already-implemented repo state.

**Architecture:** Reuse the existing live-docs governance baseline instead of adding a new governance command so the baseline check count stays unchanged. Lock the current Step 17 truth in one failing-first docs contract, then update stale docs and release registry entries to match the same executable source of truth.

**Tech Stack:** Node.js, existing `scripts/*.mjs` contracts, Markdown docs, release registry JSON

---

### Task 1: Freeze stale Step 17 docs as a failing contract

**Files:**
- Modify: `scripts/live-docs-governance-baseline.test.mjs`

- [ ] **Step 1: Write the failing test**

Add assertions that reject stale Step 17 and architecture phrases which still describe already-closed route, SDK/codegen, or shared-facade gaps.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/live-docs-governance-baseline.test.mjs`
Expected: FAIL because Step 17 and architecture docs still contain stale closure text.

### Task 2: Realign Step 17 and architecture docs to repo truth

**Files:**
- Modify: `docs/step/17-Coding-Server-Core-App-Admin-API与控制台实现.md`
- Modify: `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`

- [ ] **Step 1: Update stale Step 17 summary and outcome sections**

Replace outdated “未闭环” and “下一缺口” text that still claims route parity, SQL provider/UoW, console, or SDK/codegen are open.

- [ ] **Step 2: Update stale architecture closure history**

Replace old per-slice “Next gap” and placeholder-route lists with final Step 17 truth: representative placeholder routes are `none`, Step 17 has no remaining non-environmental route gap, and PostgreSQL live smoke is the only environment gate.

- [ ] **Step 3: Run docs contract to verify it passes**

Run: `node scripts/live-docs-governance-baseline.test.mjs`
Expected: PASS

### Task 3: Backwrite release closure

**Files:**
- Create: `docs/release/release-2026-04-14-01.md`
- Modify: `docs/release/releases.json`

- [ ] **Step 1: Add the release note**

Document the Step 17 docs truth-alignment closure with Highlights, Scope, Verification, Notes, and Post-release operations.

- [ ] **Step 2: Update the release registry**

Append `release-2026-04-14-01` and carry forward from `release-2026-04-13-12`.

### Task 4: Fresh verification before completion

**Files:**
- Modify: none

- [ ] **Step 1: Run the core verification commands**

Run:
- `node scripts/live-docs-governance-baseline.test.mjs`
- `node scripts/check-release-closure.mjs`
- `node scripts/sdkwork-birdcoder-architecture-contract.test.mjs`

Expected: all pass with fresh output.
