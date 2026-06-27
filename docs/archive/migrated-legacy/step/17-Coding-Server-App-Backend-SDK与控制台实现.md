# Step 17 - Coding-Server Core、App、Backend API与控制台实现

## 1. 目标与范围

把 `/docs/架构/20` 从协议标准推进到可执行事实源，先收敛 `coding-server` 的 TS 契约层，再逐步补齐 Rust handler、持久化、App Console、Admin Console。

## 2. 本轮已落地

- `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts`
  - `getBirdCoderCodingServerDescriptor()`
  - `getBirdCoderAppRuntimeApiContract()`
  - `getBirdCoderAppApiContract()`
  - `getBirdCoderBackendApiContract()`
  - `listBirdCoderCodingServerRoutes()`
  - `buildBirdCoderCodingServerOpenApiDocument()`
  - `executeBirdCoderCoreSessionRun()`
  - `streamBirdCoderCoreSessionEventEnvelopes()`
  - `createInMemoryBirdCoderCoreSessionProjectionStore()`
  - `persistBirdCoderCoreSessionRunProjection()`
- `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/projectionRepository.ts`
  - `buildBirdCoderCoreSessionProjectionBindings()`
  - `createProviderBackedBirdCoderCoreSessionProjectionStore()`
  - `createJsonBirdCoderCoreSessionProjectionStore()`
- `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host`
  - `build_app()`
  - `/app/v3/api/system/health`
  - `/app/v3/api/system/descriptor`
  - `/app/v3/api/system/runtime`
  - `/openapi/coding-server-v1.json`
  - representative `app / backend` placeholder routes with统一问题 envelope
- `packages/sdkwork-birdcoder-types/src/data.ts`
  - `coding_session_operation`
  - server projection storage bindings
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
  - `BIRDCODER_CODING_SERVER_API_VERSION`
  - `BirdCoderApiTransport`
  - `BirdCoderAppSdkApiClient / BirdCoderBackendSdkApiClient`
  - timestamped `project` summary DTOs
- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts`
  - typed app/backend client
  - in-process transport
  - HTTP transport boundary
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedWorkspaceService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts`
- 统一 `app / backend` 路由矩阵与 OpenAPI seed。
- 统一把 canonical engine runtime 投影为 `runtime / event / artifact / operation`。
- 统一 SSE envelope：`requestId`、`timestamp`、`data`、`meta.version`。
- 增加最小 projection store，允许同一 `coding_session` 聚合多 turn 的 runtime、event、artifact、operation。
- 增加 provider-scoped table repository 版 projection store，允许基于共享 data-kernel binding 读回 runtime、event、artifact、operation 快照。
- 共享 data-kernel 已补齐 Node 直跑时的 in-memory fallback，使 provider 合同测试不依赖浏览器 `window.localStorage`。
- Rust host 已切到统一 `core` 前缀，并移除旧 `/health` 文本接口。
- Rust OpenAPI 已补齐 representative `app / backend` 路由矩阵，不再只暴露 3 个 core 路径。
- 修复 event id 生成规则，改为 turn-aware，避免同一 runtime 多 turn 时撞 id。
- 修复 direct Node 合同测试链路，合同执行路径改为跨包源码相对导入，避免 TS path alias 阻断。

## 3. 当前闭环边界

已闭环：

