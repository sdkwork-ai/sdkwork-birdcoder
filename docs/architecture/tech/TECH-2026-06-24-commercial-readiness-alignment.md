> Owner: SDKWork maintainers  
> Updated: 2026-06-30  
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

| Surface | Contract operations | Host routes (product + IAM federation + commerce gateway) | Deferred |
| --- | ---: | ---: | ---: |
| App + Backend + Commerce + Chat (OpenAPI snapshot) | 153 | 153 | 0 |

**Rule:** BirdCoder product manifests, federated `sdkwork-iam` app/backend routers wired in standalone-gateway, and commerce gateway routes (`/api/v1/api-keys`, `/api/v1/notifications`, `/api/v1/usage`) fully cover the OpenAPI contract. The defer registry must report `deferredOperationCount: 0`.

### 2b. Commerce gateway lane (closed 2026-06-29)

| Field | Value |
| --- | --- |
| Lane | commerce (api-keys / notifications / usage) |
| Status | implemented |
| Gateway routes | `crates/sdkwork-birdcoder-standalone-gateway/src/routes/{api_keys,usage,notifications}.rs` |
| OpenAPI authority | `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/routeCatalog.ts` (`COMMERCE_API_CONTRACT`) |
| Operations | 15 |
| Closed | 2026-06-29 |
| Registry | `specs/coding-server-openapi-rust-defer-registry.json` |

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
2. OpenAPI defer registry regenerated: **153 of 153 implemented**, **0 deferred** (commerce gateway and chat routes wired in standalone-gateway; see §2b and §15).
3. `generate-birdcoder-http-route-manifests.mjs` synced with teams routes so manifest regeneration cannot drop coverage.
4. Contract tests require full OpenAPI implementation (`implementedOperationCount === 153`) and zero deferred operations (`deferredOperationCount === 0`).

## 8. Closed in Phase 6 (2026-06-24)

1. Capacitor Android headless `assembleDebug` in CI (`pnpm cap:android:assemble` after `h5:build` + `cap:sync`; Java 17 + Android SDK in `mobile-surfaces` job).
2. Root runner `scripts/run-h5-capacitor-android-assemble.mjs` verifies `app-debug.apk` output.
3. `h5-capacitor-android-assemble-contract.test.mjs` and `ci-flow-contract` guard the CI wiring.

## 9. Closed in Phase 7 (2026-06-24)

1. Governed release rehearsal entrypoints verified: `pnpm release:plan`, `pnpm release:fixture:ready`, and `pnpm release:candidate:dry-run` produce checksum-backed synthetic manifests (33 artifacts / 27 required targets) and pass `assertReleaseReadiness`.
2. `scripts/release-rehearsal-readiness-contract.test.mjs` guards CI upload, governance regression tracking, and manifest `releaseEvidenceStatus`.
3. `package-script-entrypoints-contract` realigned with expanded `check:arch` commercial gate chain.

## 10. Next serial closures (ordered)

1. Complete **full-profile** governed release matrix (all desktop/server/container/kubernetes targets in the active release profile) with production checksums/SBOM/signing evidence — local Windows rehearsal now packages/smokes server (windows/x64), container (linux/x64/cpu), kubernetes (linux/x64/cpu), and web; `release:assert-ready` remains **blocked** until every required target is present. Operator checklist: `docs/guides/operator/first-governed-release.md`.
2. Wire AI assistant replies (intelligence/runtime lane; mobile chat persistence is done).
3. Flutter Drive attachments when Dart `drive-app-sdk` consumer lands (contract-guarded defer).
4. iOS Capacitor headless build smoke on `macos-latest` CI (optional until App Store lane opens).

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

## 15. Chat backend integration (updated 2026-06-29)

**Status:** Phase A–C closed for H5 and Flutter; assistant generation remains a separate intelligence lane.

| Layer | Status | Evidence |
| --- | --- | --- |
| Rust chat service/repository/routes | Implemented | `sdkwork-birdcoder-chat-service`, `sdkwork-birdcoder-chat-repository-sqlx`, `sdkwork-routes-chat-app-api` |
| Database migration | Implemented | `database/migrations/*/0008_chat.*.sql` |
| Gateway wiring | Implemented | `standalone-gateway` routers + `route_manifest.rs` |
| OpenAPI + defer registry | 153 / 0 deferred | `specs/coding-server-openapi-rust-defer-registry.json` |
| Generated app SDK | Implemented | `client.system.chat.conversations.*` (TS) / `system.chatConversations*` (Flutter) |
| H5 chat UI | API-backed | `birdcoderMobileChatApi.ts`, `h5-chat/ChatPage.tsx` |
| Flutter chat UI | API-backed | `birdcoder_mobile_chat_api.dart`, `lib/pages/chat_page.dart` |

### Remaining closures

