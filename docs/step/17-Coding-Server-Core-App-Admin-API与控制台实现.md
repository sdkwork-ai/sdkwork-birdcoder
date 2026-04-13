# Step 17 - Coding-Server Core、App、Admin API与控制台实现

## 1. 目标与范围

把 `/docs/架构/20` 从协议标准推进到可执行事实源，先收敛 `coding-server` 的 TS 契约层，再逐步补齐 Rust handler、持久化、App Console、Admin Console。

## 2. 本轮已落地

- `packages/sdkwork-birdcoder-server/src/index.ts`
  - `getBirdCoderCodingServerDescriptor()`
  - `getBirdCoderCoreApiContract()`
  - `getBirdCoderAppApiContract()`
  - `getBirdCoderAdminApiContract()`
  - `listBirdCoderCodingServerRoutes()`
  - `buildBirdCoderCodingServerOpenApiDocumentSeed()`
  - `executeBirdCoderCoreSessionRun()`
  - `streamBirdCoderCoreSessionEventEnvelopes()`
  - `createInMemoryBirdCoderCoreSessionProjectionStore()`
  - `persistBirdCoderCoreSessionRunProjection()`
- `packages/sdkwork-birdcoder-server/src/projectionRepository.ts`
  - `buildBirdCoderCoreSessionProjectionBindings()`
  - `createProviderBackedBirdCoderCoreSessionProjectionStore()`
  - `createJsonBirdCoderCoreSessionProjectionStore()`
- `packages/sdkwork-birdcoder-server/src-host`
  - `build_app()`
  - `/api/core/v1/health`
  - `/api/core/v1/descriptor`
  - `/api/core/v1/runtime`
  - `/openapi/coding-server-v1.json`
  - representative `app / admin` placeholder routes with统一问题 envelope
- `packages/sdkwork-birdcoder-types/src/data.ts`
  - `coding_session_operation`
  - server projection storage bindings