- Descriptor、Route Matrix、OpenAPI Seed
- Core Session Run Projection
- SSE Envelope Replay
- Step 18 canonical runtime 到 Step 17 server projection 的接线
- 基于共享 data-kernel table repository 的 provider-scoped projection read/write
- Shared data-kernel now exposes reusable `StorageProvider` / `UnitOfWork` primitives through `createBirdCoderStorageProvider()` plus `open / healthCheck / runMigrations / beginUnitOfWork`.
- Provider-backed projection persistence now commits `runtime / event / artifact / operation` through one UoW boundary and keeps staged rows invisible before commit.
- Rust host 最小 `core` 路由骨架与统一 JSON envelope
- Rust host representative `app / backend` OpenAPI parity
- Rust host representative list reads now return unified empty list envelopes on `/app/v3/api/engines`, `/app/v3/api/workspaces`, and `/backend/v3/api/releases`
- Rust host now exposes projection-backed read handlers on `/app/v3/api/coding_sessions/:id`, `/app/v3/api/operations/:operationId`, `/app/v3/api/coding_sessions/:id/events`, `/app/v3/api/coding_sessions/:id/artifacts`, and `/app/v3/api/coding_sessions/:id/checkpoints`
- Rust host missing projection reads now return unified `not_found` problem envelopes instead of `not_implemented`
- Rust host now treats the shared desktop SQLite authority file as the primary runtime source through `BIRDCODER_CODING_SERVER_SQLITE_FILE`; when it encounters only legacy `coding-session` + `table.sqlite.*` `kv_store` rows, startup materializes the matching direct provider tables once before serving reads
- Rust host startup now resolves authority bootstrap from the default `bird-server.config.json` first and falls back to env vars second; `build_app_from_runtime_config()` removes the previous env-only startup dependency, and the shared TS path now closes provider/UoW semantics without ad hoc projection writes
- `BIRDCODER_CODING_SERVER_SNAPSHOT_FILE` is retained only as a transition fallback bridge when the shared SQLite authority file is not yet available
- `packages/sdkwork-birdcoder-types/src/data.ts` now exposes `coding_session_checkpoint` storage binding so checkpoint authority keying stays on the shared type standard
- Rust host now exposes representative real app/backend handlers on `/app/v3/api/projects`, `/app/v3/api/teams`, `/backend/v3/api/iam/teams`, and `/backend/v3/api/releases`; these routes now return unified list envelopes backed by runtime state instead of placeholder or empty-shell payloads
- The shared type standard now also exposes `workspace` / `project` / `team` / `release_record` storage bindings so app/backend truth paths reuse the same authority-key naming model as app runtime projection resources
- Desktop `src-tauri` SQLite bootstrap now creates the first real direct authority tables for `coding_sessions` / `coding_session_runtimes` / `coding_session_events` / `coding_session_artifacts` / `coding_session_checkpoints` / `coding_session_operations` / `projects` / `teams` / `release_records`, records `coding-server-kernel-v2`, and keeps `kv_store` as a bridge instead of the only authority shape
- Desktop `local_store_set` / `local_store_delete` now mirror shared `table.sqlite.*` table payloads into those real provider tables, and first-open backfill replays existing `kv_store` rows once so older local authority data becomes Rust-readable without manual migration
- Rust host now materializes legacy `kv_store` authority into the full direct SQLite provider-table set once and then reads only provider tables at runtime, eliminating `kv_store` as a normal host-side truth path
- Shared storage migration bundles now include `project` and `release_record` inside `coding-server-kernel-v2`, so the TS migration definition matches the representative app/backend direct authority subset actually used by Step 17

未闭环：

- 当前文档顶部不再保留新的非环境未闭环项；Representative route、共享 provider/UoW、OpenAPI export/codegen、explicit app/backend SDK client pair、console adoption、approval、document、audit、deployment、policy 等闭环已在本页 `11` 到 `33` 节完成回写。
- Representative placeholder routes 已全部关闭，当前真相为 `none`。
- PostgreSQL live-smoke preflight governance 已在 `34` 节关闭，主机实证 `passed` 闭环已在 `35` 节记录。
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
- Step 17 的后续非环境串行切片已在关闭后移交到 `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md`，后续主循环不应在无新失败证据时重开本 Step。

## 4. 非目标

- 不新增宿主私有 API 前缀
- 不让页面直连 engine 原生协议
- 不为了兼容旧实现保留双协议

## 5. 串并行策略

串行主路径：

1. `types -> server contract -> Rust handler`
2. `handler -> repository/persistence -> replay/recovery`
3. `SDK -> App Console / Admin Console`

可并行车道：

- `A1` 路由矩阵、OpenAPI seed、合同测试
- `A2` Rust handler 与 SSE/operation 落地
- `A3` App/Backend Console 接统一 SDK

并行约束：

- `A2` 必须消费 `A1` 已冻结 DTO 与路由。
- `A3` 必须消费 `A1/A2` 冻结后的 SDK，不允许反向定义 DTO。

## 6. 检查点

- `CP17-1` `app / backend` 路由前缀冻结
- `CP17-2` OpenAPI seed 与 route contract 对齐
- `CP17-3` canonical runtime 可投影为 core session 事件流
- `CP17-4` SSE envelope 可回放同一事件序列
- `CP17-5` Rust handler 接手前，TS 契约测试全部可执行

## 7. 验证命令

