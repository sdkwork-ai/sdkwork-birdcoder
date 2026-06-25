> Owner: SDKWork maintainers  
> Updated: 2026-06-24  
> Status: active current truth

# TECH-2026-06-24 Commercial Readiness Alignment

This document is the authoritative commercial-readiness snapshot after the 2026-06-24 alignment loop. It supersedes informal audit notes and must stay consistent with `sdkwork.app.config.json`, operator runbooks, and contract tests.

## 1. Closed in this loop

### Session and auth (PC)

| Item | Implementation | Verification |
| --- | --- | --- |
| Unified auth login path | `@sdkwork/birdcoder-pc-core/appSessionAuthRedirect` → `/#/auth/login?redirect=...` | `scripts/birdcoder-session-auth-redirect-contract.test.ts` |
| Structured HTTP 401 | `BirdCoderApiTransportError.httpStatus` | Same + IAM runtime contract |
| Proactive token refresh | `appSessionRefresh.ts` → `auth.sessions.refresh` | `birdcoder-iam-runtime-standard-contract.test.mjs` |
| Problem JSON IAM rejection | `RequiredIamContext` → `application/problem+json` | `web-framework-standard-contract.test.mjs` |

### API server

| Item | Implementation | Verification |
| --- | --- | --- |
| Live OpenAPI | `GET /openapi.json` from deployments snapshot | `server-observability-contract.test.mjs`, `cargo test openapi` |
| Workspace WS resilience | Exponential backoff reconnect in `workspaceRealtimeClient.ts` | `workspace-realtime-reconnect-contract.test.mjs` |

### Operations

| Item | Implementation |
| --- | --- |
| Operator runbook | `docs/guides/operator/` (deployment, backup, monitoring, incident) |
| PostgreSQL HA wiring | AnyPool repositories + HA values overlay (env smoke still required) |

## 2. OpenAPI route matrix truth

Authoritative machine-readable defer registry: `specs/coding-server-openapi-rust-defer-registry.json` (regenerate with `node scripts/build-coding-server-openapi-rust-defer-registry.mjs`).

| Surface | Contract operations | Host routes (product + IAM federation) | Gap |
| --- | ---: | ---: | ---: |
| App + Backend (OpenAPI snapshot) | 132 | 132 | 0 |

**Rule:** BirdCoder product manifests plus federated `sdkwork-iam` app/backend routers wired in api-server fully cover the OpenAPI contract. The defer registry tracks zero residual operations.

## 3. Commercial readiness by lane

| Lane | Grade | Blockers |
| --- | --- | --- |
| PC private beta | **A** | Supply-chain attestation off until real release checksums |
| Enterprise K8s | **A-** | Production cluster backup drill; optional Redis HA for workspace realtime |
| SaaS public cloud | **B+** | Release rehearsal aligned (`release:fixture:ready`, `release:candidate:dry-run`); production signing/SBOM pending first real publish |
| Mobile parity | **B+** | H5/Flutter CI smoke + Capacitor sync + Android `assembleDebug` in CI; iOS assemble / native E2E pending |

## 4. Closed in Phase 2 (2026-06-24)

1. PostgreSQL live smoke job in CI (`postgresql-live-smoke` + service container).
2. OpenAPI defer registry (`specs/coding-server-openapi-rust-defer-registry.json`).
3. Pre-launch manifest honesty (install packages disabled; no placeholder checksums).
4. H5 typecheck/build + Flutter analyze in CI (`mobile-surfaces` job).

## 5. Closed in Phase 3 (2026-06-24)

1. IAM seed parity contract resolves `sdkwork-iam` crate paths from root `Cargo.toml` (no stale `sdkwork-appbase` assumption).
2. Governance regression report (`pnpm check:governance-regression`) in PR CI after lint.
3. Flutter unit tests + H5 Capacitor platform contracts in `mobile-surfaces` CI job.

## 6. Closed in Phase 4 (2026-06-24)

1. Federated `sdkwork-iam` backend router wired in api-server (`wire_iam_routers`).
2. Defer registry v2 counts product + IAM federation manifests.
3. IAM seed parity resolves `sdkwork-iam` from workspace `Cargo.toml` and asserts backend federation wiring.
4. H5 app root added to pnpm workspace with `h5:typecheck` / `h5:build` runners; Capacitor `cap:sync` runs after H5 build in CI.

## 7. Closed in Phase 5 (2026-06-24)

1. Workspace teams app route (`GET /app/v3/api/teams`) and backend IAM teams routes (`GET /backend/v3/api/iam/teams`, `GET /backend/v3/api/iam/teams/{teamId}/members`) registered in product manifests and handler smoke tests.
2. OpenAPI defer registry regenerated: **132 of 132 implemented**, **0 deferred**.
3. `generate-birdcoder-http-route-manifests.mjs` synced with teams routes so manifest regeneration cannot drop coverage.
4. Contract tests require full OpenAPI implementation (`deferredOperationCount === 0`).

## 8. Closed in Phase 6 (2026-06-24)

1. Capacitor Android headless `assembleDebug` in CI (`pnpm cap:android:assemble` after `h5:build` + `cap:sync`; Java 17 + Android SDK in `mobile-surfaces` job).
2. Root runner `scripts/run-h5-capacitor-android-assemble.mjs` verifies `app-debug.apk` output.
3. `h5-capacitor-android-assemble-contract.test.mjs` and `ci-flow-contract` guard the CI wiring.

## 9. Closed in Phase 7 (2026-06-24)