- `packages/sdkwork-birdcoder-types/src/server-api.ts`
  - `BIRDCODER_CODING_SERVER_API_VERSION`
  - `BirdCoderApiTransport`
  - `BirdCoderAppAdminApiClient`
  - timestamped `project` summary DTOs
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts`
  - typed app/admin client
  - in-process transport
  - HTTP transport boundary
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedWorkspaceService.ts`
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedProjectService.ts`
- 统一 `core / app / admin` 路由矩阵与 OpenAPI seed。
- 统一把 canonical engine runtime 投影为 `runtime / event / artifact / operation`。
- 统一 SSE envelope：`requestId`、`timestamp`、`data`、`meta.version`。
- 增加最小 projection store，允许同一 `coding_session` 聚合多 turn 的 runtime、event、artifact、operation。
- 增加 provider-scoped table repository 版 projection store，允许基于共享 data-kernel binding 读回 runtime、event、artifact、operation 快照。
- 共享 data-kernel 已补齐 Node 直跑时的 in-memory fallback，使 provider 合同测试不依赖浏览器 `window.localStorage`。
- Rust host 已切到统一 `core` 前缀，并移除旧 `/health` 文本接口。
- Rust OpenAPI 已补齐 representative `core / app / admin` 路由矩阵，不再只暴露 3 个 core 路径。
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
- Rust host representative `core / app / admin` OpenAPI parity
- Rust host representative list reads now return unified empty list envelopes on `/api/core/v1/engines`, `/api/app/v1/workspaces`, and `/api/admin/v1/releases`
- Rust host now exposes projection-backed read handlers on `/api/core/v1/coding-sessions/:id`, `/api/core/v1/operations/:operationId`, `/api/core/v1/coding-sessions/:id/events`, `/api/core/v1/coding-sessions/:id/artifacts`, and `/api/core/v1/coding-sessions/:id/checkpoints`
- Rust host missing projection reads now return unified `not_found` problem envelopes instead of `not_implemented`
- Rust host now treats the shared desktop SQLite authority file as the primary runtime source through `BIRDCODER_CODING_SERVER_SQLITE_FILE`; when it encounters only legacy `coding-session` + `table.sqlite.*` `kv_store` rows, startup materializes the matching direct provider tables once before serving reads
- Rust host startup now resolves authority bootstrap from the default `bird-server.config.json` first and falls back to env vars second; `build_app_from_runtime_config()` removes the previous env-only startup dependency, and the shared TS path now closes provider/UoW semantics without ad hoc projection writes
- `BIRDCODER_CODING_SERVER_SNAPSHOT_FILE` is retained only as a transition fallback bridge when the shared SQLite authority file is not yet available
- `packages/sdkwork-birdcoder-types/src/data.ts` now exposes `coding_session_checkpoint` storage binding so checkpoint authority keying stays on the shared type standard
- Rust host now exposes representative real app/admin handlers on `/api/app/v1/projects`, `/api/app/v1/teams`, `/api/admin/v1/teams`, and `/api/admin/v1/releases`; these routes now return unified list envelopes backed by runtime state instead of placeholder or empty-shell payloads
- The shared type standard now also exposes `workspace` / `project` / `team` / `release_record` storage bindings so app/admin truth paths reuse the same authority-key naming model as core projection resources
- Desktop `src-tauri` SQLite bootstrap now creates the first real direct authority tables for `coding_sessions` / `coding_session_runtimes` / `coding_session_events` / `coding_session_artifacts` / `coding_session_checkpoints` / `coding_session_operations` / `projects` / `teams` / `release_records`, records `coding-server-kernel-v2`, and keeps `kv_store` as a bridge instead of the only authority shape
- Desktop `local_store_set` / `local_store_delete` now mirror shared `table.sqlite.*` table payloads into those real provider tables, and first-open backfill replays existing `kv_store` rows once so older local authority data becomes Rust-readable without manual migration
- Rust host now materializes legacy `kv_store` authority into the full direct SQLite provider-table set once and then reads only provider tables at runtime, eliminating `kv_store` as a normal host-side truth path
- Shared storage migration bundles now include `project` and `release_record` inside `coding-server-kernel-v2`, so the TS migration definition matches the representative app/admin direct authority subset actually used by Step 17

未闭环：

- 当前文档顶部不再保留新的非环境未闭环项；Representative route、共享 provider/UoW、OpenAPI export/codegen、shared facade、console adoption、approval、document、audit、deployment、policy 等闭环已在本页 `11` 到 `33` 节完成回写。
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
- `A3` App/Admin Console 接统一 SDK

并行约束：

- `A2` 必须消费 `A1` 已冻结 DTO 与路由。
- `A3` 必须消费 `A1/A2` 冻结后的 SDK，不允许反向定义 DTO。

## 6. 检查点

- `CP17-1` `core / app / admin` 路由前缀冻结
- `CP17-2` OpenAPI seed 与 route contract 对齐
- `CP17-3` canonical runtime 可投影为 core session 事件流
- `CP17-4` SSE envelope 可回放同一事件序列
- `CP17-5` Rust handler 接手前，TS 契约测试全部可执行

## 7. 验证命令

- `pnpm.cmd run test:coding-server-route-contract`
- `pnpm.cmd run test:coding-server-openapi-contract`
- `pnpm.cmd run test:app-admin-sdk-consumer-contract`
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
- `cargo test --offline --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml`
- `pnpm.cmd run check:server`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`

## 8. 结果判定

达成：

- `web / desktop / server` 已共享同一套 server contract 标准入口。
- 多 engine runtime 已能稳定投影到统一 core session 语义。
- 新增 Step 17 合同测试已纳入根脚本，可重复执行。
- server 侧已经具备最小聚合快照能力、provider-scoped table repository 契约，以及 shared data-kernel 持久化接线。
- Rust host 已有最小 core 路由骨架，可承接后续完整 handler 与 replay 接线。
- Rust host OpenAPI 已能覆盖 representative `core / app / admin` 路径与 operationId。

未达成：

