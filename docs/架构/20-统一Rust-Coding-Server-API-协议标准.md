# 20-统一Rust-Coding-Server-API-协议标准

## 1. 目标

BirdCoder 必须把 `web / desktop / server` 的运行时能力统一收口到一个 `coding-server` 标准面。所有宿主只访问同一套路径、DTO、错误模型、事件流、审批语义、操作状态语义，不允许宿主各自维护私有 API。

## 2. 事实源分层

- `packages/sdkwork-birdcoder-types`
  - engine、model、capability、session、event、artifact、server-api DTO 主源
- `packages/sdkwork-birdcoder-server`
  - `coding-server` 的 TS 契约实现、OpenAPI seed、session run projection、SSE envelope
- `packages/sdkwork-birdcoder-server/src-host`
  - Rust host 进程、最小 core 路由骨架与未来真实 handler 承载层

规则：

- 标准主源是 `types`。
- `server` 只能消费 `types`，不能反向重新定义 DTO。
- Rust handler、Web/Desktop SDK、控制台页面都必须消费同一份 DTO。

## 3. 统一 API 面

```text
/api/core/v1/*
/api/app/v1/*
/api/admin/v1/*
```

- `core`：Kernel、Engine、Coding Session、Turn、Event、Artifact、Checkpoint、Approval、Operation
- `app`：Workspace、Project、Document、Template、Prompt、Skill、Build/Test/Preview/Deployment
- `admin`：Team、Member、Policy、Audit、Release、Deployment Governance

禁止：

- `desktop-api`、`web-api`、`server-api` 之类宿主私有前缀
- 页面直接消费 engine 原生 JSONL、JSON-RPC、remote-control payload

## 4. 当前已执行标准

已在 `packages/sdkwork-birdcoder-server/src/index.ts` 落地：

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

已在 `packages/sdkwork-birdcoder-server/src/projectionRepository.ts` 落地：

- `buildBirdCoderCoreSessionProjectionBindings()`
- `createProviderBackedBirdCoderCoreSessionProjectionStore()`
- `createJsonBirdCoderCoreSessionProjectionStore()`
- 基于共享 data-kernel table repository 的 provider-scoped projection persistence
- Shared `data-kernel` now also exposes `createBirdCoderStorageProvider()` so provider-backed persistence has one reusable `open / healthCheck / runMigrations / beginUnitOfWork` contract.
- Provider-backed projection persistence now runs `runtime / event / artifact / operation` writes through one shared UoW boundary instead of direct ad hoc projection writes.

已在 `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` 落地：

- `build_app()`
- `/api/core/v1/health`
- `/api/core/v1/descriptor`
- `/api/core/v1/runtime`
- `/openapi/coding-server-v1.json`
- representative `core / app / admin` OpenAPI path matrix
- representative list handlers for `core / app / admin` now return unified `BirdCoderApiListEnvelope` parity on `/api/core/v1/engines`, `/api/app/v1/workspaces`, and `/api/admin/v1/releases`
- projection-backed read handlers now serve `/api/core/v1/coding-sessions/:id`, `/api/core/v1/operations/:operationId`, `/api/core/v1/coding-sessions/:id/events`, `/api/core/v1/coding-sessions/:id/artifacts`, and `/api/core/v1/coding-sessions/:id/checkpoints`
- missing projection reads now return the same unified `not_found` problem envelope shape as later real repository-backed handlers
- Rust host now treats the shared desktop SQLite authority file behind `BIRDCODER_CODING_SERVER_SQLITE_FILE` as the primary runtime authority; when only legacy `coding-session` + `table.sqlite.*` `kv_store` rows exist, startup materializes the matching direct provider tables once before serving reads
- Rust host startup now resolves authority bootstrap from the default `bird-server.config.json` first, falls back to env vars second, and uses `build_app_from_runtime_config()` as the executable entrypoint so startup is no longer env-only
- `BIRDCODER_CODING_SERVER_SNAPSHOT_FILE` remains a transition fallback bridge for external JSON projection snapshots when the shared SQLite authority file is not yet available
- representative real app/admin handlers now serve `/api/app/v1/projects`, `/api/app/v1/teams`, `/api/admin/v1/teams`, and `/api/admin/v1/releases` from the same runtime authority state, returning list envelopes instead of placeholder or empty-shell payloads
- Desktop `src-tauri` now materializes the first real direct authority tables for coding-session and representative app/admin resources inside the shared SQLite file, instead of leaving `kv_store` as the only persisted authority shape
- Desktop `local_store_set` / `local_store_delete` now mirror shared `table.sqlite.*` records into real provider rows, and first-open backfill replays existing `kv_store` payloads once so old local authority data stays readable by Rust without manual intervention
- Rust host now requires the full direct provider-table set for runtime reads, materializes that set once from legacy `kv_store` rows when necessary, and no longer keeps `kv_store` as a regular host-side truth path
- 旧 `/health` 文本接口已下线

已在 `packages/sdkwork-birdcoder-types/src/data.ts` 落地：

- `coding_session_operation` 实体
- `coding_session_runtime/event/artifact/checkpoint/operation` storage binding
- `workspace/project/team/release_record` storage binding for representative app/admin authority paths
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now freezes shared `BIRDCODER_CODING_SERVER_API_VERSION`, `BirdCoderApiTransport`, `BirdCoderAppAdminApiClient`, and timestamped `project` summary DTOs so app/admin consumers no longer need app-local DTO shims
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now also exposes `createBirdCoderGeneratedAppAdminApiClient()` as the shared high-level representative app/admin facade on top of the release-backed generated client

已在 `packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts` 对齐：

- `coding-server-kernel-v2` now includes `project` and `release_record`
- representative app/admin direct authority tables and TS migration bundles no longer diverge on those two entities
- `packages/sdkwork-birdcoder-infrastructure/src/storage/sqlBackendExecutors.ts` now closes the first real backend executor slice: `node:sqlite` file execution for `sqlite`, forked transaction visibility, and a backend-ready `postgresql` client executor boundary with `BEGIN / COMMIT / ROLLBACK` semantics.
- `packages/sdkwork-birdcoder-server/src/appAdminRepository.ts` now closes the representative `project / team / release_record` repository set on the same provider/UoW plus row/plan contract already used by `coding-server` projection persistence.
- Shared entity definitions now mark nullable runtime and representative app/admin columns explicitly so fresh SQLite schema, Rust authority tables, and TS repositories no longer rely on JSON-fallback-only null assumptions.
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts` now closes the first typed app/admin SDK surface with one shared client plus in-process and HTTP transport adapters.
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts` now delegates high-level representative app/admin request assembly to `createBirdCoderGeneratedAppAdminApiClient()` and keeps infrastructure scoped to transport concerns only.
- `createDefaultBirdCoderIdeServices()` now composes `ApiBackedWorkspaceService` and `ApiBackedProjectService`; default workspace/project catalog reads flow through the shared app/admin client, while local writes and coding-session in-memory state remain on the existing provider-backed sidecars.