- `pnpm.cmd run test:coding-server-route-contract`
- `pnpm.cmd run test:coding-server-openapi-contract`
- `pnpm.cmd run test:split-sdk-consumer-contract`
- `pnpm.cmd run test:coding-server-sse-contract`
- `pnpm.cmd run test:coding-server-projection-store-contract`
- `pnpm.cmd run test:coding-server-projection-repository-contract`
- `pnpm.cmd run test:coding-server-provider-projection-repository-contract`
- `pnpm.cmd run test:sql-storage-plan-contract`
- `pnpm.cmd run test:sql-executor-migration-binding-contract`
- `pnpm.cmd run test:engine-runtime-adapter`
- `pnpm.cmd run test:sql-executor-table-repository-contract`
- `pnpm.cmd run test:sql-executor-projection-repository-contract`
- `cargo test --offline --manifest-path packages/sdkwork-birdcoder-desktop/src-tauri/Cargo.toml`
- `cargo test --offline --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml`
- `pnpm.cmd run check:server`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`

## 8. 结果判定

达成：

- `web / desktop / server` 已共享同一套 server contract 标准入口。
- 多 engine runtime 已能稳定投影到统一 core session 语义。
- 新增 Step 17 合同测试已纳入根脚本，可重复执行。
- server 侧已经具备最小聚合快照能力、provider-scoped table repository 契约，以及 shared data-kernel 持久化接线。
- Rust host 已有最小 app/backend 路由骨架，可承接后续完整 handler 与 replay 接线。
- Rust host OpenAPI 已能覆盖 representative `app / backend` 路径与 operationId。

未达成：

- 当前无新的非环境未达成项；只有 fresh failing evidence 或未来 `release:smoke:postgresql-live` 重跑回归，才允许重新打开 Step 17。

## 9. 下一步最短路径

1. 不要在没有 fresh failing evidence 的情况下重开 Step 17 的 representative route、OpenAPI/codegen、explicit app/backend SDK client pair、console adoption 或 PostgreSQL 治理闭环。
2. 若未来重跑 `pnpm.cmd run release:smoke:postgresql-live`，必须继续如实区分 `blocked | failed | passed`，并仅按新鲜结果回写。
3. Step 17 关闭后的下一条非环境串行切片是 `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md`；当前主循环真相已经继续推进到后续 Step。

## 10. 风险与约束

- 如果 Rust handler 先行但不消费当前 types/server contract，会再次产生双标准。
- 如果 Console 先接假 DTO，再回补 SDK，会形成第二次协议漂移。
- 所有后续实现必须延续本轮“合同先冻结、实现再接入、测试最后回归”的顺序。
## 11. Current Loop Addendum - Generated OpenAPI Export And Server Release Sidecar

- `buildBirdCoderCodingServerOpenApiDocument()` now drives the canonical `coding-server` OpenAPI export.
- `scripts/coding-server-openapi-export.ts` materializes `artifacts/openapi/coding-server-v1.json`.
- `release:package:server` now packages that snapshot into `artifacts/release/server/<platform>/<arch>/openapi/coding-server-v1.json`.
- `release:smoke:server` now verifies:
  - server manifest exists
  - archive exists
  - manifest references the OpenAPI sidecar
  - sidecar file exists
- `local-release-command package server` now emits auditable package output paths instead of descriptor-only output.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; downstream SDK/codegen and finalized release reuse already consume the canonical exported snapshot.

## 12. Current Loop Addendum - Finalized OpenAPI Governance And Codegen Input

- Finalized release assets now publish `codingServerOpenApiEvidence` when server assets exist.
- Finalized smoke now re-verifies that summary against packaged OpenAPI sidecars.
- Rendered release notes now display the same canonical OpenAPI summary.
- `scripts/coding-server-openapi-codegen-input.mjs` now resolves the finalized canonical snapshot path for downstream SDK/codegen consumers.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the first real generated SDK/codegen artifact was closed later on this page.

## 13. Current Loop Addendum - Finalized OpenAPI Types Codegen Lane

- `scripts/generate-coding-server-openapi-types.mjs` now closes the first real generated SDK/codegen artifact on top of the finalized manifest summary.
- The generated output is fixed to `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`.
- `@sdkwork/birdcoder-types` now exports that generated module, so later app/backend/core SDK work can consume one release-backed operation catalog.
- `check:release-flow` now includes `scripts/generate-coding-server-openapi-types.test.mjs`.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the typed client/helper surface now consumes the exported generated operation catalog instead of the raw snapshot.

## 14. Current Loop Addendum - Finalized Typed Client Codegen Lane

- `scripts/generate-coding-server-client-types.ts` now closes the second-stage generated SDK/client lane on top of `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`.
- The generated output is fixed to `packages/sdkwork-birdcoder-types/src/generated/coding-server-client.ts`.
- `@sdkwork/birdcoder-types` now exports that generated client module, so shared consumers can resolve request metadata from one release-backed operation catalog instead of hand-writing route strings.
- `sdkClients.ts` is now the first representative consumer of the generated request builder for default workspace/project/team/release reads.
- `scripts/generate-coding-server-client-types.test.ts` now includes a TypeScript regression contract that proves:
  - route-less operations do not require `pathParams`
  - route-param operations still require `pathParams`
- `check:release-flow` now includes `scripts/generate-coding-server-client-types.test.ts`.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; representative generated-client adoption now sits behind shared high-level facades plus the later typed response/write facades.

## 15. Current Loop Addendum - Generated App/Backend SDK Client

- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now owns `createBirdCoderAppSdkApiClient({ transport: appTransport }) and createBirdCoderBackendSdkApiClient({ transport: backendTransport })` on top of `createBirdCoderFinalizedCodingServerClient()`.
- The explicit app/backend SDK client pair is now the approved representative entry for:
  - `/app/v3/api/workspaces`
  - `/app/v3/api/projects`
  - `/backend/v3/api/iam/teams`
  - `/backend/v3/api/releases`
- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now delegates to that explicit app/backend SDK client pair and keeps only in-process/HTTP transport wiring locally.
- `scripts/split-sdk-client-facade-contract.test.ts` now verifies representative path/query/list-envelope behavior for the explicit app/backend SDK client pair.
- `check:release-flow` now executes that contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the same direct app/backend client pattern now covers the remaining representative `app / backend` consumers without reopening host-local route assembly.

## 16. Current Loop Addendum - Default IDE Services App/Backend SDK Adoption

- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts` now builds transport-based representative app/backend clients directly through `createBirdCoderAppSdkApiClient({ transport: appTransport }) and createBirdCoderBackendSdkApiClient({ transport: backendTransport })`.
- Runtime HTTP composition and in-process fallback composition are both now aligned with the explicit app/backend SDK client pair.
- `scripts/default-ide-services-split-sdk-client-contract.test.ts` now verifies this default-composition rule.
- `check:release-flow` now executes that contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the direct app/backend client adoption rule already covers the remaining representative `app / backend` transport consumers.