1. Assistant replies: message persistence is live on all mobile surfaces; AI assistant generation remains a separate intelligence/runtime lane.
2. Flutter Drive attachments: defer until a governed Dart `drive-app-sdk` consumer exists (PC/H5 Drive lane is closed).

## 17. Closed in Phase 13 (2026-06-29)

1. Commerce OpenAPI parity: `COMMERCE_API_CONTRACT` in `routeCatalog.ts` plus standalone-gateway handlers cover all 15 `/api/v1/*` operations; defer registry reports **153 implemented / 0 deferred** after chat lane closure.
2. Quality gates: `check:api-response-envelope`, `check:app-composition`, and `check:quality:mobile` wired into fast/standard quality tiers.
3. Native app composition (ADR-20260629): `component.spec.json#contracts.sdkDependencies` populated across PC/H5/Flutter; legacy `dependency.composition.json` forbidden by contract.
4. H5 Drive upload: chat attachments route through `@sdkwork/birdcoder-pc-infrastructure` Drive client via `h5-core` SDK exports.
5. Mobile route identity parity: H5 and Flutter settings route id `app.account.settings.index`; contract tests aligned.

## 18. Closed in Phase 14 (2026-06-29)

1. Mobile chat backend: service/repository/route crates, `0008_chat` migration, gateway wiring, and 6 `/app/v3/api/chat/*` OpenAPI operations (153 total / 0 deferred).
2. H5 chat persistence through `@sdkwork/birdcoder-app-sdk` `system.chat` client (`birdcoderMobileChatApi.ts`).
3. `scripts/chat-route-catalog-contract.test.mjs` guards route catalog, Rust manifest, and mobile chat SDK integration.

## 19. Closed in Phase 15 (2026-06-29)

1. Flutter mobile chat persistence through regenerated Dart app SDK (`pnpm run generate:sdk:birdcoder:flutter-mobile`) and `birdcoder_mobile_chat_api.dart`.
2. `scripts/flutter-mobile-chat-api-contract.test.mjs` forbids mock latency/replies and requires generated `system.chatConversations*` integration.

## 20. Closed in Phase 16 (2026-06-29)

1. Cross-surface mobile chat contract: `chat-route-catalog-contract` guards H5 `ChatPage` + `h5-core` SDK exports alongside Flutter and Rust manifests.
2. Chat route ProblemDetail mapping unit tests (`sdkwork-routes-chat-app-api`) for 404/400/403 and client-safe repository failures.
3. H5/Flutter `sdkwork.app.config.json` release evidence and highlights aligned with app SDK chat persistence (preLaunch honesty unchanged).

## 21. Closed in Phase 17 (2026-06-29)

1. PC surface `sdkwork.app.config.json` completed with DRAFT/preLaunch publish honesty, disabled install packages, and release evidence metadata aligned with root/H5/Flutter manifests.
2. `app-manifest-checksum-standard-contract` now guards PC surface manifest alongside H5 and Flutter.

## 22. Closed in Phase 18 (2026-06-29)

1. `scripts/surface-manifest-parity-contract.test.mjs` guards root + PC + H5 + Flutter manifest DRAFT/preLaunch/releaseEvidenceStatus parity.
2. Operator runbooks updated for 153/0 OpenAPI, mobile chat API-backed status, and four-manifest governed release promotion.

## 23. Closed in Phase 19 (2026-06-29)

1. `release-rehearsal-readiness-contract` and `commercial-readiness-truth-contract` guard `release:plan`, operator runbook OpenAPI/manifest parity, and four-surface governed release promotion rules.

## 24. Closed in Phase 20 (2026-06-29)

1. Fixed `sdkwork-birdcoder-codeengine` Codex CLI watchdog compile error (`child.id()` returns `u32`, not `Option<u32>`).
2. Aligned `sdkwork-birdcoder-kernel-bridge` with `RuntimeFacadeError` live-interaction trait signatures from `sdkwork-agents-runtime-facade`.
3. Fixed `sdkwork-birdcoder-coding-sessions-repository-sqlx` session-history copy SQL: added missing `uuid` column constants and corrected INSERT placeholder counts for message/turn/event/artifact rows.

`pnpm server:build` passes after this phase.

## 25. Closed in Phase 21 (2026-06-29)

