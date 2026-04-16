# BirdCoder Multi-Engine Official SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current mock-only `chat-*` engine lane with a standardized official-SDK-first adapter foundation that exposes canonical runtime metadata, provider health, and provider-shaped canonical event behavior for Codex, Claude, Gemini, and OpenCode.

**Architecture:** Keep the current package topology intact for this slice, but promote `sdkwork-birdcoder-chat` into an adapter-contract carrier and turn each `sdkwork-birdcoder-chat-*` package into a provider adapter with official SDK metadata and health detection. Preserve `packages/sdkwork-birdcoder-commons/src/workbench/runtime.ts` as the canonical event wrapper, but extend it to surface official integration truth instead of arbitrary mock identity.

**Tech Stack:** TypeScript, pnpm workspace, Node scripts, existing BirdCoder workbench runtime contracts, local official SDK source mirrors in `external/*`.

---

### Task 1: Add Official SDK Adapter Contracts

**Files:**
- Modify: `packages/sdkwork-birdcoder-chat/src/types.ts`
- Test: `scripts/engine-runtime-adapter-contract.test.ts`
- Test: `scripts/engine-official-sdk-contract.test.ts`

- [ ] **Step 1: Write the failing test for official SDK metadata**

Add `scripts/engine-official-sdk-contract.test.ts` asserting that every engine created by `createChatEngineById()` exposes:
- `describeIntegration()`
- `getHealth()`
- official package metadata
- a primary runtime mode inside the kernel transport set

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --import tsx scripts/engine-official-sdk-contract.test.ts`
Expected: FAIL because `describeIntegration` and `getHealth` do not exist on the current engines.

- [ ] **Step 3: Extend shared chat contracts**

Add new shared types in `packages/sdkwork-birdcoder-chat/src/types.ts`:
- `ChatEngineIntegrationClass`
- `ChatEngineRuntimeMode`
- `ChatEngineOfficialEntry`
- `ChatEngineHealthReport`
- `ChatEngineIntegrationDescriptor`

Extend `IChatEngine` with:
- `describeIntegration?(): ChatEngineIntegrationDescriptor`
- `getHealth?(): Promise<ChatEngineHealthReport> | ChatEngineHealthReport`

- [ ] **Step 4: Re-run the failing test**

Run: `node --import tsx scripts/engine-official-sdk-contract.test.ts`
Expected: still FAIL because provider engines do not yet implement the new contract.

### Task 2: Implement Shared Provider Adapter Helpers

**Files:**
- Create: `packages/sdkwork-birdcoder-chat/src/providerAdapter.ts`
- Modify: `packages/sdkwork-birdcoder-chat/src/index.ts`
- Test: `scripts/engine-official-sdk-contract.test.ts`

- [ ] **Step 1: Write the failing helper-level expectation**

Extend `scripts/engine-official-sdk-contract.test.ts` to require:
- `integrationClass === 'official-sdk'`
- `officialEntry.packageName`
- `health.status`
- `health.runtimeMode`

- [ ] **Step 2: Run test to verify it still fails**

Run: `node --import tsx scripts/engine-official-sdk-contract.test.ts`
Expected: FAIL on missing provider implementations.

- [ ] **Step 3: Add shared adapter helper**

Create `packages/sdkwork-birdcoder-chat/src/providerAdapter.ts` with focused helpers:
- `createStaticIntegrationDescriptor()`
- `createStaticHealthReport()`
- `resolveMirrorPresence()`
- `resolveRuntimeModeFromTransport()`

Keep this helper provider-agnostic and JSON-safe.

- [ ] **Step 4: Export helper entrypoints**

Update `packages/sdkwork-birdcoder-chat/src/index.ts` to export the new contract and helper types.

- [ ] **Step 5: Re-run test**

Run: `node --import tsx scripts/engine-official-sdk-contract.test.ts`
Expected: still FAIL because provider engines are not wired yet.

### Task 3: Upgrade Provider Engines To Official-SDK-First Adapters

**Files:**
- Modify: `packages/sdkwork-birdcoder-chat-codex/src/index.ts`
- Modify: `packages/sdkwork-birdcoder-chat-claude/src/index.ts`
- Modify: `packages/sdkwork-birdcoder-chat-gemini/src/index.ts`
- Modify: `packages/sdkwork-birdcoder-chat-opencode/src/index.ts`
- Test: `scripts/engine-runtime-adapter-contract.test.ts`
- Test: `scripts/engine-official-sdk-contract.test.ts`

- [ ] **Step 1: Write failing assertions for provider-specific official metadata**

In `scripts/engine-official-sdk-contract.test.ts`, assert:
- Codex package is `@openai/codex-sdk`
- Claude package is `@anthropic-ai/claude-agent-sdk`
- Gemini package is `@google/gemini-cli-sdk`
- OpenCode package is `@opencode-ai/sdk`

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx scripts/engine-official-sdk-contract.test.ts`
Expected: FAIL because current providers expose only mock names and versions.

