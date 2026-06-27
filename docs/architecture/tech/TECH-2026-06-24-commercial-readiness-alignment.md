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

| Surface | Contract operations | Host routes (product + IAM federation) | Deferred |
| --- | ---: | ---: | ---: |
| App + Backend + Commerce (OpenAPI snapshot) | 147 | 132 | 15 |

**Rule:** BirdCoder product manifests plus federated `sdkwork-iam` app/backend routers wired in standalone-gateway fully cover the product/IAM OpenAPI contract (132 operations). The 15 commerce operations (`/api/v1/api-keys`, `/api/v1/notifications`, `/api/v1/usage`) are **commerce pre-launch deferred**: the OpenAPI contract ships first, Rust route crate implementation lands when commercial capabilities reach launch readiness. The defer registry tracks these as `commerce-pre-launch-deferred`.

### 2b. Commerce pre-launch deferred lane

| Field | Value |
| --- | --- |
| Lane | commerce (api-keys / notifications / usage) |
| Status | pre-launch deferred |
| Reason | OpenAPI contract precedes Rust route crate implementation; handlers land at commercial launch readiness |
| Deferred operations | 15 |
| Expected close phase | P3 commercial capability |
| Added | 2026-06-27 |
| Registry | `specs/coding-server-openapi-rust-defer-registry.json` (`deferredLanePolicy`) |

The commerce lane is intentionally phased: routes are designed in the OpenAPI snapshot so SDK clients and contract tests can stabilize against the public surface, while the Rust route crate handlers are deferred until the commercial capability (billing, quota enforcement, notification delivery) is launch-ready. No `commerce.*` operation is wired into product or federated IAM manifests yet.

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

1. Federated `sdkwork-iam` backend router wired in standalone-gateway (`wire_iam_routers`).
2. Defer registry v2 counts product + IAM federation manifests.
3. IAM seed parity resolves `sdkwork-iam` from workspace `Cargo.toml` and asserts backend federation wiring.
4. H5 app root added to pnpm workspace with `h5:typecheck` / `h5:build` runners; Capacitor `cap:sync` runs after H5 build in CI.

## 7. Closed in Phase 5 (2026-06-24)

1. Workspace teams app route (`GET /app/v3/api/teams`) and backend IAM teams routes (`GET /backend/v3/api/iam/teams`, `GET /backend/v3/api/iam/teams/{teamId}/members`) registered in product manifests and handler smoke tests.
2. OpenAPI defer registry regenerated: **132 of 147 implemented**, **15 commerce pre-launch deferred** (commerce lane deferred until commercial launch readiness; see §2b).
3. `generate-birdcoder-http-route-manifests.mjs` synced with teams routes so manifest regeneration cannot drop coverage.
4. Contract tests require full product/IAM OpenAPI implementation (`implementedOperationCount === 132`) and track the commerce pre-launch deferred lane (`deferredOperationCount === 15`).

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
2. iOS Capacitor headless build smoke on `macos-latest` CI (optional until App Store lane opens).

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
4. Replaced standalone-gateway startup `panic!`/`expect` paths with structured errors and kernel lazy failure handling.
5. Enabled cross-platform production minification via Vite `terser` on web/desktop bundles.
6. Added browser Content-Security-Policy baseline on the PC shell entry HTML.
7. Expanded `check:server` to include deployment-backend handler smoke coverage.

## 13. Closed in Phase 8 (2026-06-24)

1. Operator runbook `docs/guides/operator/first-governed-release.md` documents the real-artifact publish gate and forbids promoting synthetic rehearsal checksums.
2. `prelaunch-publish-gate-contract.test.mjs` guards manifest honesty and runbook linkage.
3. `pc-server-module-size-contract.test.mjs` guards the post-split `index.ts` barrel (max 1500 lines) and asserts all 10 owned modules exist after the 2026-06-27 extraction.

## 14. Documentation hygiene

- Do not restore `/auth?` pathname redirects or plain-text 401 rejections in docs.
- Do not describe `/openapi.json` as unimplemented.
- Operator stub `docs/guides/operator/README.md` (3-line placeholder) is **retired** — use the expanded guide set.

## 15. Chat backend integration plan (2026-06-27 assessment)

**Status:** Assessed — backend absent, frontend fully mock. Implementation tracked as P0 commercial-readiness blocker.

### Current state (evidence-backed)

| Layer | Status | Evidence |
| --- | --- | --- |
| H5 chat UI | Complete mock | `apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-chat/src/screens/ChatPage.tsx` uses `useState` + local `createChatMessage`; no fetch, no SDK client |
| Flutter chat UI | Complete mock | `apps/sdkwork-birdcoder-flutter-mobile/lib/pages/chat_page.dart` uses `StatefulWidget` + `Future.delayed` + hardcoded replies; class docstring self-describes "mocked today" |
| Rust route crate | Absent | No `sdkwork-routes-chat-*` crate under `crates/`; `standalone-gateway/src/routes/mod.rs` only mounts `api_keys/notifications/usage` |
| OpenAPI chat paths | Absent | `deployments/server-windows/x64/openapi/coding-server-v1.json` has zero `/chat` paths; existing `chat` symbols are `BirdCoderEngineCapabilityMatrix.chat` capability flags or coding-session `requestKind="chat"` turn types, not chat-message HTTP endpoints |
| PC server chat entry | Absent | `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/routeCatalog.ts` defines no chat routes; `chatEngine` references in `coreSessionExecution.ts` are coding-session engine bindings, not chat-message APIs |
| Shared chat package | Type-only | `packages/sdkwork-birdcoder-chat-contracts/src/index.ts` exports only types (`BirdCoderChatMessageRole`, `BirdCoderChatMessageRecord`); no API client. Flutter docstring references `@sdkwork/birdcoder-chat-shared` which does not exist |