1. `release:package:server` and CI lifecycle now use `pnpm run generate:openapi:coding-server` (`run-local-tsx.mjs`) instead of `node --experimental-strip-types`, fixing sibling `@sdkwork/iam-contracts` ESM resolution during OpenAPI export.
2. Broke `sdkwork-auth-runtime-pc-react` circular dependency (`sessionAuthUnauthorized.ts` ↔ `sessionAuthUnauthorizedEnv.ts`) by colocating `SDKWORK_SESSION_AUTH_UNAUTHORIZED_MODE_ENV_KEY` in the env module with type-only imports back to the public barrel.
3. Repaired Vite manual-chunk topology: co-located IDE service composition (`defaultIdeServices*`, `lazyDefaultIdeServices`) and headless auth runtime modules with `birdcoder-platform-api-client`; moved `consoleQueries` to `birdcoder-platform-storage`; removed infrastructure catch-all from `birdcoder-platform-runtime`; narrowed `defaultIdeServicesLoader` to `@sdkwork/birdcoder-pc-infrastructure/services/lazyDefaultIdeServices` with explicit tsconfig mapping to avoid barrel-induced chunk cycles.
4. Added `@sdkwork/auth-runtime-pc-react` subpath exports (`/handleSdkworkSessionAuthUnauthorizedError`, `/sdkSessionAuthError`, `/appbasePcAuthRuntime`) so BirdCoder SDK clients no longer import the auth-runtime barrel that re-exported `auth-pc-react` platform-auth-runtime modules.

`pnpm build`, `pnpm server:build`, and `pnpm release:package:server` pass after this phase.

## 26. Closed in Phase 22 (2026-06-30)

1. Fixed container/server release packaging on Windows dev hosts: `resolveServerBinaryCandidates` now falls back to the host-native `.exe` when a Linux/cross-compiled artifact is absent, while still bundling under the Linux descriptor filename inside the release archive.
2. Aligned server/container release smoke with canonical binary naming via `resolveServerBinaryFileName` (Windows server smoke now keys off manifest `platform`, not only `--target`).
3. Local governed release rehearsal on Windows now passes: `release:package:{server,container,kubernetes,web}`, `release:smoke:{server,container,kubernetes,web}`, `release:finalize`, and `release:smoke:finalized`. `release:assert-ready` correctly remains blocked with `releaseCoverage.status=partial` until the full multi-target profile is built (pre-launch honesty preserved).
4. Release smoke unit fixtures now use USTAR prefix-aware tar writers (`release-tar-test-fixtures.mjs`) so container bundle paths longer than 100 bytes match production archive layout.

## 28. Closed in Phase 23 (2026-06-30)

1. Standard alignment baseline: `sdkwork-agents` added to dependency-management whitelist; `.github/workflows/package.yml` exposes `sdkwork_agents_ref` / `SDKWORK_AGENTS_REF`.
2. Cross-surface chat contracts path unified to `apps/sdkwork-birdcoder-common/packages/sdkwork-birdcoder-chat-contracts` in `tsconfig.json`, Vite aliases, and contract tests (removed stale root `packages/` references).
3. Root typecheck restored: `defaultIdeServicesLoader` uses `@sdkwork/birdcoder-pc-infrastructure/services/lazyDefaultIdeServices` with explicit tsconfig mapping; infrastructure re-exports IDE service key types; `@sdkwork/utils` paths added for Drive SDK type resolution.
4. Utils standard coverage extended to `pc-shell` and `h5-chat` packages.
5. Fixed stale `sdkwork-search` Vite bridge paths (`search-pc-react`, `search-contracts`) and `prepare-shared-sdk-packages.mjs` bridge specs to match the current sdkwork-search repository layout.
6. Desktop Tauri capability contract aligned with Tauri 2 `capabilities/default.toml` source (includes app `default` permission bundle reference).
7. Application-package scan roots unified via `scripts/lib/birdcoder-package-scan-roots.mjs`; governance, structure, i18n, clipboard, provider-SDK, source-parse, and architecture contracts no longer scan the retired root `packages/` directory.
8. `pnpm-workspace.yaml` federation adds `../sdkwork-app-topology`; package-governance and structure checks assert app-root workspace globs (`apps/sdkwork-birdcoder-{pc,h5}/packages/...`) instead of legacy root `packages/sdkwork-birdcoder-*`.
9. UI bundle segmentation contract scopes subpath-import enforcement to UI shell surfaces and allows governed `@sdkwork/birdcoder-*` and `@sdkwork/utils/*` subpaths backed by explicit package exports.
10. OpenAPI route-count contract aligned to current gateway metadata: **104 app + 49 backend = 153 operations**.

## 30. Closed in Phase 24 (2026-06-30)

1. IAM runtime login authority: `iamRuntime.ts` constructs the appbase app client via `@sdkwork/birdcoder-pc-core/sdk` `createAppbaseAppSdkClient` (re-exporting `@sdkwork/iam-app-sdk`), preserving APP_COMPOSITION capability-package boundaries while satisfying IAM login authority separation from the product app SDK.
2. Auth-runtime import topology: production code keeps `@sdkwork/auth-runtime-pc-react/appbasePcAuthRuntime` subpath to avoid `birdcoder-platform-api-client ↔ birdcoder-platform-auth-runtime` Rollup circular chunks; contract test accepts canonical package root or `appbasePcAuthRuntime` subpath.
3. Utils adoption: `iamRuntime.ts` uses `@sdkwork/utils/string` `isBlank` via `readNonBlankString`; H5 `ChatPage` send gate uses `isBlank`; `h5-core` declares `@sdkwork/utils`; utils standard contract extended.
4. Core platform gates green: `check:dependency-management`, `check:utils-standard`, `check:drive-standard`, `check:web-framework-standard`, `check:database-framework-standard`, `check:api-response-envelope`, `check:app-composition`, `pnpm typecheck`, and `check:web-vite-build` pass on the alignment baseline.