- [ ] **Step 3: Implement provider integration descriptors**

For each provider engine:
- implement `describeIntegration()`
- implement `getHealth()`
- set engine name/version to provider-specific adapter identity
- record official package name, source mirror path, integration class, runtime mode, and fallback status

- [ ] **Step 4: Replace arbitrary mock stream behavior with provider-shaped canonical behavior**

Keep tests local and deterministic, but align each provider stream with its official primitives:
- Codex: thread/turn/item flavor
- Claude: agent/tool-progress flavor
- Gemini: session/tool/skill flavor
- OpenCode: session/part/artifact flavor

Do not add network calls in this slice.

- [ ] **Step 5: Run provider contract tests**

Run:
- `node --import tsx scripts/engine-official-sdk-contract.test.ts`
- `node --import tsx scripts/engine-runtime-adapter-contract.test.ts`

Expected: PASS

### Task 4: Surface Official Integration Truth Through The Canonical Runtime

**Files:**
- Modify: `packages/sdkwork-birdcoder-commons/src/workbench/runtime.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/workbench/engines.ts`
- Modify: `packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts`
- Test: `scripts/engine-runtime-adapter-contract.test.ts`
- Test: `scripts/engine-kernel-contract.test.ts`

- [ ] **Step 1: Write the failing runtime truth assertions**

Add or extend tests so the canonical runtime exposes:
- runtime descriptor from kernel
- integration descriptor from provider
- health report from provider
- deterministic mapping between kernel transport kinds and provider runtime mode

- [ ] **Step 2: Run test to verify it fails**

Run the targeted engine/kernel tests.

- [ ] **Step 3: Implement runtime passthrough**

Update `packages/sdkwork-birdcoder-commons/src/workbench/runtime.ts` so wrapped engines preserve:
- `describeIntegration`
- `getHealth`

Update `kernel.ts` and `engines.ts` only as needed to keep the façade stable.

- [ ] **Step 4: Run targeted tests**

Run:
- `node --import tsx scripts/engine-runtime-adapter-contract.test.ts`
- `node --import tsx scripts/engine-kernel-contract.test.ts`

Expected: PASS

### Task 5: Add Governance Coverage For Official SDK Baseline

**Files:**
- Create: `scripts/engine-official-sdk-contract.test.ts`
- Modify: `scripts/check-arch-boundaries.mjs`
- Modify: `scripts/check-sdkwork-birdcoder-structure.mjs`
- Modify: `docs/reference/engine-sdk-integration.md`

- [ ] **Step 1: Expand governance expectations**

Add coverage that the repo recognizes:
- official package names
- current provider package locations
- no direct product-layer import policy remains documented

- [ ] **Step 2: Run the governance checks**

Run:
- `node scripts/check-sdkwork-birdcoder-structure.mjs`
- `node scripts/check-arch-boundaries.mjs`

Expected: PASS

- [ ] **Step 3: Keep docs aligned with implementation truth**

If any provider health or package name differs from docs, update `docs/reference/engine-sdk-integration.md` in the same change set.

### Task 6: Full Verification

**Files:**
- Verify only

- [ ] **Step 1: Run targeted adapter and docs verification**

Run:
- `node --import tsx scripts/engine-official-sdk-contract.test.ts`
- `node --import tsx scripts/engine-runtime-adapter-contract.test.ts`
- `node scripts/check-sdkwork-birdcoder-structure.mjs`
- `node scripts/check-arch-boundaries.mjs`
- `node scripts/sdkwork-birdcoder-architecture-contract.test.mjs`
- `node scripts/live-docs-governance-baseline.test.mjs`

Expected: all PASS

- [ ] **Step 2: Run docs build**

Run: `pnpm.cmd docs:build`
Expected: build succeeds

- [ ] **Step 3: Review diff**

Run: `git diff --stat`
Expected: changes are isolated to chat contracts, provider adapters, workbench runtime, scripts, and docs