## 17. Current Loop Addendum - App/Backend Wrapper Removal

- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now owns transport factories only and no longer exports a mixed split SDK wrapper.
- `scripts/split-sdk-consumer-contract.test.ts` now consumes `createBirdCoderAppSdkApiClient({ transport: appTransport }) and createBirdCoderBackendSdkApiClient({ transport: backendTransport })` directly.
- `scripts/birdcoder-sdk-consumer-boundary-contract.test.mjs` now prevents the deleted wrapper from reappearing.
- `check:release-flow` now executes that contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the same transport-only versus direct app/backend client cutover now covers the later representative consumers.

## 18. Current Loop Addendum - App Runtime SDK Read Facade

- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now owns `createBirdCoderAppSdkApiClient({ transport })`.
- The current app runtime SDK facade closes only the implemented representative routes:
  - `/app/v3/api/system/descriptor`
  - `/app/v3/api/system/runtime`
  - `/app/v3/api/system/health`
  - `/app/v3/api/engines`
  - `/app/v3/api/operations/:operationId`
- `scripts/app-runtime-read-sdk-client-contract.test.ts` now verifies those five routes on one shared generated-client-based facade.
- `check:release-flow` now executes that contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the implemented app runtime projection reads already sit behind the same explicit app/backend SDK client pair pattern.

## 19. Current Loop Addendum - App Runtime SDK Projection Read Facade

- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now extends `createBirdCoderAppSdkApiClient({ transport })` to the already implemented projection reads for:
  - `/app/v3/api/coding_sessions/:id`
  - `/app/v3/api/coding_sessions/:id/events`
  - `/app/v3/api/coding_sessions/:id/artifacts`
  - `/app/v3/api/coding_sessions/:id/checkpoints`
- Shared projection-read mapping now lands directly on:
  - `BirdCoderCodingSessionSummary`
  - `BirdCoderCodingSessionEvent[]`
  - `BirdCoderCodingSessionArtifact[]`
  - `BirdCoderCodingSessionCheckpoint[]`
- `scripts/app-runtime-projection-read-sdk-client-contract.test.ts` now verifies the four method/path bindings on one shared generated-client-based facade.
- `check:release-flow` now executes that contract beside the earlier representative app runtime read facade contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; direct app/backend client adoption already covers the remaining representative `app / backend` transport consumers.

## 20. Current Loop Addendum - App Team Surface Split

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now splits team reads on the shared app/backend facade:
  - `listTeams()` -> `/app/v3/api/teams`
  - `listAdminTeams()` -> `/backend/v3/api/iam/teams`
- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now serves both routes in the in-process transport, so runtime team reads no longer piggyback on the backend-only governance surface.
- `ApiBackedTeamService` and the default host-derived runtime transport path now consume the app-surface team catalog by default.
- `scripts/split-sdk-client-facade-contract.test.ts`, `scripts/split-sdk-consumer-contract.test.ts`, and `scripts/server-runtime-transport-contract.test.ts` now verify:
  - explicit app/backend SDK client pair route split
  - default IDE team reads on the app surface
  - server runtime transport parity on the app surface
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the remaining real transport consumers already follow the direct app/backend client adoption rule.

## 21. Current Loop Addendum - Default IDE Release Service Adoption

