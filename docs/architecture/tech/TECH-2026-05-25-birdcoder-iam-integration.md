> Migrated from `docs/superpowers/plans/2026-05-25-birdcoder-iam-integration.md` on 2026-06-24.
> Owner: SDKWork maintainers

# BirdCoder IAM Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BirdCoder app-level user-center/auth integration with canonical SDKWork IAM runtime, SDK, token, and auth UI contracts.

**Architecture:** Standardize OpenAPI and generated SDKs first, then wire infrastructure runtime and auth UI to `@sdkwork/iam-runtime` and `@sdkwork/auth-pc-react`. Remove BirdCoder-owned user-center shims instead of keeping compatibility facades.

**Tech Stack:** TypeScript, React, generated BirdCoder app/backend SDKs, SDKWork IAM appbase packages, Rust/Axum server host, pnpm and cargo verification.

---

### Task 1: IAM Contract Tests

**Files:**
- Create: `scripts/birdcoder-iam-runtime-standard-contract.test.mjs`
- Modify: `scripts/birdcoder-sdk-family-standard-contract.test.mjs`

- [x] Add tests requiring `Access-Token`, full IAM app/backend SDK method surfaces, `SdkworkIamAuthRoutes`, and no BirdCoder app-level `@sdkwork/user-center-*` dependencies.
- [x] Run the new tests and confirm they fail on the existing user-center implementation.

### Task 2: OpenAPI And SDK Generation

**Files:**
- Modify: `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts`
- Modify: `scripts/generate-birdcoder-sdk-family.mjs`
- Regenerate: `sdks/specs/openapi/*.json`
- Regenerate: `sdks/sdkwork-birdcoder-*-sdk/**`

- [x] Change the canonical OpenAPI security scheme to `Access-Token`.
- [x] Add missing standard IAM routes and operation definitions.
- [x] Remove retired QR user-center routes from the generated app SDK surface.
- [x] Run `pnpm generate:sdk:birdcoder`.

### Task 3: Infrastructure IAM Runtime

**Files:**
- Create: `packages/sdkwork-birdcoder-infrastructure/src/services/appSessionToken.ts`
- Create: `packages/sdkwork-birdcoder-infrastructure/src/services/iamRuntime.ts`
- Create: `packages/sdkwork-birdcoder-infrastructure/src/services/sessionService.ts`
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts`
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServicesShared.ts`
- Modify: `packages/sdkwork-birdcoder-infrastructure/src/index.ts`

- [x] Add session token store with sessionStorage and memory fallback.
- [x] Create BirdCoder IAM runtime from generated SDK clients.
- [x] Add app-session create/revoke helpers using `auth.sessions`.
- [x] Make generated SDK clients read/reset IAM tokens and clear session state on auth errors.
- [x] Remove user-center runtime bridge exports and usage.

### Task 4: Auth UI Migration

**Files:**
- Modify: `packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx`
- Modify: `packages/sdkwork-birdcoder-auth/src/auth-surface.ts`
- Modify: `packages/sdkwork-birdcoder-auth/package.json`

- [x] Replace canonical user-center auth surface with `SdkworkIamAuthRoutes`.
- [x] Replace BirdCoder synthetic auth controller with `createSdkworkIamRuntimeAuthController`.
- [x] Remove `@sdkwork/user-center-pc-react` from BirdCoder auth dependencies.

### Task 5: Rust Host Alignment

**Files:**
- Modify: `crates/sdkwork-birdcoder-standalone-gateway/src/lib.rs`
- Modify: `crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml`

- [x] Standardize the response and request access-token header as `Access-Token`.
- [x] Register missing standard IAM app routes with correct HTTP methods.
- [x] Keep native IAM/user persistence behind standard IAM routes only.
- [x] Remove app-visible user-center route names and retired QR paths.

### Task 6: Verification

**Commands:**
- `node scripts/birdcoder-iam-runtime-standard-contract.test.mjs`
- `node scripts/birdcoder-sdk-family-standard-contract.test.mjs`
- `pnpm generate:sdk:birdcoder`
- `pnpm typecheck`
- `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml`
- `pnpm server:build`

- [x] Run focused contract, TypeScript, Rust, and build checks.
- [x] Run `pnpm lint` and report any remaining unrelated workspace gate separately.

## Completion Evidence

- `node scripts/birdcoder-iam-runtime-standard-contract.test.mjs`
- `node scripts/birdcoder-sdk-family-standard-contract.test.mjs`
- `node scripts/birdcoder-iam-no-legacy-identity-contract.test.mjs`
- `pnpm generate:sdk:birdcoder`
- `pnpm --filter @sdkwork/birdcoder-auth typecheck`
- `pnpm --filter @sdkwork/birdcoder-iam typecheck`
- `pnpm --filter @sdkwork/birdcoder-user typecheck`
- `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml`
- `pnpm server:build`
- `pnpm lint`