- 当前无新的非环境未达成项；只有 fresh failing evidence 或未来 `release:smoke:postgresql-live` 重跑回归，才允许重新打开 Step 17。

## 9. 下一步最短路径

1. 不要在没有 fresh failing evidence 的情况下重开 Step 17 的 representative route、OpenAPI/codegen、shared facade、console adoption 或 PostgreSQL 治理闭环。
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
- `@sdkwork/birdcoder-types` now exports that generated module, so later app/admin/core SDK work can consume one release-backed operation catalog.
- `check:release-flow` now includes `scripts/generate-coding-server-openapi-types.test.mjs`.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the typed client/helper surface now consumes the exported generated operation catalog instead of the raw snapshot.

## 14. Current Loop Addendum - Finalized Typed Client Codegen Lane

- `scripts/generate-coding-server-client-types.ts` now closes the second-stage generated SDK/client lane on top of `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`.
- The generated output is fixed to `packages/sdkwork-birdcoder-types/src/generated/coding-server-client.ts`.
- `@sdkwork/birdcoder-types` now exports that generated client module, so shared consumers can resolve request metadata from one release-backed operation catalog instead of hand-writing route strings.
- `appAdminApiClient.ts` is now the first representative consumer of the generated request builder for default workspace/project/team/release reads.
- `scripts/generate-coding-server-client-types.test.ts` now includes a TypeScript regression contract that proves:
  - route-less operations do not require `pathParams`
  - route-param operations still require `pathParams`
- `check:release-flow` now includes `scripts/generate-coding-server-client-types.test.ts`.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; representative generated-client adoption now sits behind shared high-level facades plus the later typed response/write facades.

## 15. Current Loop Addendum - Shared Generated App/Admin Facade

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now owns `createBirdCoderGeneratedAppAdminApiClient({ transport })` on top of `createBirdCoderFinalizedCodingServerClient()`.
- The shared facade is now the approved representative entry for:
  - `/api/app/v1/workspaces`
  - `/api/app/v1/projects`
  - `/api/admin/v1/teams`
  - `/api/admin/v1/releases`
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts` now delegates to that shared facade and keeps only in-process/HTTP transport wiring locally.
- `scripts/generated-app-admin-client-facade-contract.test.ts` now verifies representative path/query/list-envelope behavior for the shared facade.
- `check:release-flow` now executes that contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the same shared-facade pattern now covers the remaining representative `core / app / admin` consumers without reopening host-local route assembly.

## 16. Current Loop Addendum - Default IDE Services Direct Shared-Facade Adoption

- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts` now builds transport-based representative app/admin clients directly through `createBirdCoderGeneratedAppAdminApiClient({ transport })`.
- Runtime HTTP composition and in-process fallback composition are both now aligned with the shared types-layer facade.
- `scripts/default-ide-services-generated-app-admin-facade-contract.test.ts` now verifies this default-composition rule.
- `check:release-flow` now executes that contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the direct shared-facade adoption rule already covers the remaining representative `core / app / admin` transport consumers.

## 17. Current Loop Addendum - App/Admin Wrapper Removal

- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts` now owns transport factories only and no longer exports `createBirdCoderAppAdminApiClient()`.
- `scripts/app-admin-sdk-consumer-contract.test.ts` now consumes `createBirdCoderGeneratedAppAdminApiClient({ transport })` directly.
- `scripts/no-app-admin-client-wrapper-contract.test.ts` now prevents the deleted wrapper from reappearing.
- `check:release-flow` now executes that contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the same transport-only versus shared-facade cutover now covers the later representative consumers.

## 18. Current Loop Addendum - Shared Core Read Facade

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now owns `createBirdCoderGeneratedCoreReadApiClient({ transport })`.
- The current shared core facade closes only the implemented representative routes:
  - `/api/core/v1/descriptor`
  - `/api/core/v1/runtime`
  - `/api/core/v1/health`
  - `/api/core/v1/engines`
  - `/api/core/v1/operations/:operationId`
- `scripts/generated-core-read-client-facade-contract.test.ts` now verifies those five routes on one shared generated-client-based facade.
- `check:release-flow` now executes that contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the implemented core projection reads already sit behind the same shared facade pattern.

## 19. Current Loop Addendum - Shared Core Projection Read Facade

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now extends `createBirdCoderGeneratedCoreReadApiClient({ transport })` to the already implemented projection reads for:
  - `/api/core/v1/coding-sessions/:id`
  - `/api/core/v1/coding-sessions/:id/events`
  - `/api/core/v1/coding-sessions/:id/artifacts`
  - `/api/core/v1/coding-sessions/:id/checkpoints`
- Shared projection-read mapping now lands directly on:
  - `BirdCoderCodingSessionSummary`
  - `BirdCoderCodingSessionEvent[]`
  - `BirdCoderCodingSessionArtifact[]`
  - `BirdCoderCodingSessionCheckpoint[]`
- `scripts/generated-core-projection-read-client-facade-contract.test.ts` now verifies the four method/path bindings on one shared generated-client-based facade.
- `check:release-flow` now executes that contract beside the earlier representative core-read facade contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; shared-facade adoption already covers the remaining representative `core / app / admin` transport consumers.

## 20. Current Loop Addendum - App Team Surface Split

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now splits team reads on the shared app/admin facade:
  - `listTeams()` -> `/api/app/v1/teams`
  - `listAdminTeams()` -> `/api/admin/v1/teams`
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts` now serves both routes in the in-process transport, so runtime team reads no longer piggyback on the admin-only surface.
- `ApiBackedTeamService` and the default host-derived runtime transport path now consume the app-surface team catalog by default.
- `scripts/generated-app-admin-client-facade-contract.test.ts`, `scripts/app-admin-sdk-consumer-contract.test.ts`, and `scripts/server-runtime-transport-contract.test.ts` now verify:
  - shared facade route split
  - default IDE team reads on the app surface
  - server runtime transport parity on the app surface
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the remaining real transport consumers already follow the shared-facade adoption rule.

## 21. Current Loop Addendum - Default IDE Release Service Adoption

