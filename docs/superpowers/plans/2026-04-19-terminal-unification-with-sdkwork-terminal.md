# Terminal Unification With sdkwork-terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove BirdCoder terminal-local implementation and make every BirdCoder terminal surface consume the standard `sdkwork-terminal` host surface and runtime path.

**Architecture:** `@sdkwork/terminal-shell` exposes a reusable desktop host surface that owns launch request deduplication, session creation, and `ShellApp` reattach state. BirdCoder-specific request normalization moves into a shared adapter under `@sdkwork/birdcoder-commons/terminal/*`. `@sdkwork/birdcoder-terminal` becomes a thin facade with no local terminal implementation, no local type bridges, and no page-local launch planner.

**Tech Stack:** TypeScript, React, Vite, Tauri 2, Rust, sibling source aliasing, `sdkwork-terminal` shell/infrastructure/core/contracts/types crates.

---

### Task 1: Lock the removal contract in tests

**Files:**
- Create: `scripts/terminal-sdkwork-shell-integration-contract.test.ts`
- Modify: `scripts/terminal-governance-contract.test.ts`
- Test: `scripts/terminal-sdkwork-shell-integration-contract.test.ts`
- Test: `scripts/terminal-governance-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Assert that:
- `packages/sdkwork-birdcoder-terminal/src/pages/*` no longer exists.
- `packages/sdkwork-birdcoder-terminal/src/type-bridges/*` no longer exists.
- `packages/sdkwork-birdcoder-terminal/src/TerminalPage.tsx` delegates to `DesktopTerminalSurface` from `@sdkwork/terminal-shell`.
- BirdCoder launch normalization lives in `packages/sdkwork-birdcoder-commons/src/terminal/sdkworkTerminalLaunch.ts`.
- `sdkwork-terminal-shell` exports the reusable host surface entry BirdCoder consumes.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts && node scripts/terminal-governance-contract.test.ts`
Expected: FAIL because BirdCoder terminal still contains the old page layout and local launch/type-bridge artifacts.

- [ ] **Step 3: Write minimal implementation**

Add only the code required to make the removal contract true.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts && node scripts/terminal-governance-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/terminal-sdkwork-shell-integration-contract.test.ts scripts/terminal-governance-contract.test.ts packages/sdkwork-birdcoder-terminal packages/sdkwork-birdcoder-commons ../sdkwork-terminal/packages/sdkwork-terminal-shell
git commit -m "refactor remove birdcoder terminal local implementation"
```

### Task 2: Add a reusable sdkwork-terminal desktop host surface

**Files:**
- Create: `../sdkwork-terminal/packages/sdkwork-terminal-shell/src/desktop-terminal-surface.tsx`
- Modify: `../sdkwork-terminal/packages/sdkwork-terminal-shell/src/index.tsx`
- Test: `scripts/terminal-sdkwork-shell-integration-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Extend the contract test so it asserts:
- `sdkwork-terminal-shell` exports `DesktopTerminalSurface`.
- the reusable surface owns `DesktopSessionReattachIntent` orchestration and local-shell/local-process launch execution.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: FAIL because the reusable surface does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement the reusable surface inside `sdkwork-terminal-shell` without introducing BirdCoder-specific imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ../sdkwork-terminal/packages/sdkwork-terminal-shell/src/index.tsx ../sdkwork-terminal/packages/sdkwork-terminal-shell/src/desktop-terminal-surface.tsx
git commit -m "feat add reusable sdkwork terminal desktop host surface"
```

### Task 3: Move BirdCoder launch normalization into shared commons

**Files:**
- Create: `packages/sdkwork-birdcoder-commons/src/terminal/sdkworkTerminalLaunch.ts`
- Modify: `scripts/terminal-governance-contract.test.ts`
- Test: `scripts/terminal-sdkwork-shell-integration-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Extend the contract test so it asserts:
- BirdCoder launch plan normalization is exported from shared commons.
- the shared helper resolves CLI profile availability before returning a launch plan.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts && node scripts/terminal-governance-contract.test.ts`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement the shared BirdCoder launch helper and keep it free of React rendering logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts && node scripts/terminal-governance-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-birdcoder-commons/src/terminal/sdkworkTerminalLaunch.ts scripts/terminal-governance-contract.test.ts scripts/terminal-sdkwork-shell-integration-contract.test.ts
git commit -m "refactor share birdcoder terminal launch normalization"
```

### Task 4: Collapse BirdCoder terminal package into a facade

**Files:**
- Create: `packages/sdkwork-birdcoder-terminal/src/TerminalPage.tsx`
- Modify: `packages/sdkwork-birdcoder-terminal/src/index.ts`
- Modify: `packages/sdkwork-birdcoder-terminal/package.json`
- Modify: `packages/sdkwork-birdcoder-terminal/tsconfig.json`
- Test: `scripts/terminal-sdkwork-shell-integration-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Extend the contract test so it asserts:
- `TerminalPage` only composes preferences, toast handling, Tauri bridge creation, and `DesktopTerminalSurface`.
- `@sdkwork/birdcoder-terminal` keeps no page-local launch planner or local type bridges.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: FAIL because BirdCoder terminal still contains local implementation files.

- [ ] **Step 3: Write minimal implementation**

Implement the thin facade and delete the superseded local files.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-birdcoder-terminal
git commit -m "refactor collapse birdcoder terminal to sdkwork-terminal facade"
```

### Task 5: Verify end-to-end integration

**Files:**
- Test: `scripts/terminal-sdkwork-shell-integration-contract.test.ts`
- Test: `scripts/terminal-governance-contract.test.ts`
- Test: `node scripts/run-workspace-package-script.mjs . check:terminal-governance`
- Test: `node scripts/run-workspace-package-script.mjs . check:web-vite-build`

- [ ] **Step 1: Run focused JS contract verification**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: PASS

- [ ] **Step 2: Run terminal governance verification**

Run: `node scripts/run-workspace-package-script.mjs . check:terminal-governance`
Expected: PASS

- [ ] **Step 3: Run production web build verification**

Run: `node scripts/run-workspace-package-script.mjs . check:web-vite-build`
Expected: PASS

- [ ] **Step 4: If generated permission/schema artifacts change, keep them in sync**

Stage any generated artifacts touched by the new terminal shell surface export path.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test verify full sdkwork-terminal adoption"
```