## 29. Verification bundle

```bash
pnpm run check:dependency-management
pnpm run check:utils-standard
pnpm run typecheck
pnpm run check:web-framework-standard
pnpm run check:database-framework-standard
pnpm run check:arch
pnpm run check:api-response-envelope
pnpm run check:app-composition
pnpm run check:quality:mobile
pnpm run check:drive-standard
node scripts/commercial-readiness-truth-contract.test.mjs
node scripts/surface-manifest-parity-contract.test.mjs
node scripts/coding-server-openapi-rust-defer-registry-contract.test.mjs
node scripts/flutter-mobile-chat-api-contract.test.mjs
node scripts/run-local-tsx.mjs scripts/birdcoder-session-auth-redirect-contract.test.ts
node scripts/docker-container-readiness-contract.test.mjs
pnpm run check:server
node scripts/iam-seed-parity-contract.test.mjs
pnpm run check:governance-regression
cargo test -p sdkwork-birdcoder-kernel-bridge
cargo test -p sdkwork-birdcoder-chat-service
cargo test -p sdkwork-routes-chat-app-api
cargo test -p sdkwork-routes-workspace-app-api
cargo test -p sdkwork-routes-deployment-backend-api
node scripts/h5-capacitor-android-assemble-contract.test.mjs
node scripts/release-rehearsal-readiness-contract.test.mjs
node scripts/prelaunch-publish-gate-contract.test.mjs
node scripts/pc-server-module-size-contract.test.mjs
pnpm release:plan
pnpm release:fixture:ready
pnpm release:candidate:dry-run
pnpm server:build
pnpm build
pnpm docs:build
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
pnpm release:smoke:web
pnpm release:finalize
pnpm release:smoke:finalized
node scripts/release/release-build-paths-contract.test.mjs
node scripts/release/package-release-assets.test.mjs
```

## 13. 2026-06-30 alignment loop (current)

### Closed in this loop

1. Dependency governance baseline repaired:
   - `scripts/dependency-management-standard.test.mjs` now includes `sdkwork-agents` in allowed sibling dependency IDs, matching `sdkwork.workflow.json` and root `Cargo.toml`.
2. Workspace typecheck restored after chat-contract relocation:
   - `apps/sdkwork-birdcoder-pc/tsconfig.json` now resolves `@sdkwork/birdcoder-chat-contracts` and `@sdkwork/birdcoder-pc-infrastructure/services/lazyDefaultIdeServices`.
   - `apps/sdkwork-birdcoder-h5/tsconfig.json` now resolves `@sdkwork/birdcoder-chat-contracts`.
3. Workspace realtime rate-limit contract repaired:
   - `crates/sdkwork-routes-workspace-app-api/src/error.rs` maps rate limit failures with explicit `StatusCode::TOO_MANY_REQUESTS` and keeps `SdkWorkResultCode::RateLimitExceeded` payload semantics.
4. OpenAPI schema truth-source contract alignment repaired:
   - Plus-entity contract tests now read server schema definitions from `openApiSchemas.ts` (authoritative schema module) instead of `index.ts` barrel exports.

### Verified in this loop

- `pnpm run check:dependency-management` ✅
- `pnpm run typecheck` ✅
- `node scripts/workspace-realtime-subscriber-limit-contract.test.mjs` ✅
- `node scripts/multiwindow-turn-options-contract.test.mjs` ✅
- `node scripts/engine-plus-entity-standard-contract.test.mjs` ✅

### Remaining blocker (external federation dependency)

- `pnpm run check:quality:fast` now advances far deeper and fails at external sibling federation import resolution:
  - `Error [ERR_MODULE_NOT_FOUND]: .../sdkwork-iam-contracts/src/login-context.js`
- This is a cross-repository source/runtime resolution mismatch in sibling repository `sdkwork-iam`, not a BirdCoder local domain logic defect.
- Until sibling workspace source-mode import resolution is corrected, the full fast quality gate cannot reach complete green in this workspace.

### Action policy

1. Keep BirdCoder local gates green and continue debt elimination in-repo.
2. Track the `sdkwork-iam` module-resolution defect as a federation blocker.
3. Re-run `pnpm run check:quality:fast` immediately after sibling fix to confirm full closure.