- `BirdCoderAppAdminApiClient.listReleases()` remains the explicit admin release catalog reader on `GET /api/admin/v1/releases`.
- `packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/IReleaseService.ts` and `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedReleaseService.ts` now close the first representative governed release-read service boundary on top of the shared app/admin facade.
- `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, and `useReleases()` now expose one default IDE/app consumer path for governed release catalogs without rebuilding admin HTTP or DTOs locally.
- `scripts/default-ide-services-release-service-contract.test.ts` now locks this closure into `check:release-flow`.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the implemented core projection read facade is already adopted by app-level coding-session detail consumers.

## 22. Current Loop Addendum - Default IDE Core Read Adoption

- `packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/ICoreReadService.ts` and `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCoreReadService.ts` now close the first default service boundary on top of `BirdCoderCoreReadApiClient`.
- Runtime-bound default IDE services now compose `createBirdCoderGeneratedCoreReadApiClient({ transport: createBirdCoderHttpApiTransport(...) })` directly instead of rebuilding core request paths locally.
- `createDefaultBirdCoderIdeServices()`, `IDEContext`, and `ServiceContext` now expose `coreReadService`; `useCodingServerOverview()` is the first app-level consumer of descriptor/runtime/health/engine overview reads.
- When no runtime-bound `apiBaseUrl` or injected `coreReadClient` exists, core reads stay explicitly unavailable; this loop does not claim a local in-process core transport closure.
- `scripts/default-ide-services-generated-core-read-facade-contract.test.ts` and `scripts/default-ide-services-core-read-service-contract.test.ts` now lock this adoption into `check:release-flow`.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the implemented core projection read facade is already adopted by app-level coding-session detail consumers.

## 23. Current Loop Addendum - App-Level Coding Session Projection Consumer Adoption

- `packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts` now exposes:
  - `loadCodingSessionProjection(coreReadService, codingSessionId)`
  - `useCodingSessionProjection(codingSessionId)`
- The new app-level consumer slice reads:
  - `getCodingSession()`
  - `listCodingSessionEvents()`
  - `listCodingSessionArtifacts()`
  - `listCodingSessionCheckpoints()`
- `packages/sdkwork-birdcoder-commons/src/context/ideServices.ts` now keeps shared service access available from a non-JSX module so direct Node contracts can validate the same consumer boundary without inventing alternate runtime wiring.
- `scripts/coding-session-projection-app-consumer-contract.test.ts` now locks this closure into `check:release-flow`.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the typed core write facade and first consumer path were closed after this checkpoint.

## 24. Current Loop Addendum - Shared Core Facade Exclusion Governance

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes explicit governance metadata for the shared high-level core facade:
  - `BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS`
  - `BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS`
  - `isBirdCoderSharedCoreFacadeOperationId()`
  - `isBirdCoderSharedCoreFacadeExcludedOperationId()`
- The promoted catalog now covers only the already-real high-level operations:
  - `core.getDescriptor`
  - `core.getRuntime`
  - `core.getHealth`
  - `core.listEngines`
  - `core.getOperation`
  - `core.getCodingSession`
  - `core.listCodingSessionEvents`
  - `core.listCodingSessionArtifacts`
  - `core.listCodingSessionCheckpoints`
- The excluded catalog now makes the current blocked routes explicit:
  - `core.getEngineCapabilities`
  - `core.listModels`
  - `core.createCodingSession`
  - `core.createCodingSessionTurn`
  - `core.submitApprovalDecision`
- `scripts/shared-core-facade-governance-contract.test.ts` now proves the excluded operations still exist in the low-level generated client while staying outside the shared high-level facade, and `check:release-flow` executes that contract.
- Follow-on closure from this point is now superseded by later Step 17 writebacks; `core.createCodingSession` is already promoted through the typed shared write facade.

## 25. Current Loop Addendum - Typed Core Create Session Facade And Consumer Adoption

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes `createBirdCoderGeneratedCoreWriteApiClient({ transport })` for the promoted `core.createCodingSession` operation.
- Shared core governance is now split as:
  - promoted: `core.createCodingSession` plus the existing implemented core read operations
  - excluded: `core.getEngineCapabilities`, `core.listModels`, `core.createCodingSessionTurn`, `core.submitApprovalDecision`
- `createDefaultBirdCoderIdeServices()` now resolves `coreWriteClient` in this order:
  - explicit `coreWriteClient`
  - runtime-configured `coreWriteClient`
  - runtime HTTP transport composed through `createBirdCoderGeneratedCoreWriteApiClient({ transport: createBirdCoderHttpApiTransport(...) })`
  - no remote core write client, which falls back to the existing local project sidecar write path
- `ApiBackedProjectService.createCodingSession()` now closes the first real consumer path on top of the shared typed core write facade:
  - resolve `workspaceId` from project truth
  - call the remote server-authoritative `core.createCodingSession`
  - mirror the returned session into local project session state
  - preserve the server-generated session id across refreshed project catalogs
- `ProviderBackedProjectService` now implements a local `upsertCodingSession()` mirror path so remote creates do not disappear after `useProjects().fetchProjects()`.
- Executable governance for this closure now includes:
  - `scripts/generated-core-write-client-facade-contract.test.ts`
  - `scripts/default-ide-services-generated-core-write-facade-contract.test.ts`
  - `scripts/api-backed-project-service-core-create-coding-session-contract.test.ts`
- Follow-on closure from this point is now superseded by later Step 17 writebacks; `core.createCodingSessionTurn` no longer remains excluded after the later facade and consumer closure.

## 26. Current Loop Addendum - Real Core Create Session Turn Route

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` now makes `POST /api/core/v1/coding-sessions/:id/turns` a real authority write route instead of `not_implemented`.
- Rust host turn creation now:
  - validates `requestKind` plus `inputSummary`
  - returns `201 Created` with a real turn payload
  - appends one readable `turn.started` event plus one readable operation record
  - persists `coding_session_turns`, `coding_session_events`, and `coding_session_operations` in sqlite-provider mode
  - refreshes `coding_sessions.updated_at` / `last_turn_at` plus runtime state before reloading provider-backed projections