这意味着当前仓库已经具备可执行的 TS 合同层，而不是只有文档标准。

## 5. Core 资源标准

最小必备：

- `GET /api/core/v1/descriptor`
- `GET /api/core/v1/runtime`
- `GET /api/core/v1/health`
- `GET /api/core/v1/engines`
- `GET /api/core/v1/engines/:engineKey/capabilities`
- `GET /api/core/v1/models`
- `POST /api/core/v1/coding-sessions`
- `GET /api/core/v1/coding-sessions/:id`
- `POST /api/core/v1/coding-sessions/:id/turns`
- `GET /api/core/v1/coding-sessions/:id/events`
- `GET /api/core/v1/coding-sessions/:id/artifacts`
- `GET /api/core/v1/coding-sessions/:id/checkpoints`
- `POST /api/core/v1/approvals/:approvalId/decision`
- `GET /api/core/v1/operations/:operationId`

## 6. 返回模型标准

- 单体返回统一 envelope：
  - `requestId`
  - `timestamp`
  - `data`
  - `meta.version`
- 列表返回统一 list envelope：
  - `requestId`
  - `timestamp`
  - `items`
  - `meta.page`
  - `meta.pageSize`
  - `meta.total`
  - `meta.version`
- 缺失资源统一 problem envelope：
  - HTTP `404`
  - `data.code = not_found`
  - `data.message`
  - `meta.version`
  - 启动期外部 authority 源：
  - primary config: `bird-server.config.json -> authority.sqliteFile`
  - primary env fallback: `BIRDCODER_CODING_SERVER_SQLITE_FILE`
  - primary source: shared desktop SQLite authority file
  - primary read preference: direct provider tables only
  - primary migration source: shared legacy `kv_store` rows keyed as `scope + table.sqlite.*`, consumed once during startup materialization and never used as steady-state runtime truth
  - fallback env: `BIRDCODER_CODING_SERVER_SNAPSHOT_FILE`
  - fallback source: JSON projection snapshot
  - final fallback: 未配置外部源时使用内置 demo snapshot
  - guard: 任一已配置外部源读取/解析失败时直接终止启动
- 长任务统一 operation：
  - `operationId`
  - `status`
  - `artifactRefs`
  - `streamUrl`
  - `streamKind`

## 7. 事件流标准

Server 对外只暴露 HTTP JSON + SSE。

统一标准事件：

- `session.started`
- `turn.started`
- `message.delta`
- `message.completed`
- `tool.call.requested`
- `artifact.upserted`
- `approval.required`
- `operation.updated`
- `turn.completed`
- `turn.failed`

统一规则：

- engine 原生协议先进入 adapter，再投影为标准事件
- UI 只消费标准事件，不消费 engine 原生流
- `artifact`、`approval`、`operation` 必须从同一事件序列可追溯回放
- event id 必须至少包含 `runtimeId + turnId + sequence`，不能只靠 `runtimeId + sequence`
- server projection repository 必须优先消费共享 data-kernel binding，不能再定义 server 私有持久化键模型
- Node 直跑合同允许共享 in-memory fallback，但它只服务合同/脚本执行，不计入 authority 存储

## 8. 多 Engine 适配标准

输入：

- Codex
- Claude Code
- Gemini
- OpenCode

适配边界：

- engine 原生 CLI/SDK/HTTP 协议留在 adapter 层
- workbench canonical runtime 负责把各 engine 统一成 BirdCoder runtime 描述与 canonical event
- `coding-server` 负责把 canonical event 再投影为 `coding_session_event / artifact / operation`

当前已闭环：

- Step 18 workbench canonical runtime
- Step 17 server projection + SSE envelope

## 9. 合同执行标准

凡被 `node --experimental-strip-types` 直接执行的合同链路，不能依赖仅在 TS path alias 中存在的导入解析。当前执行链已经统一为跨包源码相对导入，保证：

- route contract 可直接执行
- OpenAPI contract 可直接执行
- SSE contract 可直接执行
- engine runtime adapter contract 不被 alias 阻断

这条规则只约束“合同执行链”，不要求整个前端运行时全部放弃 workspace 包名。

## 10. 当前验证基线

- `pnpm.cmd run test:coding-server-route-contract`
- `pnpm.cmd run test:coding-server-openapi-contract`
- `pnpm.cmd run test:coding-server-sse-contract`
- `pnpm.cmd run test:coding-server-projection-store-contract`
- `pnpm.cmd run test:coding-server-projection-repository-contract`
- `pnpm.cmd run test:coding-server-provider-projection-repository-contract`
- `pnpm.cmd run test:engine-runtime-adapter`
- `pnpm.cmd run check:server`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run docs:build`

## 11. 当前闭环状态

当前 Step 17 相关串行缺口已经完成回写：

1. Rust `coding-server` representative route parity 已在本页 `20` 到 `37` 节闭环。
2. 共享 `sqlite/postgresql` provider/UoW、migration、executor-backed projection persistence、console adoption 与统一 SDK/OpenAPI consumer contract 已在仓内事实中闭环，不再是待实现项。
3. Canonical OpenAPI export、finalized release evidence、generated OpenAPI types、generated client types、shared `app / admin / core` facades 已在本页 `13` 到 `32` 节闭环。
4. Representative placeholder routes 当前真相为 `none`。
5. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
6. Step 17 关闭后的下一条非环境串行切片已移交到 `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md`，后续主循环真相已经继续推进到更晚的 Step。

## 12. 评估标准

- 宿主是否只访问统一 API 面
- 新 engine 接入是否只需补 adapter，而不是改页面协议
- event、artifact、approval、operation 是否可统一回放
- Rust、TS、SDK、Console 是否共用一份 DTO
- 新增能力时是否遵循 `types -> server -> handler -> sdk -> console` 单向链路


## Current Loop Closure - Host Runtime, Team Surface, And Server Binding Wiring

- `bootstrapShellRuntime()` is now the single shell-side runtime entry allowed to configure default IDE read transport.
- `BootstrapShellRuntimeOptions.host.apiBaseUrl` is the preferred source for shared app/admin client bootstrap on web / desktop; explicit `apiBaseUrl` or `appAdminClient` override it only when a host needs a non-default transport.
- `createDefaultBirdCoderIdeServices()` now resolves reads in this order:
  1. explicit `appAdminClient`
  2. runtime-configured `appAdminClient`
  3. runtime-configured HTTP transport from `apiBaseUrl`
  4. in-process console-query fallback
- `IDEContext` and `ServiceContext` must never allocate default services at module load. Default service construction is lazy and may only happen inside provider or hook fallback boundaries.
- HTTP transport URL join now preserves any path prefix already present in `apiBaseUrl`. Example:
  - base: `https://cn.sdkwork.local/birdcoder/api`
  - route: `/api/app/v1/workspaces`
  - final: `https://cn.sdkwork.local/birdcoder/api/api/app/v1/workspaces`
