# 17 - SDKWork IAM Auth/User Standard

## 1. Goal

BirdCoder uses the canonical SDKWork IAM system end to end. The application does not define a second auth protocol, local identity authority, token header, session bridge, or generated client fork.

Because BirdCoder is a new application, there is no compatibility lane for retired identity surfaces. Standard contracts are corrected at the OpenAPI, SDK generation, runtime, and package-boundary source of truth.

## 2. Canonical Boundaries

- Canonical domain: `iam`.
- App API prefix: `/app/v3/api`.
- Backend API prefix: `/backend/v3/api`.
- Protected operations use `Authorization: Bearer <auth_token>` and `Access-Token: <access_token>`.
- OpenAPI is the source of truth for generated SDKs.
- UI calls IAM through `UI -> service/runtime -> generated SDK`.
- Rust local/private IAM uses `sdkwork_iam_context_service`, `sdkwork_routes_iam_app_api`, `sdkwork_routes_iam_backend_api`, `sdkwork_iam_directory_repository_sqlx`, and `sdkwork_appbase_tauri_host`.

## 3. Package Responsibilities

- `@sdkwork/birdcoder-auth` owns auth UI definitions and route metadata only.
- `@sdkwork/birdcoder-auth` receives IAM runtime through injection and must not import concrete infrastructure runtime.
- `@sdkwork/birdcoder-iam` composes BirdCoder auth UI with the IAM runtime.
- `@sdkwork/birdcoder-infrastructure` creates generated app/backend SDK clients, token storage, IAM runtime, and session services.
- `@sdkwork/birdcoder-shell` consumes `@sdkwork/birdcoder-iam` page loaders.
- `@sdkwork/birdcoder-user` owns user-facing product shell definitions only; it must not own auth/session protocol or duplicate IAM persistence.
- `@sdkwork/birdcoder-server` exposes standard app/backend IAM routes and delegates local/private authority to SDKWork IAM Rust crates.

## 4. SDK Contract

- App SDK package: `@sdkwork/birdcoder-app-sdk`.
- Backend SDK package: `@sdkwork/birdcoder-backend-sdk`.
- SDK generation uses `--standard-profile sdkwork-v3`.
- App SDK exposes login/session and current-user app capabilities, for example `client.auth.sessions.create(body)` and `client.iam.users.current.retrieve()`.
- Backend SDK exposes operator IAM governance, for example `client.iam.users.list()`, `client.iam.users.roles.list({ userId })`, and `client.iam.auditEvents.list()`.
- Backend SDK must not expose auth/session creation.
- Consumers must set tokens through generated SDK APIs or approved runtime/bootstrap services, never by assembling headers in UI or business services.

## 5. Auth UI Standard

- Auth pages are product UI composition, not identity authority.
- Successful login adopts the SDKWork IAM session payload and persists only the canonical IAM token set.
- Login, current session, refresh, logout, verification, OAuth, and password recovery surfaces are app-api concerns.
- UI permission checks are hints only; server-side authorization remains mandatory.

## 6. Rust And Local/Private Parity

- Local/private mode must expose the same app/backend paths, operation IDs, response schemas, and error semantics as the generated OpenAPI.
- IAM tables use the canonical `iam_` prefix.
- AppContext and ShardingContext are derived from verified token context.
- Local/private route registration must stay aligned with `IAM_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, and `SECURITY_SPEC.md`.

## 7. Forbidden Technical Debt

- No local SDK fork.
- No generated-output hand edit.
- No raw HTTP or manual auth-header assembly in UI or service business logic.
- No duplicate auth/session DTO shim to hide a missing SDK method.
- No legacy identity route, environment variable, header, command, or package bridge.
- No app-owned IAM authority or duplicate session storage protocol.

## 8. Verification

Minimum verification for IAM changes:

```bash
pnpm check:iam-standard
pnpm check:sdk-family-standard
pnpm generate:sdk:birdcoder
pnpm check:sdk-family-generated
cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml
cargo test --manifest-path packages/sdkwork-birdcoder-desktop/src-tauri/Cargo.toml
```

Completion requires the no-legacy identity contract, Auth UI contract, IAM runtime contract, SDK family contracts, OpenAPI route contracts, and Rust host tests to pass together.
