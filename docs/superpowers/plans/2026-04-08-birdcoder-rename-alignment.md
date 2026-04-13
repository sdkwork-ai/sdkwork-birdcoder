# BirdCoder Rename Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the workspace on the `sdkwork-birdcoder-*` naming standard without changing the current BirdCoder business shape.

**Architecture:** Keep the existing BirdCoder package graph, release flow, and multi-mode layout, but remove all legacy pre-standard package references in favor of the unified `sdkwork-birdcoder-*` naming surface. Repair verification scripts so the renamed workspace can prove architecture parity and release readiness.

**Tech Stack:** PNPM workspace, Vite, React 19, Tauri, Cargo, Node.js release scripts.

---

### Task 1: Audit rename fallout

**Files:**
- Modify: `package.json`
- Modify: `packages/sdkwork-birdcoder-server/package.json`
- Test: `scripts/sdkwork-birdcoder-architecture-contract.test.mjs`

- [ ] Fix root and server build script paths after file renames.
- [ ] Repoint contract expectations from old prefixes to the new BirdCoder standard.
- [ ] Verify there are no remaining legacy pre-standard package references outside generated artifacts.

### Task 2: Repair workspace structure validation

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `scripts/check-sdkwork-birdcoder-structure.mjs`

- [ ] Remove duplicate workspace globs.
- [ ] Require all current `sdkwork-birdcoder-*` packages by name.
- [ ] Reject legacy package directories and legacy references in package manifests and source configs.

### Task 3: Repair architecture/release verification

**Files:**
- Modify: `scripts/check-arch-boundaries.mjs`
- Test: `scripts/release/release-profiles.test.mjs`
- Test: `scripts/release/local-release-command.test.mjs`

- [ ] Replace the broken dependency loop with an explicit BirdCoder package dependency policy.
- [ ] Keep release profile and local release command expectations on `sdkwork-birdcoder`.
- [ ] Run architecture and release contract tests plus structure checks.

### Task 4: Rebuild workspace metadata

**Files:**
- Delete: `package-lock.json`
- Create/refresh: `pnpm-lock.yaml`

- [ ] Remove stale npm lock metadata that no longer reflects the pnpm workspace.
- [ ] Generate a pnpm lockfile in lockfile-only mode.
- [ ] Re-run critical validation after dependency metadata settles.