### Implementation phases (ordered)

**Phase A — Rust backend foundation**

1. New crate `crates/sdkwork-birdcoder-chat-service/` — domain models (`ChatConversation`, `ChatMessage`), service traits, in-memory + sqlx implementations. Mirror `sdkwork-birdcoder-coding-sessions-service` layout.
2. New crate `crates/sdkwork-birdcoder-chat-repository-sqlx/` — schema, columns, rows, mapper, repository. Mirror `sdkwork-birdcoder-coding-sessions-repository-sqlx` layout.
3. New migration `crates/sdkwork-birdcoder-database-host/migrations/0008_chat.sql` — `chat_conversation` (id, tenant_id, owner_user_id, title, created_at, updated_at) and `chat_message` (id, conversation_id, role, content, created_at) tables with FK + index on `(conversation_id, created_at)`.
4. New route crate `crates/sdkwork-routes-chat-app-api/` — handlers (`listConversations`, `createConversation`, `getConversation`, `listMessages`, `postMessage`, `deleteConversation`), paths, routes, manifest, mapper. Mirror `sdkwork-routes-coding-sessions-app-api` layout.
5. Wire route crate in `crates/sdkwork-birdcoder-standalone-gateway/src/bootstrap/routers.rs` and `route_manifest.rs`; register in `Cargo.toml` workspace dependencies.

**Phase B — Contract and SDK surface**

6. Extend OpenAPI snapshot `deployments/server-windows/x64/openapi/coding-server-v1.json` and `deployments/server-win32/x64/openapi/coding-server-v1.json` with `/app/v3/api/chat/conversations`, `/app/v3/api/chat/conversations/{conversationId}`, `/app/v3/api/chat/conversations/{conversationId}/messages` paths and schemas.
7. Extend `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/routeCatalog.ts` `getResolvedBirdCoderAppApiContract()` with chat route definitions.
8. Regenerate TypeScript SDK (`apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript`) and Dart SDK (`apps/sdkwork-birdcoder-flutter-mobile/sdks/`) from updated OpenAPI.
9. Extend `packages/sdkwork-birdcoder-chat-contracts/src/index.ts` with API request/response shapes mirrored from OpenAPI schemas; rename package to `@sdkwork/birdcoder-chat-shared` if Flutter integration requires a single shared package name (or keep `chat-contracts` and add a new `chat-shared` package for API client surface).

**Phase C — Frontend integration**

10. H5: replace `apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-chat/src/screens/ChatPage.tsx` local `useState` + `createChatMessage` with real API client calls (`listMessages`, `postMessage`). Introduce async state layer (loading/error/streaming).
11. H5: remove local `createChatMessage` from `apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-chat/src/index.ts`; re-export API client from chat-shared.
12. Flutter: replace `apps/sdkwork-birdcoder-flutter-mobile/lib/pages/chat_page.dart` `_loadHistory` and `_sendMessage` mock with real API calls through `BirdCoderFlutterSdkClients` (extend `sdk_clients.dart` to expose chat client).
13. Flutter: add `http` or generated SDK client dependency to `apps/sdkwork-birdcoder-flutter-mobile/packages/sdkwork_birdcoder_flutter_mobile_chat/pubspec.yaml`; promote package from type-only to API-client-bearing.

**Phase D — Verification**

14. Add `cargo test -p sdkwork-routes-chat-app-api` and `cargo test -p sdkwork-birdcoder-chat-service` to CI.
15. Add `scripts/chat-route-catalog-contract.test.mjs` to guard PC route catalog includes chat routes.
16. Update `commercialReadiness.mobileProductParity` in `sdkwork.app.config.json` to reflect chat backend wired status once Phase C completes.

### Estimated scope

- New Rust crates: 3 (service, repository-sqlx, route-app-api)
- New migrations: 1 (`0008_chat.sql`)
- Modified Rust crates: 1 (`sdkwork-birdcoder-standalone-gateway` bootstrap wiring)
- Modified OpenAPI snapshots: 2 (server-windows, server-win32)
- Modified PC server modules: 1 (`routeCatalog.ts`)
- Regenerated SDKs: 2 (TypeScript, Dart)
- Modified H5 packages: 1 (`sdkwork-birdcoder-h5-chat`)
- Modified Flutter packages: 2 (`sdkwork_birdcoder_flutter_mobile_chat`, `sdkwork_birdcoder_flutter_mobile_core`)
- Modified Flutter pages: 1 (`chat_page.dart`)
- New contract tests: 2+

This is a multi-session implementation; Phase A and Phase B are prerequisites for any frontend integration. Until Phase B completes, H5 and Flutter chat must remain mock.

## 16. Verification bundle

```bash
pnpm run check:arch
node scripts/commercial-readiness-truth-contract.test.mjs
node scripts/coding-server-openapi-rust-defer-registry-contract.test.mjs
node scripts/run-local-tsx.mjs scripts/birdcoder-session-auth-redirect-contract.test.ts
node scripts/docker-container-readiness-contract.test.mjs
pnpm run check:server
node scripts/iam-seed-parity-contract.test.mjs
pnpm run check:governance-regression
cargo test -p sdkwork-routes-workspace-app-api
cargo test -p sdkwork-routes-deployment-backend-api
node scripts/h5-capacitor-android-assemble-contract.test.mjs
node scripts/release-rehearsal-readiness-contract.test.mjs
node scripts/prelaunch-publish-gate-contract.test.mjs
node scripts/pc-server-module-size-contract.test.mjs
pnpm release:fixture:ready
pnpm release:candidate:dry-run
```
