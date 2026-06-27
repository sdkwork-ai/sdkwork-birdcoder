# BirdCoder Architecture Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring BirdCoder onto the SDKWork architecture standard for foundational packages, CI, release, and deployment flow without changing BirdCoder business behavior.

**Architecture:** Extract existing i18n and infrastructure concerns from `commons`, add the missing host-studio standard package, then align root scripts and GitHub workflows to the SDKWork standard lifecycle. Enforce the result with structure, architecture, CI, and release contract scripts.

**Tech Stack:** PNPM workspace, React 19, Vite, Tauri, Cargo, GitHub Actions, Node.js release automation.

---

### Task 1: Add missing foundational packages

**Files:**
- Create: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/`
- Create: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/`
- Create: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-host-studio/`
- Modify: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/`
- Modify: `pnpm-workspace.yaml`

- [ ] Extract i18n context, provider, and locale initialization from `commons` into new `sdkwork-birdcoder-i18n` package.
- [ ] Extract service interfaces, mock adapters, local folder bridge, and runtime utility helpers from `commons` into new `sdkwork-birdcoder-infrastructure` package.
- [ ] Add shared `sdkwork-birdcoder-host-studio` package that declares the studio host interface (preview and simulator config contracts), matching the SDKWork standard package topology.
- [ ] Update `commons` to re-export from the new packages where existing business modules still depend on the old surface.

### Task 2: Align CI and release workflow shape

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release-reusable.yml`
- Modify: `scripts/release-flow-contract.test.mjs`
- Modify: `scripts/ci-flow-contract.test.mjs`

- [ ] Upgrade reusable release workflow to SDKWork-style prepare/verify/package/publish stages.
- [ ] Add CI flow contract tests that gate workflow shape against the SDKWork standard.

### Task 3: Add structure, architecture, and release contract enforcement

**Files:**
- Create: `scripts/check-sdkwork-birdcoder-structure.mjs`
- Modify: `scripts/check-arch-boundaries.mjs`

- [ ] Add a structure contract that validates the expected package graph and rejects legacy or unexpected packages.
- [ ] Extend architecture boundary checks to validate the new package responsibilities and import rules.

### Task 4: Rebuild workspace metadata and documentation

**Files:**
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`

- [ ] Update root scripts and workspace metadata.
- [ ] Update docs to reflect new package topology.

### Task 5: Verify

- [ ] Run `pnpm lint` - should pass.
- [ ] Run `pnpm check:arch` - should pass.
- [ ] Run `pnpm check:release-flow` - should pass.
- [ ] Run `pnpm check:ci-flow` - should pass.
