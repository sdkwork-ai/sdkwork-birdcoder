# Terminal Unification With sdkwork-terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BirdCoder's in-repo terminal implementation with `sdkwork-terminal`'s shell/runtime stack so terminal view, code view terminal, and studio terminal all render and execute through the same terminal system.

**Architecture:** BirdCoder keeps `@sdkwork/birdcoder-terminal` as a local facade, but the facade becomes a thin adapter over `sdkwork-terminal`'s `ShellApp`. TypeScript/Vite aliasing resolves the sibling `sdkwork-terminal` source packages directly. BirdCoder desktop adds a dedicated runtime bridge module that reuses `sdkwork-terminal` Rust crates and exposes the desktop commands/events `ShellApp` needs for interactive PTY-backed terminal tabs.

**Tech Stack:** TypeScript, React, Vite, Tauri 2, Rust, sibling source aliasing, `sdkwork-terminal` shell/infrastructure/core/contracts/types crates.

---

### Task 1: Lock the new contract in tests

**Files:**
- Create: `scripts/terminal-sdkwork-shell-integration-contract.test.ts`
- Modify: `package.json`
- Test: `scripts/terminal-sdkwork-shell-integration-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Assert that:
- `packages/sdkwork-birdcoder-terminal/src/pages/TerminalPage.tsx` imports or reuses `ShellApp` from the sibling `sdkwork-terminal` source chain instead of keeping the legacy terminal UI implementation.
- `packages/sdkwork-birdcoder-terminal/src/pages/TerminalPage.tsx` no longer imports BirdCoder legacy terminal host helpers such as `openTerminalHostSession`, `runTerminalHostSessionCommand`, or `closeTerminalHostSession`.
- `packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs` registers the new desktop bridge commands required by `ShellApp`, including:
  `desktop_local_shell_exec`,
  `desktop_local_shell_session_create`,
  `desktop_local_process_session_create`,
  `desktop_session_input`,
  `desktop_session_input_bytes`,
  `desktop_session_attachment_acknowledge`,
  `desktop_session_resize`,
  `desktop_session_terminate`,
  `desktop_session_replay_slice`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: FAIL because BirdCoder still uses the legacy `TerminalPage` implementation and desktop host does not yet register the `sdkwork-terminal` bridge commands.

- [ ] **Step 3: Write minimal implementation**

Add only the code required to make the contract true; do not refactor unrelated BirdCoder terminal/session code in this step.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/terminal-sdkwork-shell-integration-contract.test.ts packages/sdkwork-birdcoder-terminal packages/sdkwork-birdcoder-desktop
git commit -m "feat unify terminal shell with sdkwork-terminal"
```

### Task 2: Wire sibling terminal packages into BirdCoder frontend

**Files:**
- Modify: `tsconfig.json`
- Modify: `packages/sdkwork-birdcoder-web/vite.config.ts`
- Modify: `packages/sdkwork-birdcoder-desktop/vite.config.ts`
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `packages/sdkwork-birdcoder-terminal/package.json`

- [ ] **Step 1: Write the failing test**

Extend the contract test so it asserts:
- TypeScript path alias support exists for `@sdkwork/terminal-shell`, `@sdkwork/terminal-infrastructure`, `@sdkwork/terminal-core`, `@sdkwork/terminal-contracts`, and `@sdkwork/terminal-types`.
- Web and desktop Vite configs expose matching sibling source aliases.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: FAIL because only BirdCoder aliases exist today.

- [ ] **Step 3: Write minimal implementation**