- Executable verification for this closure now includes:
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml create_coding_session_turn_route_returns_created_turn_and_makes_projection_readable`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml create_coding_session_turn_route_returns_not_found_for_missing_session`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml create_coding_session_turn_route_persists_into_sqlite_provider_authority`
- Follow-on closure from this point is now superseded by later Step 17 writebacks; the typed shared core write facade for `core.createCodingSessionTurn` and its first real consumer path are already closed.

## 27. Current Loop Addendum - Typed Core Create Session Turn Facade And Consumer Adoption

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes `createBirdCoderGeneratedCoreWriteApiClient({ transport }).createCodingSessionTurn(...)`.
- Shared core governance is now split as:
  - promoted: `core.createCodingSessionTurn`, `core.createCodingSession`, and the existing implemented core read operations
  - excluded: `core.getEngineCapabilities`, `core.listModels`, `core.submitApprovalDecision`
- `ApiBackedProjectService.addCodingSessionMessage()` now closes the first real consumer path on top of the shared typed turn-write facade:
  - supported local message roles map to canonical turn request kinds
  - remote turn creation writes the server-authoritative `turnId` back into local message state
  - missing-session `404` falls back to the local sidecar path so older local-only sessions remain usable
- `ProviderBackedProjectService.addCodingSessionMessage()` now preserves mirrored `turnId` and `metadata`, so refreshed project catalogs keep the server-created turn link instead of dropping it.
- Executable governance for this closure now includes:
  - `scripts/generated-core-write-client-facade-contract.test.ts`
  - `scripts/shared-core-facade-governance-contract.test.ts`
  - `scripts/api-backed-project-service-core-create-coding-session-turn-contract.test.ts`
- Follow-on closure from this point is now superseded by later Step 17 and architecture writebacks; `core.getEngineCapabilities` plus `core.listModels` are already real and promoted in the shared core read facade.

## 28. Current Loop Addendum - Real Core Approval Decision Lane

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes `createBirdCoderGeneratedCoreWriteApiClient({ transport }).submitApprovalDecision(approvalId, request)`.
- Shared core governance is now fully promoted for currently real core routes:
  - promoted: `core.submitApprovalDecision`, `core.createCodingSessionTurn`, `core.createCodingSession`, and the existing implemented core read operations
  - excluded: none
- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` now makes `POST /api/core/v1/approvals/:approvalId/decision` a real authority write route instead of `not_implemented`.
- Approval authority truth is now replayable in both execution modes:
  - demo/snapshot-backed host mutates shared projection authority
  - sqlite provider-backed host persists checkpoint/event/operation/turn state, then reloads projection truth from provider tables
- `ICoreWriteService`, `ApiBackedCoreWriteService`, default IDE service composition, and shared contexts now expose approval submission through one typed write boundary.
- `loadCodingSessionApprovalState()`, `submitCodingSessionApprovalDecision()`, and `useCodingSessionApprovalState()` now close the first real approval-facing consumer path on top of that facade.
- Canonical approval-resolution replay now uses `operation.updated.payload.approvalDecision`; do not emit a duplicate `decision` event field.
- Executable verification for this closure now includes:
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml submit_approval_decision_route`
  - `pnpm.cmd run test:generated-core-write-client-facade-contract`
  - `pnpm.cmd run test:shared-core-facade-governance-contract`
  - `pnpm.cmd run test:coding-session-approval-consumer-contract`
  - `pnpm.cmd run test:api-backed-project-service-core-create-coding-session-contract`
  - `pnpm.cmd run test:api-backed-project-service-core-create-coding-session-turn-contract`
  - `pnpm.cmd run typecheck`
- Follow-on closure from this point is now recorded in sections `29` through `35`; the remaining representative app/admin routes and PostgreSQL host-pass lane no longer stay open.

## 29. Current Loop Addendum - Real App Document Catalog Lane

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` now makes `GET /api/app/v1/documents` a real authority read route instead of `not_implemented`.
- Representative document catalog truth is now replayable in all current authority modes:
  - demo host reads `AppState.documents`
  - legacy sqlite `kv_store` materializes `table.sqlite.project-documents.v1` into provider-side `project_documents`
  - direct sqlite provider reads `project_documents`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes `createBirdCoderGeneratedAppAdminApiClient({ transport }).listDocuments()`.