- `BirdCoderBackendSdkApiClient.listReleases()` remains the explicit backend release catalog reader on `GET /backend/v3/api/releases`.
- `packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IReleaseService.ts` and `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedReleaseService.ts` now close the first representative governed release-read service boundary on top of the shared app/backend facade.
- `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, and `useReleases()` now expose one default IDE/app consumer path for governed release catalogs without rebuilding backend HTTP or DTOs locally.
- `scripts/default-ide-services-release-service-contract.test.ts` now locks this closure into `check:release-flow`.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the implemented app runtime projection read facade is already adopted by app-level coding-session detail consumers.

## 22. Current Loop Addendum - Default IDE App Runtime Read Adoption

- `packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IAppRuntimeReadService.ts` and `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedAppRuntimeReadService.ts` now close the first default service boundary on top of `BirdCoderAppRuntimeReadSdkApiClient`.
- Runtime-bound default IDE services now compose `createBirdCoderAppSdkApiClient({ transport: createBirdCoderHttpApiTransport(...) })` directly instead of rebuilding app runtime request paths locally.
- `createDefaultBirdCoderIdeServices()`, `IDEContext`, and `ServiceContext` now expose `appRuntimeReadService`; `useCodingServerOverview()` is the first app-level consumer of descriptor/runtime/health/engine overview reads.
- When no runtime-bound `apiBaseUrl` or injected `appRuntimeReadClient` exists, app runtime reads stay explicitly unavailable; this loop does not claim a local in-process app runtime transport closure.
- `scripts/default-ide-services-app-runtime-read-sdk-contract.test.ts` and `scripts/default-ide-services-app-runtime-read-service-contract.test.ts` now lock this adoption into `check:release-flow`.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the implemented app runtime projection read facade is already adopted by app-level coding-session detail consumers.

## 23. Current Loop Addendum - App-Level Coding Session Projection Consumer Adoption

- `packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts` now exposes:
  - `loadCodingSessionProjection(appRuntimeReadService, codingSessionId)`
  - `useCodingSessionProjection(codingSessionId)`
- The new app-level consumer slice reads:
  - `getCodingSession()`
  - `listCodingSessionEvents()`
  - `listCodingSessionArtifacts()`
  - `listCodingSessionCheckpoints()`
- `packages/sdkwork-birdcoder-commons/src/context/ideServices.ts` now keeps shared service access available from a non-JSX module so direct Node contracts can validate the same consumer boundary without inventing alternate runtime wiring.
- `scripts/coding-session-projection-app-consumer-contract.test.ts` now locks this closure into `check:release-flow`.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the typed app runtime write SDK facade and first consumer path were closed after this checkpoint.

## 24. Current Loop Addendum - App Runtime SDK Facade Exclusion Governance

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes explicit governance metadata for the app runtime SDK facade:
  - `BIRDCODER_APP_RUNTIME_SDK_OPERATION_IDS`
  - `BIRDCODER_APP_RUNTIME_SDK_EXCLUDED_OPERATION_IDS`
  - promoted app runtime operation governance
  - excluded app runtime operation governance
- The promoted catalog now covers only the already-real high-level operations:
  - `descriptor.retrieve`
  - `runtime.retrieve`
  - `health.retrieve`
  - `engines.list`
  - `operations.retrieve`
  - `codingSessions.retrieve`
  - `codingSessions.events.list`
  - `codingSessions.artifacts.list`
  - `codingSessions.checkpoints.list`
- The excluded catalog now makes the current blocked routes explicit:
  - `engines.capabilities.retrieve`
  - `models.list`
  - `codingSessions.create`
  - `codingSessions.turns.create`
  - `approvals.decisions.create`
- `scripts/app-runtime-sdk-facade-governance-contract.test.ts` now proves the excluded operations still exist in the low-level generated client while staying outside the shared high-level facade, and `check:release-flow` executes that contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; `codingSessions.create` is already promoted through the typed shared write facade.

## 25. Current Loop Addendum - Typed App Runtime Create Session Facade And Consumer Adoption

- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now exposes `createBirdCoderAppSdkApiClient({ transport })` for the promoted `codingSessions.create` operation.
- app runtime SDK governance is now split as:
  - promoted: `codingSessions.create` plus the existing implemented app runtime read operations
  - excluded: `engines.capabilities.retrieve`, `models.list`, `codingSessions.turns.create`, `approvals.decisions.create`
- `createDefaultBirdCoderIdeServices()` now resolves `appRuntimeWriteClient` in this order:
  - explicit `appRuntimeWriteClient`
  - runtime-configured `appRuntimeWriteClient`
  - runtime HTTP transport composed through `createBirdCoderAppSdkApiClient({ transport: createBirdCoderHttpApiTransport(...) })`
  - no remote app runtime write SDK client, which falls back to the existing local project sidecar write path
- `ApiBackedProjectService.createCodingSession()` now closes the first real consumer path on top of the shared typed app runtime write SDK facade:
  - resolve `workspaceId` from project truth
  - call the remote server-authoritative `codingSessions.create`
  - mirror the returned session into local project session state
  - preserve the server-generated session id across refreshed project catalogs
- `ProviderBackedProjectService` now implements a local `upsertCodingSession()` mirror path so remote creates do not disappear after `useProjects().fetchProjects()`.
- Executable governance for this closure now includes:
  - `scripts/app-runtime-write-sdk-client-contract.test.ts`
  - `scripts/default-ide-services-app-runtime-write-sdk-contract.test.ts`
  - `scripts/api-backed-project-service-app-runtime-create-coding-session-contract.test.ts`
- Follow-on closure from this point is now superseded by later Step 17 writebacks; `codingSessions.turns.create` no longer remains excluded after the later facade and consumer closure.

## 26. Current Loop Addendum - Real App Runtime Create Session Turn Route

- `crates/sdkwork-birdcoder-standalone-gateway/src/lib.rs` now makes `POST /app/v3/api/coding_sessions/:id/turns` a real authority write route instead of `not_implemented`.
- Rust host turn creation now:
  - validates `requestKind` plus `inputSummary`
  - returns `201 Created` with a real turn payload
  - appends one readable `turn.started` event plus one readable operation record
  - persists `coding_session_turns`, `coding_session_events`, and `coding_session_operations` in sqlite-provider mode
  - refreshes `coding_sessions.updated_at` / `last_turn_at` plus runtime state before reloading provider-backed projections
- Executable verification for this closure now includes:
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml create_coding_session_turn_route_returns_created_turn_and_makes_projection_readable`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml create_coding_session_turn_route_returns_not_found_for_missing_session`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml create_coding_session_turn_route_persists_into_sqlite_provider_authority`
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the typed app runtime write SDK facade for `codingSessions.turns.create` and its first real consumer path are already closed.