Add sibling source aliases and install any required third-party runtime packages from the sibling stack, especially the `@xterm/*` packages used by `sdkwork-terminal-infrastructure`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json packages/sdkwork-birdcoder-web/vite.config.ts packages/sdkwork-birdcoder-desktop/vite.config.ts package.json pnpm-workspace.yaml packages/sdkwork-birdcoder-terminal/package.json
git commit -m "chore wire sdkwork-terminal source aliases"
```

### Task 3: Replace BirdCoder TerminalPage with a ShellApp adapter

**Files:**
- Modify: `packages/sdkwork-birdcoder-terminal/src/pages/TerminalPage.tsx`
- Modify: `packages/sdkwork-birdcoder-terminal/src/index.ts`
- Test: `scripts/terminal-sdkwork-shell-integration-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Extend the contract test so it asserts:
- `TerminalPage` renders `ShellApp`.
- `TerminalPage` chooses `desktop` mode when Tauri is available and `web` mode otherwise.
- `TerminalPage` adapts BirdCoder `terminalRequest`, `workspaceId`, and `projectId` into `ShellApp` tab bootstrap behavior instead of rendering its own tab strip.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: FAIL because the legacy UI still owns tabs, panes, command history, and governance menu rendering.

- [ ] **Step 3: Write minimal implementation**

Implement:
- a thin bridge that creates a desktop runtime client from Tauri `invoke/listen` when available;
- a working-directory picker hook for CLI tabs in desktop mode;
- a `terminalRequest` effect that opens a new `ShellApp` tab or rebinds the active one with the requested command/cwd;
- web fallback behavior that still uses `ShellApp` but tolerates the absence of runtime commands.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-birdcoder-terminal/src/pages/TerminalPage.tsx packages/sdkwork-birdcoder-terminal/src/index.ts scripts/terminal-sdkwork-shell-integration-contract.test.ts
git commit -m "feat adapt birdcoder terminal page to sdkwork-terminal shell"
```

### Task 4: Add the desktop sdkwork-terminal runtime bridge

**Files:**
- Create: `packages/sdkwork-birdcoder-desktop/src-tauri/src/terminal_bridge.rs`
- Modify: `packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs`
- Modify: `packages/sdkwork-birdcoder-desktop/src-tauri/Cargo.toml`
- Modify: `packages/sdkwork-birdcoder-desktop/src-tauri/permissions/default.toml`
- Test: `scripts/terminal-sdkwork-shell-integration-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Extend the contract test so it asserts:
- `lib.rs` imports and registers a dedicated terminal bridge module.
- `Cargo.toml` depends on the sibling `sdkwork-terminal` Rust crates.
- `default.toml` grants the new bridge command permissions.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: FAIL because BirdCoder desktop still only exposes legacy terminal host commands.

- [ ] **Step 3: Write minimal implementation**

Build a dedicated bridge module around sibling crates:
- initialize a `DesktopRuntimeState`;
- expose Tauri commands for local shell/process session create, input, input bytes, resize, terminate, replay, and WSL/local shell exec;
- emit local runtime stream events using the same event names the sibling TS infrastructure expects;
- keep the bridge isolated from BirdCoder's embedded coding server boot path.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-birdcoder-desktop/src-tauri/Cargo.toml packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs packages/sdkwork-birdcoder-desktop/src-tauri/src/terminal_bridge.rs packages/sdkwork-birdcoder-desktop/src-tauri/permissions/default.toml
git commit -m "feat add sdkwork-terminal desktop runtime bridge"
```

### Task 5: Verify end-to-end integration

**Files:**
- Modify: `package.json` if a dedicated script is needed
- Test: `scripts/terminal-sdkwork-shell-integration-contract.test.ts`
- Test: `pnpm exec tsc --noEmit`
- Test: `cargo test --manifest-path packages/sdkwork-birdcoder-desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Run focused JS contract verification**

Run: `node --experimental-strip-types scripts/terminal-sdkwork-shell-integration-contract.test.ts`
Expected: PASS

- [ ] **Step 2: Run workspace typecheck**

Run: `node scripts/run-local-typescript.mjs --noEmit`
Expected: PASS

- [ ] **Step 3: Run desktop Rust verification**

Run: `cargo test --manifest-path packages/sdkwork-birdcoder-desktop/src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 4: If generated permission/schema artifacts change, keep them in sync**

Stage any generated ACL/schema files that changed because of the new Tauri commands.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test verify sdkwork-terminal terminal unification"
```
