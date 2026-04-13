# BirdCoder Claw Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring BirdCoder onto the Claw Studio architecture standard for foundational packages, CI, release, and deployment flow without changing BirdCoder business behavior.

**Architecture:** Extract existing i18n and infrastructure concerns from `commons`, add the missing host-studio standard package, then align root scripts and GitHub workflows to the same lifecycle used by Claw Studio. Enforce the result with structure, architecture, CI, and release contract scripts.

**Tech Stack:** PNPM workspace, React 19, Vite, Tauri, Cargo, GitHub Actions, Node.js release automation.

---

### Task 1: Add missing foundational packages

**Files:**
- Create: `packages/sdkwork-birdcoder-i18n/package.json`
- Create: `packages/sdkwork-birdcoder-i18n/src/index.ts`
- Create: `packages/sdkwork-birdcoder-i18n/src/locales/en/translation.json`
- Create: `packages/sdkwork-birdcoder-i18n/src/locales/zh/translation.json`
- Create: `packages/sdkwork-birdcoder-infrastructure/package.json`
- Create: `packages/sdkwork-birdcoder-infrastructure/src/index.ts`
- Create: `packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/*`
- Create: `packages/sdkwork-birdcoder-infrastructure/src/services/impl/*`
- Create: `packages/sdkwork-birdcoder-infrastructure/src/platform/openLocalFolder.ts`
- Create: `packages/sdkwork-birdcoder-host-studio/package.json`
- Create: `packages/sdkwork-birdcoder-host-studio/src/index.ts`
- Create: `packages/sdkwork-birdcoder-host-studio/src-host/Cargo.toml`
- Create: `packages/sdkwork-birdcoder-host-studio/src-host/src/lib.rs`
- Modify: `packages/sdkwork-birdcoder-commons/src/index.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/context/IDEContext.tsx`
- Modify: `packages/sdkwork-birdcoder-commons/src/context/ServiceContext.tsx`
- Modify: `packages/sdkwork-birdcoder-shell/src/application/providers/AppProviders.tsx`
- Modify: `packages/sdkwork-birdcoder-shell/src/application/app/AppRoot.tsx`

- [ ] Extract i18n to the dedicated package and bootstrap it from shell providers.
- [ ] Extract service contracts/mocks/folder bridge to infrastructure and rewire commons to consume them.
- [ ] Add host-studio package as the standard native host extension point.
- [ ] Verify typecheck-sensitive imports still resolve through workspace aliases.

### Task 2: Align workspace scripts and docs

**Files:**
- Create: `docs/index.md`
- Create: `docs/architecture.md`
- Create: `docs/release.md`
- Create: `docs/.vitepress/config.mts`
- Create: `scripts/run-vitepress.mjs`
- Create: `scripts/ci-flow-contract.test.mjs`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`
- Modify: `packages/sdkwork-birdcoder-web/vite.config.ts`
- Modify: `packages/sdkwork-birdcoder-desktop/vite.config.ts`

- [ ] Add docs build/dev/preview commands.
- [ ] Add `check:multi-mode`, `check:ci-flow`, `release:smoke:*`, and `release:finalize` scripts.
- [ ] Remove stale alias compatibility entries and duplicate path definitions.
- [ ] Add a CI flow contract test that verifies the expected workflow shape.

### Task 3: Align release automation and workflows

**Files:**
- Create: `scripts/release/finalize-release-assets.mjs`
- Create: `scripts/release/render-release-notes.mjs`
- Create: `scripts/release/smoke-release-assets.mjs`
- Create: `scripts/release/finalize-release-assets.test.mjs`
- Create: `scripts/release/render-release-notes.test.mjs`
- Modify: `scripts/release/local-release-command.mjs`
- Modify: `scripts/release/local-release-command.test.mjs`
- Modify: `scripts/release/package-release-assets.mjs`
- Modify: `scripts/release/resolve-release-plan.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/release-reusable.yml`

- [ ] Extend local release command parsing with `smoke` and `finalize` coverage for BirdCoder families.
- [ ] Finalize release assets with manifest/checksum generation and release notes rendering.
- [ ] Upgrade reusable release workflow to Claw-style prepare/verify/package/publish stages.
- [ ] Keep publish steps declarative for GitHub release and container metadata, even though local auth is still external to this session.

### Task 4: Tighten parity checks

**Files:**
- Modify: `scripts/check-sdkwork-birdcoder-structure.mjs`
- Modify: `scripts/check-arch-boundaries.mjs`
- Modify: `scripts/sdkwork-birdcoder-architecture-contract.test.mjs`

- [ ] Require the new foundational packages in the structure contract.
- [ ] Update architecture dependency policy for i18n, infrastructure, and host-studio.
- [ ] Re-run architecture, release, structure, CI, docs, and lockfile verification commands.