- `bindDefaultBirdCoderIdeServicesRuntime()` now owns the shared host-to-transport binding rule, so shell bootstrap and server runtime binding consume one source of truth for `host -> apiBaseUrl -> default app/admin client` adoption.
- `BirdCoderAppAdminApiClient.listTeams()` now standardizes workspace team catalog reads on `/api/app/v1/teams`, while `BirdCoderAppAdminApiClient.listAdminTeams()` remains the explicit admin-surface reader on `/api/admin/v1/teams`.
- `BirdCoderTeam`, `ITeamService`, and `ApiBackedTeamService` now close the first representative team service boundary; `createDefaultBirdCoderIdeServices()`, `IDEContext`, and `ServiceContext` expose that boundary without reintroducing eager default-service allocation.
- `bindBirdCoderServerRuntimeTransport()` now closes the server-side transport binding slice by resolving `resolveServerRuntime()` and configuring the same default-service transport contract without introducing a fake shell-style server entrypoint.
- web, desktop, and server runtime descriptors remain one distribution-derived standard. web now has the same explicit runtime resolver contract as desktop and server.
- Node-executed contract scripts must use Node-compatible package exports and explicit `.ts` re-export paths where required by ESM resolution.
- `scripts/postgresql-live-smoke.ts` now closes the PostgreSQL preflight runner on the shared provider/UoW stack:
  - DSN source priority: `BIRDCODER_POSTGRESQL_DSN -> BIRDCODER_DATABASE_URL -> DATABASE_URL -> PGURL`
  - result model: `blocked | passed | failed`
  - blocked reasons: `missing_postgresql_dsn | missing_postgresql_driver`
  - blocked recovery fields: `dsnCmdSetExample`, `dsnExample`, `dsnEnvPriority`, `dsnEnvStatus`, `dsnPowerShellSetExample`, `rerunCommand`, `resolutionSteps`, and `resolutionHint` are part of the executable report contract
  - representative smoke path: migration execution, transaction-local write visibility, transaction isolation, rollback cleanup on `release_record`
- `scripts/run-postgresql-live-smoke.ts` now exposes the executable status contract:
  - `0` = passed
  - `2` = blocked
  - `1` = failed
- PostgreSQL live-smoke preflight contract governance is now promotion-closed:
  - `pnpm.cmd run test:postgresql-live-smoke-contract` is part of `lint`
  - `pnpm.cmd run test:postgresql-live-smoke-contract` is part of `check:release-flow`
  - governance regression aggregation now includes `postgresql-live-smoke-contract`
  - release-flow and governance-regression contract tests fail if that promotion drifts
- Current executable closure:
  - `pnpm.cmd run test:app-admin-sdk-consumer-contract`
  - `pnpm.cmd run test:shell-runtime-app-client-contract`
  - `pnpm.cmd run test:server-runtime-transport-contract`
  - `node scripts/host-runtime-contract.test.ts`
  - `pnpm.cmd run test:provider-backed-console-contract`
  - `pnpm.cmd run test:postgresql-live-smoke-contract`
  - `pnpm.cmd run typecheck`
  - `pnpm.cmd run docs:build`
- Current host status:
  1. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
  2. do not reopen this lane without a fresh rerun that changes the executable report.
  3. follow-on loop truth moved away from PostgreSQL availability and into later Step 17, Step 18, and Step 20 closures.

## 13. Current Loop Closure - Generated OpenAPI Export And Server Release Sidecar

- `buildBirdCoderCodingServerOpenApiDocument()` is now the canonical TS-side document builder; `buildBirdCoderCodingServerOpenApiDocumentSeed()` remains compatibility-only.
- `scripts/coding-server-openapi-export.ts` materializes the canonical snapshot at `artifacts/openapi/coding-server-v1.json`.
- `pnpm.cmd run release:package:server` must reuse that same snapshot and stage it under `artifacts/release/server/<platform>/<arch>/openapi/coding-server-v1.json`.
- `release-asset-manifest.json` for the server family must reference the staged OpenAPI sidecar, and `pnpm.cmd run release:smoke:server` must fail if the manifest reference or sidecar file is missing.
- `local-release-command package server` now outputs auditable package facts instead of descriptor-only output:
  - `outputDir`
  - `outputFamilyDir`
  - `manifestPath`
  - `archivePath`
  - `artifacts`
- Default server packaging output is valid only under `artifacts/release/server/<platform>/<arch>/`; repo-root `server/*` output is invalid.
- Verification baseline for this slice:
  - `node --experimental-strip-types scripts/coding-server-openapi-export-contract.test.ts`
  - `node scripts/release/local-release-command.test.mjs`
  - `node scripts/release/package-release-assets.test.mjs`
  - `node scripts/release/smoke-server-release-assets.test.mjs`
  - `pnpm.cmd run generate:openapi:coding-server`
  - `pnpm.cmd run release:package:server`
  - `pnpm.cmd run release:smoke:server`
- Follow-on closure from this point is now closed across sections `14` through `16`: finalized release governance and downstream SDK/codegen consumers now reuse the same canonical exported snapshot.

## 14. Current Loop Closure - Finalized OpenAPI Governance And Codegen Input

- Finalized `release-manifest.json` now emits `codingServerOpenApiEvidence` whenever server release assets are present.
- `codingServerOpenApiEvidence` is derived only from packaged server sidecars and freezes:
  - `canonicalRelativePath`
  - `mirroredRelativePaths`
  - `targets`
  - `sha256`
  - `openapi`
  - `version`
  - `title`