## 27. Current Loop Addendum - Typed App Runtime Create Session Turn Facade And Consumer Adoption

- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now exposes `createBirdCoderAppSdkApiClient({ transport }).createCodingSessionTurn(...)`.
- app runtime SDK governance is now split as:
  - promoted: `codingSessions.turns.create`, `codingSessions.create`, and the existing implemented app runtime read operations
  - excluded: `engines.capabilities.retrieve`, `models.list`, `approvals.decisions.create`
- `ApiBackedProjectService.addCodingSessionMessage()` now closes the first real consumer path on top of the shared typed turn-write facade:
  - supported local message roles map to canonical turn request kinds
  - remote turn creation writes the server-authoritative `turnId` back into local message state
  - missing-session `404` falls back to the local sidecar path so older local-only sessions remain usable
- `ProviderBackedProjectService.addCodingSessionMessage()` now preserves mirrored `turnId` and `metadata`, so refreshed project catalogs keep the server-created turn link instead of dropping it.
- Executable governance for this closure now includes:
  - `scripts/app-runtime-write-sdk-client-contract.test.ts`
  - `scripts/app-runtime-sdk-facade-governance-contract.test.ts`
  - `scripts/api-backed-project-service-app-runtime-create-coding-session-turn-contract.test.ts`
- Follow-on closure from this point is now superseded by later Step 17 and architecture writebacks; `engines.capabilities.retrieve` plus `models.list` are already real and promoted in the app runtime read SDK facade.

## 28. Current Loop Addendum - Real App Runtime Approval Decision Lane

- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now exposes `createBirdCoderAppSdkApiClient({ transport }).submitApprovalDecision(approvalId, request)`.
- app runtime SDK governance is now fully promoted for currently real app runtime routes:
  - promoted: `approvals.decisions.create`, `codingSessions.turns.create`, `codingSessions.create`, and the existing implemented app runtime read operations
  - excluded: none
- `crates/sdkwork-birdcoder-standalone-gateway/src/lib.rs` now makes `POST /app/v3/api/approvals/:approvalId/decision` a real authority write route instead of `not_implemented`.
- Approval authority truth is now replayable in both execution modes:
  - demo/snapshot-backed host mutates shared projection authority
  - sqlite provider-backed host persists checkpoint/event/operation/turn state, then reloads projection truth from provider tables
- `IAppRuntimeWriteService`, `ApiBackedAppRuntimeWriteService`, default IDE service composition, and shared contexts now expose approval submission through one typed write boundary.
- `loadCodingSessionApprovalState()`, `submitCodingSessionApprovalDecision()`, and `useCodingSessionApprovalState()` now close the first real approval-facing consumer path on top of that facade.
- Canonical approval-resolution replay now uses `operation.updated.payload.approvalDecision`; do not emit a duplicate `decision` event field.
- Executable verification for this closure now includes:
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml submit_approval_decision_route`
  - `pnpm.cmd run test:app-runtime-write-sdk-client-contract`
  - `pnpm.cmd run test:app-runtime-sdk-facade-governance-contract`
  - `pnpm.cmd run test:coding-session-approval-consumer-contract`
  - `pnpm.cmd run test:api-backed-project-service-app-runtime-create-coding-session-contract`
  - `pnpm.cmd run test:api-backed-project-service-app-runtime-create-coding-session-turn-contract`
  - `pnpm.cmd run typecheck`
- Follow-on closure from this point is now recorded in sections `29` through `35`; the remaining representative app/backend routes and PostgreSQL host-pass lane no longer stay open.

## 29. Current Loop Addendum - Real App Document Catalog Lane

- `crates/sdkwork-birdcoder-standalone-gateway/src/lib.rs` now makes `GET /app/v3/api/documents` a real authority read route instead of `not_implemented`.
- Representative document catalog truth is now replayable in all current authority modes:
  - demo host reads `AppState.documents`
  - legacy sqlite `kv_store` materializes `table.sqlite.project-documents.v1` into provider-side `project_documents`
  - direct sqlite provider reads `project_documents`
- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now exposes `createBirdCoderAppSdkApiClient({ transport: appTransport }) and createBirdCoderBackendSdkApiClient({ transport: backendTransport }).listDocuments()`.
- `appConsoleRepository.ts`, `consoleQueries.ts`, and `sdkClients.ts` now promote `project_documents` into the shared repository/query/transport boundary instead of leaving documents on mock-only state.
- `IDocumentService`, `ApiBackedDocumentService`, default IDE service composition, shared contexts, `loadDocuments()`, and `useDocuments()` now close the first document-facing consumer path on top of the shared app/backend facade.
- Executable verification for this closure now includes:
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured`
  - `pnpm.cmd run test:split-sdk-client-facade-contract`
  - `pnpm.cmd run test:provider-backed-console-contract`
  - `pnpm.cmd run test:split-sdk-consumer-contract`
  - `pnpm.cmd run test:default-ide-services-document-service-contract`
  - `pnpm.cmd run test:document-app-consumer-contract`
