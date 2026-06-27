> Migrated from `docs/superpowers/specs/2026-05-25-birdcoder-iam-integration-design.md` on 2026-06-24.
> Owner: SDKWork maintainers

# BirdCoder IAM Integration Design

## Goal

BirdCoder uses the canonical SDKWork IAM system end to end. The app layer no longer owns a BirdCoder-specific user-center/auth contract, token header, session bridge, or UI runtime. Because this is a new application, there is no compatibility layer for retired user-center surfaces.

## Architecture

The runtime follows the SDKWork IAM standard pattern:

- Generated app/backend SDK clients are the only remote business boundary.
- App session tokens are stored as an IAM dual-token session: `authToken` plus `accessToken`.
- All generated clients use `Authorization: Bearer <authToken>` and `Access-Token: <accessToken>`.
- `@sdkwork/iam-runtime` owns IAM service wiring and validates generated SDK clients with `@sdkwork/iam-sdk-ports`.
- `@sdkwork/auth-pc-react` renders auth through `SdkworkIamAuthRoutes` and `createSdkworkIamRuntimeAuthController`.

## Contract Changes

- App OpenAPI must expose the standard IAM app resources: `auth.sessions.*`, `auth.verificationCodes.*`, password reset, registration, OAuth, `system.iam.*`, and `iam.users.current.retrieve`.
- Backend OpenAPI must expose the standard IAM backend resources under `/backend/v3/api/iam/*` and must not expose `auth.*`.
- Operation IDs remain dotted resource-style IDs so SDK generation produces nested resources.
- `Access-Token` is the only canonical v3 access-token header.
- QR login uses `openPlatform.qrAuth.sessions.*` if QR is enabled; retired `auth.qrLoginCodes.*` is removed.

## Runtime

BirdCoder adds a focused IAM runtime boundary in infrastructure:

- `appSessionToken.ts` persists IAM session tokens in `sessionStorage` with memory fallback.
- `iamRuntime.ts` creates and resets `createIamRuntime`.
- `sessionService.ts` creates, clears, and revokes app sessions through `client.auth.sessions.create({ grantType: "session_bridge" })` and `client.auth.sessions.current.delete()`.
- `sdkClients.ts` reads stored IAM tokens when constructing generated app/backend SDK clients and clears tokens on session-auth failures.

## UI

`@sdkwork/birdcoder-auth` renders `SdkworkIamAuthRoutes` directly. BirdCoder-specific auth controller/session synthesis is removed. Runtime configuration remains limited to app-level presentation choices such as auth base path, home path, locale, and development prefill.

## Removal

BirdCoder-owned user-center wrappers are deleted or retired from app exports:

- no `@sdkwork/user-center-*` dependency from BirdCoder app packages;
- no BirdCoder `userCenterRuntimeBridge`;
- no synthetic user-center session token storage;
- no `createSdkworkCanonicalAuthSurfacePage` or `createSdkworkCanonicalRuntimeAuthAuthorityService`;
- no generated user-center facade as the application auth path.

Membership/VIP remains outside IAM as billing/commerce. It must not be mixed into IAM session or authorization contracts.

## Verification

Focused verification commands:

- `node scripts/birdcoder-iam-runtime-standard-contract.test.mjs`
- `node scripts/birdcoder-sdk-family-standard-contract.test.mjs`
- `pnpm generate:sdk:birdcoder`
- `pnpm typecheck`
- `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml`
- `pnpm server:build`

`pnpm lint` remains the final broad gate after the focused IAM checks are clean.

