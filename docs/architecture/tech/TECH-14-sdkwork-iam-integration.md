> Migrated from `docs/step/14-sdkwork-iam-integration.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 14 - SDKWork IAM Integration

## 1. Goal And Scope

Implement BirdCoder IAM through the canonical SDKWork IAM system. This step removes application-owned auth/session authority and wires Auth UI, generated SDKs, infrastructure runtime, and Rust local/private authority into one standard path.

This is a new application step. Do not preserve compatibility behavior, duplicate token names, old package bridges, local SDK copies, or hand-written API transports.

## 2. Inputs

- `../../specs/README.md`
- `../../specs/IAM_SPEC.md`
- `../../specs/API_SPEC.md`
- `../../specs/SDK_SPEC.md`
- `../../specs/SECURITY_SPEC.md`
- `docs/架构/17-sdkwork-iam-auth-user-standard.md`
- `sdks/.sdkwork-assembly.json`
- `sdks/specs/openapi/birdcoder-app-v3.openapi.json`
- `sdks/specs/openapi/birdcoder-backend-v3.openapi.json`

## 3. Non-Goals

- Do not add BirdCoder-specific auth protocol branches.
- Do not add local identity compatibility layers.
- Do not implement remote business capability through raw HTTP.
- Do not change database schema without an explicit schema decision.
- Do not move non-IAM product behavior into IAM.

## 4. Required Outputs

- App/backend OpenAPI contracts expose standard IAM resources under `/app/v3/api` and `/backend/v3/api`.
- Generated app/backend SDKs compile and expose resource-style methods.
- Infrastructure runtime creates generated SDK clients and injects canonical IAM token handling.
- Auth UI receives runtime through the IAM composition boundary.
- Shell page loading imports IAM integration, not auth UI internals.
- Rust server host depends on SDKWork IAM Rust crates and exposes app/backend route parity.
- Active package manifests, docs, scripts, generated inputs, and lockfiles contain no retired identity surface.

## 5. Implementation Lanes

- Contract lane: OpenAPI, SDK assembly, operation IDs, security schemes, docs, and no-legacy tests.
- Runtime lane: token store, app/backend SDK client creation, current-session adoption, and session service.
- UI lane: Auth page injection, successful login adoption, route metadata, and shell page loading.
- Server lane: Rust IAM authority, app/backend route contracts, long-ID-safe schemas, and local/private parity.
- Verification lane: lint, SDK generation contracts, OpenAPI contracts, Rust checks, Rust tests, and server build.

## 6. Acceptance Criteria

- `iam` is the only identity domain name in active contracts.
- `Authorization` and `Access-Token` are the only protected-operation token transports.
- App SDK owns session creation and current session reads.
- Backend SDK owns IAM administration and does not expose auth/session creation.
- UI and service code use generated SDK clients or approved runtime services.
- No compatibility alias, old command, old route, old header, old env variable, old package bridge, or local SDK fork remains.
- Verification evidence is fresh and covers TypeScript contracts, generated SDKs, OpenAPI route parity, Rust host tests, and desktop host tests.

## 7. Verification Commands

```bash
pnpm lint
pnpm check:iam-standard
node scripts/birdcoder-iam-no-legacy-identity-contract.test.mjs
node scripts/birdcoder-iam-standard-contract.test.mjs
node scripts/birdcoder-iam-runtime-standard-contract.test.mjs
node scripts/auth-ui-standard-contract.test.mjs
node scripts/birdcoder-sdk-family-standard-contract.test.mjs
node scripts/birdcoder-sdk-family-generated-contract.test.mjs
cargo check --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml
cargo test --manifest-path crates/sdkwork-birdcoder-api-server/Cargo.toml
cargo test --manifest-path packages/sdkwork-birdcoder-desktop/src-tauri/Cargo.toml
pnpm server:build
```