- `pnpm.cmd run typecheck`
- Follow-on closure from this checkpoint is now recorded in sections `30` through `35`.

## 30. Current Loop Addendum - Real Admin Audit Lane

- `crates/sdkwork-birdcoder-standalone-gateway/src/lib.rs` now makes `GET /backend/v3/api/iam/audit_events` a real authority read route instead of `not_implemented`.
- Representative audit catalog truth is now replayable in all current authority modes:
  - demo host reads in-process audit state
  - legacy sqlite `kv_store` materializes `table.sqlite.audit-events.v1` into provider-side `audit_events`
  - direct sqlite provider reads `audit_events`
- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now exposes `createBirdCoderAppSdkApiClient({ transport: appTransport }) and createBirdCoderBackendSdkApiClient({ transport: backendTransport }).listAuditEvents()`.
- `appConsoleRepository.ts`, `consoleQueries.ts`, and `sdkClients.ts` now promote `audit_events` into the shared repository/query/transport boundary instead of leaving audit reads on mock-only state.
- `IAuditService`, `ApiBackedAuditService`, default IDE service composition, shared contexts, `loadAuditEvents()`, and `useAuditEvents()` now close the first audit-facing consumer path on top of the shared app/backend facade.
- Executable verification for this closure now includes:
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured`
  - `pnpm.cmd run test:split-sdk-client-facade-contract`
  - `pnpm.cmd run test:default-ide-services-audit-service-contract`
  - `pnpm.cmd run test:audit-admin-consumer-contract`
  - `pnpm.cmd run test:sqlite-app/backend-repository-contract`
- `pnpm.cmd run test:provider-backed-console-contract`
- `pnpm.cmd run test:split-sdk-consumer-contract`
- `pnpm.cmd run typecheck`
- Follow-on closure from this checkpoint is now recorded in sections `31` through `35`.

## 31. Current Loop Addendum - Real App Deployment Catalog Lane

- `crates/sdkwork-birdcoder-standalone-gateway/src/lib.rs` now makes `GET /app/v3/api/deployments` a real authority read route instead of `not_implemented`.
- Representative deployment catalog truth is now replayable in all current authority modes:
  - demo host reads in-process deployment state
  - legacy sqlite `kv_store` materializes deployment payloads into provider-side `deployment_records`
  - direct sqlite provider reads `deployment_records`
- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now exposes `createBirdCoderAppSdkApiClient({ transport: appTransport }) and createBirdCoderBackendSdkApiClient({ transport: backendTransport }).listDeployments()`.
- `appConsoleRepository.ts`, `consoleQueries.ts`, and transport-backed app/backend client wiring now promote `deployment_records` through the shared repository/query/transport boundary instead of leaving deployment reads on mock-only state.
- `IDeploymentService`, `ApiBackedDeploymentService`, default IDE service composition, shared contexts, `loadDeployments()`, and `useDeployments()` now close the first deployment-facing consumer path on top of the shared app/backend facade.
- Executable verification for this closure now includes:
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured -- --nocapture`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`
  - `pnpm.cmd run test:split-sdk-client-facade-contract`
  - `pnpm.cmd run test:provider-backed-console-contract`
  - `pnpm.cmd run test:sqlite-app/backend-repository-contract`
  - `pnpm.cmd run test:split-sdk-consumer-contract`
  - `pnpm.cmd run test:default-ide-services-deployment-service-contract`
  - `pnpm.cmd run test:deployment-app-consumer-contract`
  - `pnpm.cmd run typecheck`
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`
- Remaining representative placeholder routes at this checkpoint were:
  - `GET /backend/v3/api/iam/policies`
  - `GET /backend/v3/api/deployments`
- Follow-on closure from this checkpoint is now recorded in sections `32` through `35`.

## 32. Current Loop Addendum - Real Admin Deployment Governance Lane

- `crates/sdkwork-birdcoder-standalone-gateway/src/lib.rs` now makes `GET /backend/v3/api/deployments` a real authority read route instead of `not_implemented`.
- Representative backend deployment truth is now replayable in all current authority modes:
  - demo host reads in-process deployment state
  - legacy sqlite `kv_store` materializes deployment payloads into provider-side `deployment_records`
  - direct sqlite provider reads `deployment_records`