- `appConsoleRepository.ts`, `appAdminConsoleQueries.ts`, and `appAdminApiClient.ts` now promote `project_documents` into the shared repository/query/transport boundary instead of leaving documents on mock-only state.
- `IDocumentService`, `ApiBackedDocumentService`, default IDE service composition, shared contexts, `loadDocuments()`, and `useDocuments()` now close the first document-facing consumer path on top of the shared app/admin facade.
- Executable verification for this closure now includes:
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured`
  - `pnpm.cmd run test:generated-app-admin-client-facade-contract`
  - `pnpm.cmd run test:provider-backed-console-contract`
  - `pnpm.cmd run test:app-admin-sdk-consumer-contract`
  - `pnpm.cmd run test:default-ide-services-document-service-contract`
  - `pnpm.cmd run test:document-app-consumer-contract`
- `pnpm.cmd run typecheck`
- Follow-on closure from this checkpoint is now recorded in sections `30` through `35`.

## 30. Current Loop Addendum - Real Admin Audit Lane

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` now makes `GET /api/admin/v1/audit` a real authority read route instead of `not_implemented`.
- Representative audit catalog truth is now replayable in all current authority modes:
  - demo host reads in-process audit state
  - legacy sqlite `kv_store` materializes `table.sqlite.audit-events.v1` into provider-side `audit_events`
  - direct sqlite provider reads `audit_events`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes `createBirdCoderGeneratedAppAdminApiClient({ transport }).listAuditEvents()`.
- `appConsoleRepository.ts`, `appAdminConsoleQueries.ts`, and `appAdminApiClient.ts` now promote `audit_events` into the shared repository/query/transport boundary instead of leaving audit reads on mock-only state.
- `IAuditService`, `ApiBackedAuditService`, default IDE service composition, shared contexts, `loadAuditEvents()`, and `useAuditEvents()` now close the first audit-facing consumer path on top of the shared app/admin facade.
- Executable verification for this closure now includes:
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured`
  - `pnpm.cmd run test:generated-app-admin-client-facade-contract`
  - `pnpm.cmd run test:default-ide-services-audit-service-contract`
  - `pnpm.cmd run test:audit-admin-consumer-contract`
  - `pnpm.cmd run test:sqlite-app-admin-repository-contract`
- `pnpm.cmd run test:provider-backed-console-contract`
- `pnpm.cmd run test:app-admin-sdk-consumer-contract`
- `pnpm.cmd run typecheck`
- Follow-on closure from this checkpoint is now recorded in sections `31` through `35`.

## 31. Current Loop Addendum - Real App Deployment Catalog Lane

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` now makes `GET /api/app/v1/deployments` a real authority read route instead of `not_implemented`.
- Representative deployment catalog truth is now replayable in all current authority modes:
  - demo host reads in-process deployment state
  - legacy sqlite `kv_store` materializes deployment payloads into provider-side `deployment_records`
  - direct sqlite provider reads `deployment_records`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes `createBirdCoderGeneratedAppAdminApiClient({ transport }).listDeployments()`.