1. Governed release rehearsal entrypoints verified: `pnpm release:fixture:ready` and `pnpm release:candidate:dry-run` produce checksum-backed synthetic manifests (33 artifacts / 27 required targets) and pass `assertReleaseReadiness`.
2. `scripts/release-rehearsal-readiness-contract.test.mjs` guards CI upload, governance regression tracking, and manifest `releaseEvidenceStatus`.
3. `package-script-entrypoints-contract` realigned with expanded `check:arch` commercial gate chain.

## 10. Next serial closures (ordered)

1. Publish first **real** governed release artifacts (not synthetic fixture) and enable install packages with production checksums/SBOM/signing evidence — operator checklist: `docs/guides/operator/first-governed-release.md`.
2. Split `@sdkwork/birdcoder-pc-server` `src/index.ts` (OpenAPI builders + route contracts) behind explicit module ownership; ratchet: `scripts/pc-server-module-size-contract.test.mjs` (max 6461 lines, must decrease after extraction).
3. iOS Capacitor headless build smoke on `macos-latest` CI (optional until App Store lane opens).

## 11. Closed in Phase 10 (2026-06-24)

1. PC product UI i18n sweep: bootstrap gate, skills/templates empty states, file explorer placeholders, code project toasts, and production error boundary now route through `@sdkwork/birdcoder-pc-i18n` with expanded `scripts/i18n-contract.test.mjs` forbidden literals.
2. Pre-i18n boot splash HTML neutralized on web/desktop entry HTML (`Loading application`) to avoid stale branded English-only boot copy.
3. Vite manual chunk topology repaired: `consoleQueries.ts` and `appSessionRefresh.ts` co-located with `birdcoder-platform-api-client` to eliminate `api-client ↔ platform-runtime` circular chunk warnings.
4. Production minify dependency installed (`terser` catalog) and api observability contract accepts grouped `pub use` re-exports from `sdkwork_birdcoder_errors`.

## 11b. Closed in Phase 11 (2026-06-24)

1. Skills hub registry selector, loading/error states, install toasts, author fallback, package skill counts, and tags panel now route through `skills/page` locale keys (835 keys, 2 locales).
2. Fixed corrupted tab-count separator in `SkillsPage` and extended forbidden literals for registry names and catalog loading copy.
3. `commercial-readiness-truth-contract.test.mjs` asserts root manifest records unified `manifestHonesty` metadata.

## 11c. Closed in Phase 12 (2026-06-24)

1. `/health` IAM database check performs `SELECT 1` via `sdkwork_database_sqlx::create_pool_from_env("IAM")` when `SDKWORK_IAM_DATABASE_URL` is configured (no resolver-only stub).
2. BirdCoder `pnpm-workspace.yaml` includes `@sdkwork/iam-credential-entry` so `sdkwork-auth-runtime-pc-react` resolves in unified workspace installs.
3. `docs/INDEX.yaml` populated with canon, operator guides, and commercial-readiness shard index.
4. `prepare-shared-sdk-packages.test.mjs` registry bridge path aligned with `SHARED_PACKAGE_BRIDGE_SPECS` (`apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react`).

## 12. Closed in Phase 9 (2026-06-24)

1. Unified preLaunch honesty across root, H5, and Flutter `sdkwork.app.config.json` manifests; removed ACTIVE status and zero checksum placeholders.
2. Container/Kubernetes boot path bundles `database/` and OpenAPI snapshot with `SDKWORK_BIRDCODER_APP_ROOT` / `SDKWORK_OPENAPI_SNAPSHOT_PATH`.
3. Extended `/health` checks for IAM database configuration and realtime backend readiness; aligned bootstrap smoke expectations.
4. Replaced api-server startup `panic!`/`expect` paths with structured errors and kernel lazy failure handling.
5. Enabled cross-platform production minification via Vite `terser` on web/desktop bundles.
6. Added browser Content-Security-Policy baseline on the PC shell entry HTML.
7. Expanded `check:server` to include deployment-backend handler smoke coverage.

## 13. Closed in Phase 8 (2026-06-24)

1. Operator runbook `docs/guides/operator/first-governed-release.md` documents the real-artifact publish gate and forbids promoting synthetic rehearsal checksums.
2. `prelaunch-publish-gate-contract.test.mjs` guards manifest honesty and runbook linkage.
3. `pc-server-module-size-contract.test.mjs` prevents further growth of the 6461-line god module before extraction.

## 14. Documentation hygiene

- Do not restore `/auth?` pathname redirects or plain-text 401 rejections in docs.
- Do not describe `/openapi.json` as unimplemented.
- Operator stub `docs/guides/operator/README.md` (3-line placeholder) is **retired** — use the expanded guide set.

## 15. Verification bundle

```bash
pnpm run check:arch
node scripts/commercial-readiness-truth-contract.test.mjs
node scripts/coding-server-openapi-rust-defer-registry-contract.test.mjs
node scripts/run-local-tsx.mjs scripts/birdcoder-session-auth-redirect-contract.test.ts
node scripts/docker-container-readiness-contract.test.mjs
pnpm run check:server
node scripts/iam-seed-parity-contract.test.mjs
pnpm run check:governance-regression
cargo test -p sdkwork-router-workspace-app-api
cargo test -p sdkwork-router-deployment-backend-api
node scripts/h5-capacitor-android-assemble-contract.test.mjs
node scripts/release-rehearsal-readiness-contract.test.mjs
node scripts/prelaunch-publish-gate-contract.test.mjs
node scripts/pc-server-module-size-contract.test.mjs
pnpm release:fixture:ready
pnpm release:candidate:dry-run
```