- Multi-target server OpenAPI sidecars must stay byte-identical before one canonical summary may be published.
- `smoke-finalized-release-assets.mjs` now verifies `codingServerOpenApiEvidence` against packaged snapshots and fails if the summary is missing, drifted, or detached from server assets.
- Rendered release notes now surface the same canonical OpenAPI evidence instead of manually describing server contract state.
- `scripts/coding-server-openapi-codegen-input.mjs` is now the first downstream consumer of finalized OpenAPI governance; it reads `codingServerOpenApiEvidence` from `release-manifest.json` and resolves one canonical snapshot path for later SDK/codegen stages.
- Verification baseline for this slice:
  - `node scripts/coding-server-openapi-codegen-input.test.mjs`
  - `node scripts/release/finalize-release-assets.test.mjs`
  - `node scripts/release/smoke-finalized-release-assets.test.mjs`
  - `node scripts/release/render-release-notes.test.mjs`
  - `node scripts/release/render-release-notes-docs-registry.test.mjs`
  - `node scripts/release/local-release-command.mjs finalize --release-assets-dir <dir>`
  - `node scripts/release/smoke-finalized-release-assets.mjs --release-assets-dir <dir>`
  - `node scripts/coding-server-openapi-codegen-input.mjs --release-assets-dir <dir>`
- Follow-on closure from this point is now closed in section `15`: the first real SDK/codegen generation lane now materializes release-backed OpenAPI types.

## 15. Current Loop Closure - Finalized OpenAPI Types Codegen Lane

- `scripts/generate-coding-server-openapi-types.mjs` now consumes `scripts/coding-server-openapi-codegen-input.mjs` and materializes `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`.
- The generated module freezes one release-backed OpenAPI evidence object plus one deterministic operation catalog:
  - `canonicalRelativePath`
  - `targets`
  - `sha256`
  - `openapi`
  - `version`
  - `title`
  - sorted `path + method + operationId + summary + surface`
- `packages/sdkwork-birdcoder-types/src/index.ts` now exports that generated module, so downstream SDK/client work can consume `@sdkwork/birdcoder-types` instead of rediscovering finalized OpenAPI files ad hoc.
- `check:release-flow` now executes `scripts/generate-coding-server-openapi-types.test.mjs`, making the first release-backed SDK/codegen lane part of executable governance instead of docs-only intent.
- Verification baseline for this slice:
  - `node scripts/generate-coding-server-openapi-types.test.mjs`
  - `node scripts/generate-coding-server-openapi-types.mjs --release-assets-dir <dir>`
  - `pnpm.cmd run test:coding-server-openapi-types-codegen`
  - `pnpm.cmd run typecheck`
  - `pnpm.cmd run docs:build`
- Follow-on closure from this point is now closed in section `16`: the second-stage typed SDK/client generation lane now consumes `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`.

## 16. Current Loop Closure - Finalized Typed Client Codegen Lane

- `scripts/generate-coding-server-client-types.ts` now consumes `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts` and materializes `packages/sdkwork-birdcoder-types/src/generated/coding-server-client.ts`.
- The generated client module freezes one release-backed request-building surface instead of letting downstream consumers hand-assemble method/path pairs:
  - deterministic operation descriptor map keyed by `operationId`
  - typed `pathParams` map derived from canonical route placeholders
  - `buildBirdCoderFinalizedCodingServerClientRequest()`
  - `createBirdCoderFinalizedCodingServerClient()`
- `packages/sdkwork-birdcoder-types/src/index.ts` now exports that generated client module beside the generated OpenAPI catalog, so downstream consumers stay on one package-level truth source.
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts` is now the first real consumer of the generated request builder for representative app/admin reads:
  - `/api/app/v1/workspaces`
  - `/api/app/v1/projects`
  - `/api/app/v1/teams`
  - `/api/admin/v1/teams`
  - `/api/admin/v1/releases`
- Type governance now closes one critical regression guard: operations without route params must not require `pathParams`, while parametric operations still require them.
- Verification baseline for this slice:
  - `node --experimental-strip-types scripts/generate-coding-server-client-types.ts`
  - `node --experimental-strip-types scripts/generate-coding-server-client-types.test.ts`
  - `pnpm.cmd run test:coding-server-client-types-codegen`
  - `pnpm.cmd run test:app-admin-sdk-consumer-contract`
  - `pnpm.cmd run typecheck`
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`
- Follow-on closure from this point is now closed across sections `17` through `32`: representative generated-client adoption now sits behind shared high-level facades plus the typed core read/write response surfaces.

## 17. Current Loop Closure - Shared Generated App/Admin Facade

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now closes the first shared high-level representative app/admin facade on top of `createBirdCoderFinalizedCodingServerClient()`.
- `createBirdCoderGeneratedAppAdminApiClient({ transport })` is now the only approved shared facade for representative catalog reads on:
  - `/api/app/v1/workspaces`
  - `/api/app/v1/projects`
  - `/api/app/v1/teams`
  - `/api/admin/v1/teams`
  - `/api/admin/v1/releases`
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts` now acts as a thin delegator that contributes transport implementations only; it no longer hand-assembles representative app/admin request paths.
- `scripts/generated-app-admin-client-facade-contract.test.ts` now proves the shared facade preserves representative method/path/query wiring and unified list-envelope consumption.
- `check:release-flow` now executes that shared-facade contract, so this governance rule is executable rather than docs-only.
- Follow-on closure from this point is now closed across sections `18` through `32`: the same shared-facade pattern now covers default IDE services plus the representative shared `core / app / admin` consumer set.

## 18. Current Loop Closure - Default IDE Services Direct Shared-Facade Adoption

- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts` now composes default runtime HTTP clients and in-process fallback clients directly through `createBirdCoderGeneratedAppAdminApiClient({ transport })`.
- The default IDE service layer no longer uses `createBirdCoderAppAdminApiClient()` for transport-based representative app/admin reads; the infrastructure wrapper remains optional compatibility glue, not the default composition path.
- `scripts/default-ide-services-generated-app-admin-facade-contract.test.ts` now locks this adoption rule as an executable architecture contract.
- `check:release-flow` now executes that contract beside the existing shared-facade contract, so the default service-composition path cannot silently drift back to wrapper-based request assembly.
- Follow-on closure from this point is now closed across sections `20` through `32`: the remaining shared transport consumers now adopt the same generated-client-based facade stack.

## 19. Current Loop Closure - App/Admin Wrapper Removal

- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts` no longer exports a high-level `createBirdCoderAppAdminApiClient()` wrapper or its dedicated options type.
- The infrastructure module now owns transport factories only:
  - `createBirdCoderHttpApiTransport()`
  - `createBirdCoderInProcessAppAdminApiTransport()`
- High-level representative app/admin client composition is now owned only by `createBirdCoderGeneratedAppAdminApiClient({ transport })` in `@sdkwork/birdcoder-types`.
- `scripts/app-admin-sdk-consumer-contract.test.ts` now consumes the shared generated facade directly while preserving the same representative workspace/project/team/release verification path.
- `scripts/no-app-admin-client-wrapper-contract.test.ts` now prevents wrapper reintroduction and is part of `check:release-flow`.
- Follow-on closure from this point is now closed across sections `20` through `32`: later shared core transport consumers now keep infrastructure transport-only while types owns the high-level facades.

## 20. Current Loop Closure - Shared Core Read Facade

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes `createBirdCoderGeneratedCoreReadApiClient({ transport })` as the shared core read facade on top of `createBirdCoderFinalizedCodingServerClient()`.
- The current facade scope is intentionally limited to representative core routes that already have real server behavior:
  - `GET /api/core/v1/descriptor`
  - `GET /api/core/v1/runtime`
  - `GET /api/core/v1/health`
  - `GET /api/core/v1/engines`
  - `GET /api/core/v1/operations/:operationId`
- The shared facade now standardizes:
  - descriptor reads as `BirdCoderCodingServerDescriptor`
  - runtime reads as `BirdCoderCoreRuntimeSummary`
  - health reads as `BirdCoderCoreHealthSummary`
  - engine catalog reads as `BirdCoderEngineDescriptor[]`
  - operation reads as `BirdCoderOperationDescriptor`
- `scripts/generated-core-read-client-facade-contract.test.ts` now proves request wiring for those five core routes and is part of `check:release-flow`.
- Governance rule:
  - do not expose unimplemented core routes through the shared read facade
  - extend the facade only when the underlying server route has real behavior instead of `not_implemented`
- Follow-on closure from this point is now closed in section `21`: the shared core facade now covers the implemented projection reads.

## 21. Current Loop Closure - Shared Core Projection Read Facade

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now extends `createBirdCoderGeneratedCoreReadApiClient({ transport })` to the already implemented projection-read routes:
  - `GET /api/core/v1/coding-sessions/:id`
  - `GET /api/core/v1/coding-sessions/:id/events`
  - `GET /api/core/v1/coding-sessions/:id/artifacts`
  - `GET /api/core/v1/coding-sessions/:id/checkpoints`
- The shared facade now standardizes projection-read response mapping as:
  - session detail -> `BirdCoderCodingSessionSummary`
  - session events -> `BirdCoderCodingSessionEvent[]`
  - session artifacts -> `BirdCoderCodingSessionArtifact[]`
  - session checkpoints -> `BirdCoderCodingSessionCheckpoint[]`
- `scripts/generated-core-projection-read-client-facade-contract.test.ts` now proves method/path wiring for those four projection-read routes and is part of `check:release-flow`.
- Governance rule:
  - keep projection reads on the shared generated-client-based facade once Rust host behavior is real
  - keep not-yet-promoted core writes and still-unimplemented reads outside the shared high-level facade
  - continue keeping transport creation in infrastructure and high-level request assembly in `@sdkwork/birdcoder-types`
- Follow-on closure from this point is now closed across sections `22` through `32`: representative shared transport consumers now stay on the generated-client plus shared-facade stack.

## 22. Current Loop Closure - App Team Surface Split

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now splits workspace team reads from admin team reads on the shared app/admin facade:
  - `listTeams()` -> `GET /api/app/v1/teams`
  - `listAdminTeams()` -> `GET /api/admin/v1/teams`
- `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts` now serves both team surfaces in the in-process transport instead of forcing runtime team reads through the admin route.
- `ApiBackedTeamService` and the default IDE service/runtime transport path now consume the app-surface team catalog by default, so standard workspace reads no longer depend on admin-surface semantics.
- `scripts/generated-app-admin-client-facade-contract.test.ts`, `scripts/app-admin-sdk-consumer-contract.test.ts`, and `scripts/server-runtime-transport-contract.test.ts` now lock this split into executable governance.
- Governance rule:
  - runtime workspace/team reads must stay on `/api/app/v1/*`
  - admin team management reads must stay explicit via `listAdminTeams()`
  - do not collapse app/admin team semantics back into one ambiguous admin-only method
- Follow-on closure from this point is now closed across sections `23` through `32`: the remaining real transport consumers now preserve the same app/admin split and shared-facade adoption rules.

## 23. Current Loop Closure - Default IDE Release Service Adoption

- `BirdCoderAppAdminApiClient.listReleases()` remains the explicit admin release catalog reader on `GET /api/admin/v1/releases`.
- `IReleaseService` and `ApiBackedReleaseService` now close the first representative governed release-read service boundary on top of the shared app/admin facade.
- `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, and `useReleases()` now expose the same governed release catalog surface to app consumers without rebuilding admin HTTP or DTOs locally.
- `scripts/default-ide-services-release-service-contract.test.ts` is now part of `check:release-flow`.
- Governance rule:
  - keep governed release catalog reads explicit on the admin surface via `listReleases()`
  - keep request assembly in the generated client plus shared facade
  - adopt implemented shared core reads into default service/context consumers before typed write/response facades

## 24. Current Loop Closure - Default IDE Core Read Adoption

- `ICoreReadService` and `ApiBackedCoreReadService` now close the first default IDE service boundary on top of `BirdCoderCoreReadApiClient`.
- Runtime-bound default IDE services now compose `createBirdCoderGeneratedCoreReadApiClient({ transport: createBirdCoderHttpApiTransport(...) })` directly.
- `createDefaultBirdCoderIdeServices()`, `IDEContext`, and `ServiceContext` now expose `coreReadService`; `useCodingServerOverview()` is the first app-level consumer for:
  - `getDescriptor()`
  - `getRuntime()`
  - `getHealth()`
  - `listEngines()`
- This loop does not claim a local in-process core transport closure. Without a bound runtime or injected `coreReadClient`, core reads must stay explicitly unavailable instead of fabricating local authority.
- `scripts/default-ide-services-generated-core-read-facade-contract.test.ts` and `scripts/default-ide-services-core-read-service-contract.test.ts` are now part of `check:release-flow`.
- Governance rule:
  - keep runtime HTTP core reads on the shared generated facade
  - do not rebuild core request paths in infrastructure or app consumers
  - adopt core projection reads into app consumers next; do not skip forward to not-yet-promoted core writes

## 25. Current Loop Closure - App-Level Coding Session Projection Consumer Adoption

- `packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts` now closes the first reusable app-level consumer slice for implemented projection reads.
- The module standardizes one shared detail loader:
  - `loadCodingSessionProjection(coreReadService, codingSessionId)`
  - load order: `getCodingSession()` first, then `events / artifacts / checkpoints`
- `useCodingSessionProjection(codingSessionId)` is now the default app-consumer hook for:
  - `getCodingSession()`
  - `listCodingSessionEvents()`
  - `listCodingSessionArtifacts()`
  - `listCodingSessionCheckpoints()`
- `packages/sdkwork-birdcoder-commons/src/context/ideServices.ts` keeps shared service access available from a non-JSX module, so direct Node contracts validate the same consumer boundary without introducing alternate service truth.
- `scripts/coding-session-projection-app-consumer-contract.test.ts` is now part of `check:release-flow`.
- Governance rule:
  - keep coding-session detail request assembly in the generated client plus shared core-read facade
  - keep app consumers on `coreReadService` and shared projection payloads only
  - keep not-yet-promoted core writes outside high-level facades until the typed promotion lane closes

## 26. Current Loop Closure - Shared Core Facade Exclusion Governance

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes explicit governance metadata for the shared high-level core facade:
  - `BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS`
  - `BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS`
  - `isBirdCoderSharedCoreFacadeOperationId()`
  - `isBirdCoderSharedCoreFacadeExcludedOperationId()`
- The promoted catalog now covers only the current real high-level operations:
  - `core.getDescriptor`
  - `core.getRuntime`
  - `core.getHealth`
  - `core.listEngines`
  - `core.getOperation`
  - `core.getCodingSession`
  - `core.listCodingSessionEvents`
  - `core.listCodingSessionArtifacts`
  - `core.listCodingSessionCheckpoints`
- The excluded catalog now explicitly blocks:
  - `core.getEngineCapabilities`
  - `core.listModels`
  - `core.createCodingSessionTurn`
  - `core.submitApprovalDecision`
- `scripts/shared-core-facade-governance-contract.test.ts` is now part of `check:release-flow`.
- Governance rule:
  - keep blocked or not-yet-promoted operations visible only in the low-level generated client and generated OpenAPI catalog
  - promote an operation into the shared high-level facade only when the server route has real behavior and the typed facade closure is complete
  - treat exclusion-catalog changes as serial contract changes that require docs, tests, and release writeback together

## 27. Current Loop Closure - Real Core Create Session Route

- Rust host `POST /api/core/v1/coding-sessions` no longer returns `not_implemented`.
- The route now:
  - validates `workspaceId` and `projectId`
  - returns `201 Created` with a real `CodingSessionPayload`
  - mutates shared in-process projection authority state on demo/snapshot-backed hosts
  - persists `coding_sessions` plus `coding_session_runtimes` rows when the host is backed by a sqlite provider authority, then reloads projection reads from provider tables
- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` now keeps projection state on one shared authority handle so create/read requests in the same host process observe the same truth.
- Rust verification now covers both execution modes:
  - same-process create -> read closure
  - sqlite provider-backed create -> provider table persistence closure
- Governance rule:
  - treat `core.createCodingSession` as server-real but still excluded from the shared high-level facade until the typed write/response facade lane closes
  - do not keep describing `core.createCodingSession` as `not_implemented`

## 28. Current Loop Closure - Typed Core Create Session Facade And Consumer Adoption

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now exposes `createBirdCoderGeneratedCoreWriteApiClient({ transport })` on top of `createBirdCoderFinalizedCodingServerClient()`.
- The promoted shared core operation catalog now includes:
  - `core.createCodingSession`
  - `core.getDescriptor`
  - `core.getRuntime`
  - `core.getHealth`
  - `core.listEngines`
  - `core.getOperation`
  - `core.getCodingSession`
  - `core.listCodingSessionEvents`
  - `core.listCodingSessionArtifacts`
  - `core.listCodingSessionCheckpoints`
- The excluded shared core operation catalog now keeps only:
  - `core.getEngineCapabilities`
  - `core.listModels`
  - `core.createCodingSessionTurn`
  - `core.submitApprovalDecision`
- `createDefaultBirdCoderIdeServices()` now resolves remote create-session writes through the same shared transport rule already used by other runtime-bound facades.
- `ApiBackedProjectService.createCodingSession()` is now the first real consumer boundary on top of the shared core write facade:
  - resolve `workspaceId` from project truth
  - call server-authoritative `core.createCodingSession`
  - mirror the returned session into local project session state
  - preserve refreshed UI visibility instead of dropping the new session after catalog reload
- `ProviderBackedProjectService.upsertCodingSession()` now acts as the local sidecar mirror path for server-authoritative coding-session creates.
- Executable governance for this closure now includes:
  - `scripts/generated-core-write-client-facade-contract.test.ts`
  - `scripts/default-ide-services-generated-core-write-facade-contract.test.ts`
  - `scripts/api-backed-project-service-core-create-coding-session-contract.test.ts`
- Governance rule:
  - now that `core.createCodingSessionTurn` is server-real, keep it outside shared high-level facades until the typed write/response facade plus first consumer adoption close together
  - do not fabricate closure by promoting governance without a consumer path
  - do not fabricate closure by remote create alone if refreshed project catalogs lose the server-created session

## 29. Current Loop Closure - Real Core Create Session Turn Route

- Rust host `POST /api/core/v1/coding-sessions/:id/turns` no longer returns `not_implemented`.
- The route now:
  - validates `requestKind` plus `inputSummary`
  - returns `201 Created` with a real `CodingSessionTurnPayload`
  - mutates shared in-process projection authority state on demo/snapshot-backed hosts
  - persists `coding_session_turns`, `coding_session_events`, and `coding_session_operations` rows when the host is backed by a sqlite provider authority
  - refreshes `coding_sessions.updated_at` / `last_turn_at` plus the active runtime row before provider-backed projection reload
- `packages/sdkwork-birdcoder-server/src-host/src/lib.rs` now keeps turn creation on the same authority boundary as session create/read, so turn create, operation read, and event replay observe one truth source.
- Rust verification now covers both execution modes:
  - same-process create-turn -> operation read -> event replay closure
  - sqlite provider-backed create-turn -> provider turn/event/operation/session persistence closure
- Governance rule:
  - treat `core.createCodingSessionTurn` as server-real but still excluded from the shared high-level facade until the typed write facade and first consumer path close together
  - do not keep describing `core.createCodingSessionTurn` as `not_implemented`
  - do not promote `core.createCodingSessionTurn` into shared governance before release-flow and first consumer adoption are both executable

## 30. Current Loop Closure - Typed Core Create Session Turn Facade And Consumer Adoption

- `packages/sdkwork-birdcoder-types/src/server-api.ts` now extends `createBirdCoderGeneratedCoreWriteApiClient({ transport })` with `createCodingSessionTurn(codingSessionId, request)`.
- The promoted shared core operation catalog now includes:
  - `core.createCodingSessionTurn`
  - `core.createCodingSession`
  - the existing implemented core read operations
- The excluded shared core operation catalog now keeps only:
  - `core.getEngineCapabilities`
  - `core.listModels`
  - `core.submitApprovalDecision`
- `createBirdCoderGeneratedCoreWriteApiClient({ transport })` now normalizes:
  - `codingSessionId`
  - `requestKind`
  - `inputSummary`
  - optional `runtimeId`
- `ApiBackedProjectService.addCodingSessionMessage()` is now the first real consumer boundary on top of the shared turn-write facade:
  - user / planner / reviewer / tool messages map to canonical turn request kinds
  - server-created turn ids are mirrored into local message state
  - missing-server-session `404` falls back to the local sidecar path instead of breaking pre-existing local-only sessions
- `ProviderBackedProjectService.addCodingSessionMessage()` now preserves mirrored `turnId` and `metadata`, so refreshed project catalogs keep the server-authoritative turn link.
- Executable governance for this closure now includes:
  - `scripts/generated-core-write-client-facade-contract.test.ts`
  - `scripts/shared-core-facade-governance-contract.test.ts`
  - `scripts/api-backed-project-service-core-create-coding-session-turn-contract.test.ts`
- Governance rule:
  - keep turn-write request assembly in the generated client plus shared core write facade
  - keep the first consumer adoption on `projectService` instead of rebuilding `/turns` routes in app code
  - at that checkpoint, the next non-environmental serial slice was closing real `core.getEngineCapabilities` / `core.listModels` behavior plus shared-facade adoption while `core.submitApprovalDecision` was still blocked until approvals became real, and the later closure is recorded in `docs/release/release-2026-04-11-12.md`.

## 31. Current Loop Closure - Real Core Engine Capability And Model Catalog Adoption

- Rust host `GET /api/core/v1/engines`, `GET /api/core/v1/engines/:engineKey/capabilities`, and `GET /api/core/v1/models` now return real canonical engine/model truth instead of placeholder envelopes.
- The canonical server catalog now covers the current engine/kernel baseline:
  - `codex`
  - `claude-code`
  - `gemini`
  - `opencode`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now extends the shared core read facade with:
  - `getEngineCapabilities(engineKey)`
  - `listModels()`
- The promoted shared core operation catalog now also includes:
  - `core.getEngineCapabilities`
  - `core.listModels`
- The excluded shared core operation catalog now keeps only:
  - `core.submitApprovalDecision`
- `ICoreReadService`, `ApiBackedCoreReadService`, and `createDefaultBirdCoderIdeServices()` now expose the promoted engine/model reads end-to-end.
- `loadCodingServerOverview()` and `useCodingServerOverview()` now close the first app-level consumer boundary for:
  - `getDescriptor()`
  - `getRuntime()`
  - `getHealth()`
  - `listEngines()`
  - `getEngineCapabilities()`
  - `listModels()`
- Executable governance for this closure now includes:
  - `scripts/generated-core-read-client-facade-contract.test.ts`
  - `scripts/shared-core-facade-governance-contract.test.ts`
  - `scripts/default-ide-services-core-read-service-contract.test.ts`
  - `scripts/coding-server-overview-engine-model-consumer-contract.test.ts`
- Governance rule:
  - treat engine catalog, engine capability, and model catalog truth as one serial promotion boundary
  - keep `core.submitApprovalDecision` blocked until approval authority truth plus consumer adoption are both real
  - treat this section as the current authoritative override for engine/model shared-core governance

## 32. Current Loop Closure - Real Core Approval Decision Lane

- Rust host `POST /api/core/v1/approvals/:approvalId/decision` now returns a real approval-decision envelope instead of `not_implemented`.
- Approval submission now mutates one replayable authority path in both execution modes:
  - demo/snapshot-backed hosts mutate shared in-memory projection authority
  - sqlite provider-backed hosts persist checkpoint / event / operation / turn state, then reload projection truth from provider tables
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now extends the shared core write facade with `submitApprovalDecision(approvalId, request)`.
- Shared core high-level governance is now fully promoted for currently real core routes:
  - `BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS` includes `core.submitApprovalDecision`
  - `BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS` is now empty
- `ICoreWriteService`, `ApiBackedCoreWriteService`, default IDE service composition, `IDEContext`, and `ServiceContext` now expose approval submission through one shared write boundary instead of page-local route assembly.
- `packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts` now closes the first approval-facing consumer boundary:
  - `deriveCodingSessionPendingApprovals()`
  - `loadCodingSessionApprovalState()`
  - `submitCodingSessionApprovalDecision()`
  - `useCodingSessionApprovalState()`
- Canonical approval-resolution replay semantics are now fixed:
  - checkpoint state stores `decision`, `decisionReason`, `runtimeStatus`, `operationStatus`, `turnId`, and `operationId`
  - `operation.updated` emits `approvalDecision`, optional `decisionReason`, `runtimeStatus`, and `operationStatus`
  - approved decisions keep runtime/operation active on `awaiting_tool` / `running`
  - denied or blocked decisions mark runtime/operation/turn as failed
- Executable verification for this closure is:
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml submit_approval_decision_route`
  - `pnpm.cmd run test:generated-core-write-client-facade-contract`
  - `pnpm.cmd run test:shared-core-facade-governance-contract`
  - `pnpm.cmd run test:coding-session-approval-consumer-contract`
  - `pnpm.cmd run test:api-backed-project-service-core-create-coding-session-contract`
  - `pnpm.cmd run test:api-backed-project-service-core-create-coding-session-turn-contract`
  - `pnpm.cmd run typecheck`
- Follow-on closure from this point is now closed in sections `33` through `38`: the remaining representative app/admin routes no longer return `not_implemented`, and the PostgreSQL host-pass closure is recorded later on this page.

## 33. Current Loop Closure - Real App Document Catalog Lane

- Rust host `GET /api/app/v1/documents` now returns a real document catalog envelope instead of `not_implemented`.
- Representative document truth now converges on one replayable authority path:
  - demo host: `AppState.documents`
  - legacy sqlite `kv_store`: `table.sqlite.project-documents.v1` materialized into `project_documents`
  - direct sqlite provider: `project_documents`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now extends the shared app/admin facade with `listDocuments()`.
- `packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts`, `appAdminConsoleQueries.ts`, and `appAdminApiClient.ts` now promote `project_documents` through the shared repository/query/transport boundary.
- `IDocumentService`, `ApiBackedDocumentService`, `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, `loadDocuments()`, and `useDocuments()` now close the first reusable document consumer boundary on the shared facade path.
- Executable verification for this closure is:
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml representative_app_and_admin_real_list_routes_return_runtime_data`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_sqlite_kv_store_when_configured`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured`
  - `pnpm.cmd run test:generated-app-admin-client-facade-contract`
  - `pnpm.cmd run test:provider-backed-console-contract`
  - `pnpm.cmd run test:app-admin-sdk-consumer-contract`
  - `pnpm.cmd run test:default-ide-services-document-service-contract`
  - `pnpm.cmd run test:document-app-consumer-contract`
  - `pnpm.cmd run typecheck`
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`
- Remaining representative placeholder routes at this checkpoint were:
  - `GET /api/app/v1/deployments`
  - `GET /api/admin/v1/audit`
  - `GET /api/admin/v1/policies`
  - `GET /api/admin/v1/deployments`
- Next non-environmental serial slice: `docs/step/17Y-Real-Admin-Audit-Lane.md`.

## 34. Current Loop Closure - Real Admin Audit Lane

- Rust host `GET /api/admin/v1/audit` now returns a real audit catalog envelope instead of `not_implemented`.
- Representative audit truth now converges on one replayable authority path:
  - demo host: in-process audit state
  - legacy sqlite `kv_store`: `table.sqlite.audit-events.v1` materialized into `audit_events`
  - direct sqlite provider: `audit_events`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now extends the shared app/admin facade with `listAuditEvents()`.
- `packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts`, `appAdminConsoleQueries.ts`, and `appAdminApiClient.ts` now promote `audit_events` through the shared repository/query/transport boundary.
- `IAuditService`, `ApiBackedAuditService`, `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, `loadAuditEvents()`, and `useAuditEvents()` now close the first reusable audit consumer boundary on the shared facade path.
- Executable verification for this closure is:
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
  - `pnpm.cmd run docs:build`
  - `pnpm.cmd run check:release-flow`
- Remaining representative placeholder routes at this checkpoint were:
  - `GET /api/app/v1/deployments`
  - `GET /api/admin/v1/policies`
  - `GET /api/admin/v1/deployments`
- Next non-environmental serial slice: `docs/step/17Z-Real-App-Deployment-Catalog-Lane.md`.

## 35. Current Loop Closure - Real App Deployment Catalog Lane

- Rust host `GET /api/app/v1/deployments` now returns a real deployment catalog envelope instead of `not_implemented`.
- Representative deployment truth now converges on one replayable authority path:
  - demo host: in-process deployment state
  - legacy sqlite `kv_store`: deployment payloads materialized into `deployment_records`
  - direct sqlite provider: `deployment_records`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now extends the shared app/admin facade with `listDeployments()`.
- `packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts`, `appAdminConsoleQueries.ts`, and transport-backed app/admin client wiring now promote `deployment_records` through the shared repository/query/transport boundary.
- `IDeploymentService`, `ApiBackedDeploymentService`, `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, `loadDeployments()`, and `useDeployments()` now close the first reusable deployment consumer boundary on the shared facade path.
- Executable verification for this closure is:
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
- Next non-environmental serial slice: `docs/step/17ZA-Real-Admin-Deployment-Governance-Lane.md`.

## 36. Current Loop Closure - Real Admin Deployment Governance Lane

- Rust host `GET /api/admin/v1/deployments` now returns a real deployment governance envelope instead of `not_implemented`.
- Representative admin deployment truth now converges on one replayable authority path:
  - demo host: in-process deployment state
  - legacy sqlite `kv_store`: deployment payloads materialized into `deployment_records`
  - direct sqlite provider: `deployment_records`
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now extends the shared app/admin facade with `listAdminDeployments()`.
- In-process transport plus the shared deployment query/repository layer now serve both deployment surfaces from the same authority path.
- `IAdminDeploymentService`, `ApiBackedAdminDeploymentService`, `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, `loadAdminDeployments()`, and `useAdminDeployments()` now close the first reusable admin deployment consumer boundary on the shared facade path.
- Executable verification for this closure is:
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
- The follow-on serial closure from this point was the dedicated admin policy governance lane, now closed in section `37`.

## 37. Current Loop Closure - Real Admin Policy Governance Lane

- Rust host `GET /api/admin/v1/policies` now returns a real governance-policy envelope instead of `not_implemented`.
- Representative admin policy truth now converges on one dedicated authority path:
  - demo host: in-process policy state
  - legacy sqlite `kv_store`: `table.sqlite.governance-policies.v1` materialized into `governance_policies`
  - direct sqlite provider: `governance_policies`
- `packages/sdkwork-birdcoder-types/src/data.ts` now freezes `governance_policy -> governance_policies` as the dedicated policy authority model.
- `packages/sdkwork-birdcoder-types/src/server-api.ts` now extends the shared app/admin facade with `listPolicies()`.
- `packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts`, `appAdminConsoleQueries.ts`, and `appAdminApiClient.ts` now promote `governance_policies` through the shared repository/query/transport boundary.
- `IAdminPolicyService`, `ApiBackedAdminPolicyService`, `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, `loadAdminPolicies()`, and `useAdminPolicies()` now close the first reusable admin policy consumer boundary on the shared facade path.
- Executable verification for this closure is:
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
- Follow-on closure from this point was the PostgreSQL host-pass evidence recorded in section `38`; the next non-environmental serial slice then moved to `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md`.

## 38. Current Loop Closure - PostgreSQL Live Smoke Host Pass

- `pnpm.cmd run release:smoke:postgresql-live` now has a recorded DSN-backed `passed` report on this host via a temporary Docker-backed PostgreSQL 16 runtime on `127.0.0.1:55432`.
- PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.
- This host-real closure is documented in `docs/release/release-2026-04-13-04.md`; follow-on loop truth moved away from PostgreSQL availability and into later Step 18 and Step 20 closures.
- Representative verification for this closure was:
  - `docker run -d --rm --name birdcoder-postgresql-live-smoke-20260413 -e POSTGRES_USER=birdcoder -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=birdcoder -p 55432:5432 postgres:16-alpine`
  - `docker exec birdcoder-postgresql-live-smoke-20260413 pg_isready -U birdcoder -d birdcoder`
  - `cmd /d /s /c "set BIRDCODER_POSTGRESQL_DSN=postgresql://birdcoder:secret@127.0.0.1:55432/birdcoder && pnpm.cmd run release:smoke:postgresql-live"` -> `passed`
  - `docker stop birdcoder-postgresql-live-smoke-20260413`