- `packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts` now exposes `createBirdCoderAppSdkApiClient({ transport: appTransport }) and createBirdCoderBackendSdkApiClient({ transport: backendTransport }).listAdminDeployments()`.
- In-process transport plus the shared deployment query/repository layer now serve both app/backend deployment surfaces from one authority path without DTO drift.
- `IAdminDeploymentService`, `ApiBackedAdminDeploymentService`, default IDE service composition, shared contexts, `loadAdminDeployments()`, and `useAdminDeployments()` now close the first backend deployment-facing consumer path on top of the shared app/backend facade.
- Executable verification for this closure now includes:
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured -- --nocapture`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`
  - `pnpm.cmd run test:split-sdk-client-facade-contract`
  - `pnpm.cmd run test:split-sdk-consumer-contract`
  - `pnpm.cmd run test:default-ide-services-admin-deployment-service-contract`
  - `pnpm.cmd run test:admin-deployment-consumer-contract`
  - `pnpm.cmd run typecheck`
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`
- Remaining representative placeholder routes at this checkpoint were:
  - `GET /backend/v3/api/iam/policies`
- Follow-on closure from this checkpoint is now recorded in sections `33` through `35`.

## 33. Current Loop Addendum - Real Admin Policy Governance Lane

- `crates/sdkwork-birdcoder-standalone-gateway/src/lib.rs` now makes `GET /backend/v3/api/iam/policies` a real authority read route instead of `not_implemented`.
- Representative backend policy truth now converges on one dedicated governance authority path:
  - demo host: in-process policy state
  - legacy sqlite `kv_store`: `table.sqlite.governance-policies.v1` materialized into `governance_policies`
  - direct sqlite provider: `governance_policies`
- `packages/sdkwork-birdcoder-types/src/data.ts` and `server-api.ts` now freeze the dedicated authority model plus the explicit app/backend SDK client pair entry `listPolicies()`.
- `appConsoleRepository.ts`, `consoleQueries.ts`, and transport-backed app/backend client wiring now promote `governance_policies` through the shared repository/query/transport boundary.
- `IAdminPolicyService`, `ApiBackedAdminPolicyService`, default IDE service composition, shared contexts, `loadAdminPolicies()`, and `useAdminPolicies()` now close the first reusable backend policy consumer path on top of the shared app/backend facade.
- Executable verification for this closure now includes:
  - `pnpm.cmd run test:split-sdk-client-facade-contract`
  - `pnpm.cmd run test:split-sdk-consumer-contract`
  - `pnpm.cmd run test:default-ide-services-admin-policy-service-contract`
  - `pnpm.cmd run test:admin-policy-consumer-contract`
  - `pnpm.cmd run test:sqlite-app/backend-repository-contract`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured -- --nocapture`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`
  - `cargo test --manifest-path crates/sdkwork-birdcoder-standalone-gateway/Cargo.toml`
  - `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`
- `pnpm.cmd run check:release-flow`
- Remaining representative placeholder routes are now:
  - none
- Step 17 no longer has a remaining non-environmental representative route gap.
- Follow-on closure from this point was the PostgreSQL host-pass evidence recorded in section `35`; the next non-environmental serial slice then moved to `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md`.

## 34. Current Loop Addendum - PostgreSQL Live Smoke Governance Promotion

- `test:postgresql-live-smoke-contract` is now a mandatory governance contract across three gates:
  - `lint`
  - `check:release-flow`
  - governance regression aggregation (`scripts/governance-regression-report.mjs`)
- `scripts/release-flow-contract.test.mjs` now fails when `check:release-flow` drops `test:postgresql-live-smoke-contract`.
- `scripts/governance-regression-report.test.mjs` now freezes the promoted check id and command in the governance baseline (`88` checks total).
- This loop closes the non-environmental governance lane for PostgreSQL live-smoke preflight hardening; it does not fabricate DSN-backed runtime smoke passage.
- Executable verification for this closure includes:
  - `pnpm.cmd run test:postgresql-live-smoke-contract`
  - `node scripts/release-flow-contract.test.mjs`
  - `node scripts/governance-regression-report.test.mjs`
- `pnpm.cmd run check:governance-regression`
- `pnpm.cmd run check:release-flow`
- Follow-on host closure from this point is now recorded in section `35`.

## 35. Current Loop Addendum - PostgreSQL Live Smoke Host Pass

- `pnpm.cmd run release:smoke:postgresql-live` now has a recorded DSN-backed `passed` report on this host via a temporary Docker-backed PostgreSQL 16 runtime on `127.0.0.1:55432`.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
- This closure moves Step 17 away from PostgreSQL environment availability as the active blocker on this host; follow-on loop truth moved to `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md` and later steps.
- Executable verification for this closure is captured in `docs/release/release-2026-04-13-04.md`, including:
  - `docker run -d --rm --name birdcoder-postgresql-live-smoke-20260413 -e POSTGRES_USER=birdcoder -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=birdcoder -p 55432:5432 postgres:16-alpine`
  - `docker exec birdcoder-postgresql-live-smoke-20260413 pg_isready -U birdcoder -d birdcoder`
  - `cmd /d /s /c "set BIRDCODER_POSTGRESQL_DSN=postgresql://birdcoder:secret@127.0.0.1:55432/birdcoder && pnpm.cmd run release:smoke:postgresql-live"` -> `passed`
  - `docker stop birdcoder-postgresql-live-smoke-20260413`