- `appConsoleRepository.ts`, `appAdminConsoleQueries.ts`, and transport-backed app/admin client wiring now promote `deployment_records` through the shared repository/query/transport boundary instead of leaving deployment reads on mock-only state.
- `IDeploymentService`, `ApiBackedDeploymentService`, default IDE service composition, shared contexts, `loadDeployments()`, and `useDeployments()` now close the first deployment-facing consumer path on top of the shared app/admin facade.
- Executable verification for this closure now includes:
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`
  - `pnpm.cmd run test:generated-app-admin-client-facade-contract`
  - `pnpm.cmd run test:provider-backed-console-contract`
  - `pnpm.cmd run test:sqlite-app-admin-repository-contract`
  - `pnpm.cmd run test:app-admin-sdk-consumer-contract`
  - `pnpm.cmd run test:default-ide-services-deployment-service-contract`
  - `pnpm.cmd run test:deployment-app-consumer-contract`
  - `pnpm.cmd run typecheck`
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`
- Remaining representative placeholder routes at this checkpoint were:
  - `GET /api/admin/v1/policies`
  - `GET /api/admin/v1/deployments`
- Follow-on closure from this checkpoint is now recorded in sections `32` through `35`.

## 32. Current Loop Addendum - Real Admin Deployment Governance Lane

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` now makes `GET /api/admin/v1/deployments` a real authority read route instead of `not_implemented`.
- Representative admin deployment truth is now replayable in all current authority modes:
  - demo host reads in-process deployment state
  - legacy sqlite `kv_store` materializes deployment payloads into provider-side `deployment_records`
  - direct sqlite provider reads `deployment_records`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes `createBirdCoderGeneratedAppAdminApiClient({ transport }).listAdminDeployments()`.
- In-process transport plus the shared deployment query/repository layer now serve both app/admin deployment surfaces from one authority path without DTO drift.
- `IAdminDeploymentService`, `ApiBackedAdminDeploymentService`, default IDE service composition, shared contexts, `loadAdminDeployments()`, and `useAdminDeployments()` now close the first admin deployment-facing consumer path on top of the shared app/admin facade.
- Executable verification for this closure now includes:
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`
  - `pnpm.cmd run test:generated-app-admin-client-facade-contract`
  - `pnpm.cmd run test:app-admin-sdk-consumer-contract`
  - `pnpm.cmd run test:default-ide-services-admin-deployment-service-contract`
  - `pnpm.cmd run test:admin-deployment-consumer-contract`
  - `pnpm.cmd run typecheck`
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`
- Remaining representative placeholder routes at this checkpoint were:
  - `GET /api/admin/v1/policies`
- Follow-on closure from this checkpoint is now recorded in sections `33` through `35`.

## 33. Current Loop Addendum - Real Admin Policy Governance Lane

- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` now makes `GET /api/admin/v1/policies` a real authority read route instead of `not_implemented`.
- Representative admin policy truth now converges on one dedicated governance authority path:
  - demo host: in-process policy state
  - legacy sqlite `kv_store`: `table.sqlite.governance-policies.v1` materialized into `governance_policies`
  - direct sqlite provider: `governance_policies`
- `packages/sdkwork-birdcoder-types/src/data.ts` and `server-api.ts` now freeze the dedicated authority model plus the shared facade entry `listPolicies()`.
- `appConsoleRepository.ts`, `appAdminConsoleQueries.ts`, and transport-backed app/admin client wiring now promote `governance_policies` through the shared repository/query/transport boundary.
- `IAdminPolicyService`, `ApiBackedAdminPolicyService`, default IDE service composition, shared contexts, `loadAdminPolicies()`, and `useAdminPolicies()` now close the first reusable admin policy consumer path on top of the shared app/admin facade.
- Executable verification for this closure now includes:
  - `pnpm.cmd run test:generated-app-admin-client-facade-contract`
  - `pnpm.cmd run test:app-admin-sdk-consumer-contract`
  - `pnpm.cmd run test:default-ide-services-admin-policy-service-contract`
  - `pnpm.cmd run test:admin-policy-consumer-contract`
  - `pnpm.cmd run test:sqlite-app-admin-repository-contract`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured -- --nocapture`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml`
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
