# Governance Tail Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining Step 12 and Step 19 governance tail drift by aligning `ci-flow` and `quality-gate-matrix` contracts with the already-governed direct web-host build truth, then regenerate runtime and governance evidence plus release writeback.

**Architecture:** The repo truth already moved root and standard-tier web builds onto the direct `run-vite-host.mjs` path. The only remaining blockers are stale contract expectations in `ci-flow` and `quality-gate-matrix`; fix those first, then rerun the report generators that depend on them, and finally backwrite docs and release registry facts to the newly verified state.

**Tech Stack:** Node.js, pnpm workspace scripts, contract-style `.mjs` tests, Vite host runner, Markdown docs, JSON release registry

---

### Task 1: Freeze the failing contract truth

**Files:**
- Modify: `scripts/ci-flow-contract.test.mjs`
- Modify: `scripts/quality-gate-matrix-contract.test.mjs`
- Test: `scripts/ci-flow-contract.test.mjs`
- Test: `scripts/quality-gate-matrix-contract.test.mjs`

- [ ] **Step 1: Run the current failing contract tests**

Run: `node scripts/ci-flow-contract.test.mjs`
Expected: FAIL because `check:quality:standard` still expects `pnpm --filter @sdkwork/birdcoder-web build`

- [ ] **Step 2: Run the second failing contract test**

Run: `node scripts/quality-gate-matrix-contract.test.mjs`
Expected: FAIL for the same stale `check:quality:standard` string

- [ ] **Step 3: Update the expected command strings**

Replace the old recursive package-script build expectation with:

```txt
${check:desktop} && ${check:server} && ${prepare:shared-sdk} && pnpm --dir packages/sdkwork-birdcoder-web exec node ../../scripts/run-vite-host.mjs build --mode production && ${check:web-bundle-budget} && ${server:build} && ${docs:build}
```

- [ ] **Step 4: Re-run the targeted contract tests**

Run:
- `node scripts/ci-flow-contract.test.mjs`
- `node scripts/quality-gate-matrix-contract.test.mjs`
- `node scripts/release-flow-contract.test.mjs`

Expected: PASS

### Task 2: Regenerate governance and runtime evidence

**Files:**
- Update in place: `artifacts/governance/governance-regression-report.json`
- Update in place: `artifacts/quality/quality-gate-execution-report.json`

- [ ] **Step 1: Regenerate governance evidence**

Run: `node scripts/governance-regression-report.mjs`
Expected: PASS with no failed check ids

- [ ] **Step 2: Regenerate runtime execution evidence**

Run: `node scripts/quality-gate-execution-report.mjs`
Expected: PASS with `status: passed`

### Task 3: Backwrite docs and release registry

**Files:**
- Modify: `docs/架构/10-开发流程-质量门禁-评估标准.md`
- Modify: `docs/架构/28-Governance-Regression-Deterministic-Baseline-Standard.md`
- Modify: `docs/step/19-Governance-Regression-Deterministic-Baseline-Lane.md`
- Modify: `docs/prompts/反复执行Step指令.md`
- Create: `docs/release/release-2026-04-13-12.md`
- Modify: `docs/release/releases.json`

- [ ] **Step 1: Update docs to match the now-verified closure**

Document that the direct web-host build truth is now frozen across release-flow, ci-flow, quality-gate-matrix, governance regression, and runtime quality execution evidence.

- [ ] **Step 2: Add the new release note**

Create `release-2026-04-13-12.md` with Highlights, Scope, Verification, Notes, and Post-release operations sections.

- [ ] **Step 3: Append the release registry entry**

Update `docs/release/releases.json` with `release-2026-04-13-12` carrying forward `release-2026-04-13-11`.

### Task 4: Final acceptance

**Files:**
- Verify only

- [ ] **Step 1: Run the final acceptance command set**

Run:
- `node scripts/governance-regression-report.test.mjs`
- `node scripts/release-flow-contract.test.mjs`
- `node scripts/check-release-closure.mjs`
- `node scripts/live-docs-governance-baseline.test.mjs`
- `node scripts/governance-regression-report.mjs`
- `node scripts/quality-gate-execution-report.mjs`

Expected: PASS

- [ ] **Step 2: Report the next shortest loop input**

Summarize the now-closed tail drift and point the next loop back to the latest lowest-score item from fresh evidence.
