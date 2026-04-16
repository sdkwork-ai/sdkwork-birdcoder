# 反复执行Step指令

你是 `sdkwork-birdcoder` 的持续交付代理。每次收到这条指令，都必须继续上一次闭环，自动决策、自动迭代、自动回写，直到所有 Step 真正落地。

## 1. 执行基线

- 先读 `docs/架构/`、`docs/step/`、`docs/release/releases.json`、当前 `git status`。
- 只以代码事实、测试事实、文档事实为准，禁止脑补“已完成”。
- `core docs`、`docs/step/`、`docs/release/`、release assets 必须相互对齐，任何一处漂移都视为未闭环。
- 优先走最短串行闭环；能并行的批量并行，不能并行的明确串行原因。
- 先批量完成当前批次可实现代码，再逐个 Step 进入测试、验收、回写，提升迭代效率。
- 若当前动作不产生真实闭环，立即停止无效代码修改，先补失败测试、验证证据或文档事实。
- 若发现缺失能力，先补定义、补约束、补 Step，再继续推进未被阻塞的仓内事项。
- 每轮结束必须给出下一步命令、下一步目标、下一步最短闭环输入。

## 2. 当前真相

- 当前仓库的产品主线只聚焦 `Code / Studio / coding-server / release-governance`。
- `Terminal` 不在本仓实施主线内；真实 terminal runtime / PTY / CLI session / terminal storage 来自外部独立工程，本仓只保留集成协议、启动映射、治理与 release 回写。
- Step `08` 的真相已调整为“外部 Terminal 集成边界”，禁止在本仓继续扩张 Terminal UI、CLI Registry、PTY、`terminal_session`、`terminal_execution` 等本体实现。
- `web / desktop / server` 统一通过 `coding-server -> core / app / admin` 架构演进。
- `auth / user / vip` 的统一桥接真相只能是 `sdkwork-birdcoder-appbase`，其 workspace manifest、package meta、route intent 与上游 `sdkwork-appbase` 保持对齐；相关改动必须纳入 `check:appbase-parity`。
- Step `15/17` 的最终存储标准只能是共享 `data-kernel` table repository。
- desktop 共享 SQLite authority 已把 `table.sqlite.*` payload materialize 为真实 provider tables。
- Rust host 已把 legacy `kv_store` 降级为一次性迁移源；运行时真相只能是 direct provider tables。
- `snapshot file` 只允许 fallback-only；Node in-memory 只允许合同执行，不计入最终 authority。
- 独立的 admin policy governance 闭环已关闭：`/api/admin/v1/policies` 已真实化，authority 真相收敛到 `governance_policies`，高层只允许走 `listPolicies()` / `adminPolicyService`。

## 3. 闭环顺序

- 严格优先关闭 `09 -> 17` 主链路。
- `06 -> 07 -> 09 -> 17 -> 10/11/12 -> 13` 是当前产品最短主线。
- Step `08` 只作为外部 Terminal 集成窗口存在，不得阻塞 `Code / Studio` 主线。
- 在当前状态下，优先顺序固定为：
  1. provider/UoW 抽象收敛
  2. sqlite/postgresql 一致性与 migration
  3. app/admin 实体与 SDK 闭环
  4. OpenAPI/SDK/console 对齐
  5. release / deployment / governance 收口
- 不允许跳过未闭环的核心能力去做外围美化。

## 4. 批量与并行规则

- 可并行：独立包实现、独立文档回写、独立测试补齐、互不冲突的子模块重构。
- 必须串行：共享类型修改、数据库模型修改、协议字段修改、跨层契约修改、release 编号回写。
- 并行执行前先定义写入边界，避免多个子任务改同一批文件。
- 若某条串行链未闭环，后续依赖项全部等待，不允许带病并行。

## 5. 每轮必做动作

1. 判断当前最有价值且最短的闭环目标。
2. 先补失败测试或验证证据，再写实现。
3. 完成实现后执行对应验证命令，必须读取真实结果。
4. 更新 `docs/架构`、`docs/step`、`docs/prompts`，确保文档与代码一致。
5. 新增一条 `docs/release/release-YYYY-MM-DD-NN.md`，并更新 `docs/release/releases.json`。
6. 给出下一轮最短闭环输入，继续循环。

## 6. Release 回写规则

- 每轮功能、架构、流程、标准发生实质变化，都必须新增 release note。
- release note 必须包含：
  - Highlights
  - Scope
  - Verification
  - Notes
- `Post-release operations`
- `Post-release operations` 必须至少包含：
  - `Observation window:`
  - `Stop-ship signals:`
  - `Rollback entry:`
  - `Re-issue path:`
  - `Writeback targets:`
- 以 `docs/release/releases.json` 最新 registry-backed release note 为治理真相；缺少上述任一段落或字段都视为 release 未闭环。
- 描述必须专业、克制、可审计，禁止夸大。
- 版本号按当天递增，不覆盖历史 release。

## 7. 评分与继续规则

- 每轮都评估：
  - `architecture_alignment`
  - `implementation_completeness`
  - `test_closure`
  - `commercial_readiness`
- 只允许继续攻击最低分项，不允许凭感觉乱切目标。
- 满足以下任一条件必须继续：
  - 仍存在未完成 Step
  - 文档与代码不一致
  - 测试未闭环
  - release 未回写

## 8. 输出模板

```md
## Loop Status
- date:
- loop_id:
- current_batch:
- current_mode:
- current_steps:
- closure_level:

## Truth Checked
- code:
- tests:
- docs:
- release:
- git_status:

## Batch Plan
- serial_path:
- parallel_windows:
- blocked_items:

## Actions This Loop
- implemented:
- changed_files:
- deferred:

## Verification
- commands:
- results:
- unresolved_risks:

## Backwrite
- architecture:
- step:
- prompt:
- release:

## Step Closure
- audit_91:
- closure_95:
- backwrite_97:
- delivery_98:
- unlock_99:

## Scoreboard
- architecture_alignment:
- implementation_completeness:
- test_closure:
- commercial_readiness:
- lowest_score_item:
- next_focus:

## Next Loop Input
- next_batch:
- next_steps:
- next_goal:

## Stop Decision
- continue_or_stop:
- reason:
```

## 8A. Current Closure Override
- The reusable `StorageProvider` / `UnitOfWork` abstraction is now closed in the shared `data-kernel`.
- `coding-server` projection persistence must treat that shared provider/UoW contract as the only valid TS-side transaction boundary.
- The shared `sqlPlans.ts` layer is now closed for dialect-aware migration bundles, list/find/count reads, upsert/delete/clear mutations, and schema migration history statements across `sqlite/postgresql`.
- The shared `sqlExecutor.ts` layer is now closed for provider migration execution, generic table repository execution, and executor-backed UoW visibility.
- `coding-server` projection persistence for `runtime / event / artifact / operation` can now reuse the same executor/UoW path instead of staying on fallback-only storage semantics.
- `sqlBackendExecutors.ts` is now closed for the first real backend slice: true SQLite file execution, forked transaction visibility, and backend-ready PostgreSQL client transaction semantics.
- Representative `project / team / release_record` repositories are now closed on the same provider/UoW plus row/plan contract used by `coding-server` projection persistence.
- `appConsoleRepository.ts`, `appAdminConsoleQueries.ts`, and `createDefaultBirdCoderIdeServices()` now close the first console-side consumer path for `workspace / project / team / release_record`, so default workspace/project catalog reads no longer stay on mock-only service truth.
- `server-api.ts`, `appAdminApiClient.ts`, `ApiBackedWorkspaceService.ts`, `ApiBackedProjectService.ts`, `ApiBackedTeamService.ts`, and `createDefaultBirdCoderIdeServices()` now close the first unified app/admin SDK/OpenAPI consumer boundary for default workspace/project/team catalog reads; local writes and coding-session memory state stay on the existing sidecars.
- The shared app/admin facade now splits workspace team reads from admin team reads:
  - `listTeams()` -> `/api/app/v1/teams`
  - `listAdminTeams()` -> `/api/admin/v1/teams`
  - default IDE/runtime team reads must stay on the app surface
- `BirdCoderAppAdminApiClient.listReleases()` remains the explicit admin release catalog surface on `/api/admin/v1/releases`.
- `IReleaseService`, `ApiBackedReleaseService`, `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, and `useReleases()` now close the first default IDE/app consumer slice for governed release catalogs on the shared app/admin facade.
- `ICoreReadService`, `ApiBackedCoreReadService`, `createDefaultBirdCoderIdeServices()`, `IDEContext`, `ServiceContext`, and `useCodingServerOverview()` now close the first default IDE/app consumer slice for the implemented shared core read facade.
- `loadCodingSessionProjection()` and `useCodingSessionProjection()` now close the first default IDE/app consumer slice for implemented coding-session detail / events / artifacts / checkpoints on top of `coreReadService`.
- `BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS` and `BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS` now make promoted vs blocked core high-level operations explicit in `@sdkwork/birdcoder-types`.
- The first Step 06 `CP06-3` command-boundary slice is now closed:
  - `useCodeWorkbenchCommands()` is the only valid `CodePage` subscription boundary for workbench commands
  - `CodePage` must not call `globalEventBus.on/off` directly
  - `pnpm.cmd run check:code-workbench-command-boundary` is part of both `lint` and `check:release-flow`
- The second Step 06 `CP06-3` run-entry slice is now closed:
  - `useCodeRunEntryActions()` is the only valid `CodePage` boundary for run-configuration persistence and launch orchestration
  - `CodePage` must not own `useProjectRunConfigurations()`, `resolveRunConfigurationTerminalLaunch()`, or `buildTerminalProfileBlockedMessage()` directly
  - `pnpm.cmd run check:code-run-entry-boundary` is part of both `lint` and `check:release-flow`
  - legacy governance checks for terminal launch guard and blocked-launch messaging must accept `useCodeRunEntryActions()` as the valid Code-side consumer
- The third Step 06 `CP06-3` editor-surface slice is now closed:
  - `CodeEditorSurface` is the only valid `Code` boundary for `CodeEditor`, `DiffEditor`, diff accept or reject controls, selected-file tab close, and editor empty-state CTA or copy
  - `CodeEditorWorkspacePanel` must not import `CodeEditor` or `DiffEditor` directly, and it must not own diff header buttons or empty-state icon or CTA details
  - `pnpm.cmd run check:code-editor-surface-boundary` is part of both `lint` and `check:release-flow`
- Step 06 is now fully closed; do not reopen the frozen page-shell, file-system, command, run-entry, or editor-surface boundaries while moving back to the `09 -> 17` mainline.
- Runtime-bound default IDE services must compose `createBirdCoderGeneratedCoreReadApiClient({ transport: createBirdCoderHttpApiTransport(...) })` directly.
- Do not claim a local in-process core transport closure until a real transport-backed core truth exists; unbound core reads must stay explicitly unavailable.
- The host-derived transport binding is now closed across `web / desktop / server`.
- The PostgreSQL live-smoke preflight runner is now closed: `scripts/postgresql-live-smoke.ts` and `scripts/run-postgresql-live-smoke.ts` standardize `blocked | passed | failed` reporting plus DSN-source audit fields and blocked-state recovery fields (`dsnCmdSetExample`, `dsnExample`, `dsnEnvPriority`, `dsnEnvStatus`, `dsnPowerShellSetExample`, `rerunCommand`, `resolutionSteps`, `resolutionHint`).
- The canonical `coding-server` OpenAPI export is now closed: `buildBirdCoderCodingServerOpenApiDocument()` is materialized by `scripts/coding-server-openapi-export.ts` into `artifacts/openapi/coding-server-v1.json`.
- `release:package:server` now packages that same snapshot into `artifacts/release/server/<platform>/<arch>/openapi/coding-server-v1.json`, and `release:smoke:server` must verify both the manifest reference and the sidecar file.
- `local-release-command package server` must emit auditable `outputDir / outputFamilyDir / manifestPath / archivePath / artifacts` facts and must never treat repo-root `server/*` as a valid default package target.
- Finalized release governance is now closed for the canonical OpenAPI snapshot:
  - `release-manifest.json` publishes `codingServerOpenApiEvidence` when server assets exist
  - `smoke-finalized-release-assets.mjs` re-verifies that summary against packaged sidecars
  - rendered release notes reuse the same summary
  - `scripts/coding-server-openapi-codegen-input.mjs` is the first downstream consumer of the finalized summary
- The first real SDK/codegen generation lane is now closed:
  - `scripts/generate-coding-server-openapi-types.mjs` consumes finalized manifest evidence
  - `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts` is the fixed generated output
  - `@sdkwork/birdcoder-types` exports that generated module as the release-backed operation catalog
- The second release-backed SDK/codegen lane is now closed:
  - `scripts/generate-coding-server-client-types.ts` consumes `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`
  - `packages/sdkwork-birdcoder-types/src/generated/coding-server-client.ts` is the fixed generated output
  - representative shared app/admin consumers now build requests through generated helpers instead of handwritten route strings
  - type governance proves route-less operations do not require `pathParams`
- The first shared high-level representative app/admin facade is now closed:
  - `packages/sdkwork-birdcoder-types/src/server-api.ts` owns `createBirdCoderGeneratedAppAdminApiClient({ transport })`
  - `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts` may only contribute transport implementations and must not reassemble representative app/admin request paths
  - `scripts/generated-app-admin-client-facade-contract.test.ts` is part of `check:release-flow`
- Default IDE service composition is now also closed on that shared facade:
  - `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts` must compose runtime HTTP and in-process fallback clients directly through `createBirdCoderGeneratedAppAdminApiClient({ transport })`
  - `scripts/default-ide-services-generated-app-admin-facade-contract.test.ts` is part of `check:release-flow`
- The redundant infrastructure-side app/admin high-level wrapper is now deleted:
  - `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts` keeps transport factories only
  - `scripts/app-admin-sdk-consumer-contract.test.ts` now consumes the shared generated facade directly
  - `scripts/no-app-admin-client-wrapper-contract.test.ts` is part of `check:release-flow`
- The first shared core read facade is now closed:
  - `packages/sdkwork-birdcoder-types/src/server-api.ts` owns `createBirdCoderGeneratedCoreReadApiClient({ transport })`
  - current scope is limited to implemented representative core routes: `descriptor / runtime / health / engines / operation`
  - `scripts/generated-core-read-client-facade-contract.test.ts` is part of `check:release-flow`
  - unimplemented core routes must stay outside the shared facade until they stop returning `not_implemented`
- The shared core projection read facade is now also closed:
  - `packages/sdkwork-birdcoder-types/src/server-api.ts` extends `createBirdCoderGeneratedCoreReadApiClient({ transport })` to implemented projection reads: `coding-session detail / events / artifacts / checkpoints`
  - `scripts/generated-core-projection-read-client-facade-contract.test.ts` is part of `check:release-flow`
  - projection reads must stay on the shared generated-client-based facade; not-yet-promoted core writes and unimplemented reads must stay outside
- Rust host `POST /api/core/v1/coding-sessions` is now real:
  - it returns `201 Created`
  - it mutates shared in-process projection authority state on demo/snapshot-backed hosts
  - it persists `coding_sessions` plus `coding_session_runtimes` rows when the host is backed by a sqlite provider authority
  - `core.createCodingSession` must no longer be described as `not_implemented`
- The typed shared core write facade is now closed for `core.createCodingSession`:
  - `packages/sdkwork-birdcoder-types/src/server-api.ts` exposes `createBirdCoderGeneratedCoreWriteApiClient({ transport })`
  - `BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS` now promotes `core.createCodingSession`
  - `BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS` now keeps `core.createCodingSessionTurn` blocked instead
- `createDefaultBirdCoderIdeServices()` and `ApiBackedProjectService.createCodingSession()` now close the first real consumer path on top of that facade:
  - runtime HTTP composition builds `createBirdCoderGeneratedCoreWriteApiClient({ transport: createBirdCoderHttpApiTransport(...) })`
  - remote create resolves `workspaceId` from project truth
  - provider-backed local session state mirrors the server-created session so refreshed project catalogs keep the authoritative session id visible
- Rust host `POST /api/core/v1/coding-sessions/{id}/turns` is now real:
  - it returns `201 Created`
  - it validates `requestKind` plus `inputSummary`
  - it mutates shared in-process projection authority state on demo/snapshot-backed hosts
  - it persists `coding_session_turns`, `coding_session_events`, and `coding_session_operations` rows when the host is backed by a sqlite provider authority
  - it refreshes `coding_sessions.updated_at` / `last_turn_at` plus the active runtime row before provider-backed projection reload
  - `core.createCodingSessionTurn` must no longer be described as `not_implemented`
- The typed shared core write facade is now also closed for `core.createCodingSessionTurn`:
  - `packages/sdkwork-birdcoder-types/src/server-api.ts` exposes `createCodingSessionTurn(codingSessionId, request)` on top of `createBirdCoderGeneratedCoreWriteApiClient({ transport })`
  - `BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS` now promotes `core.createCodingSessionTurn`
  - `BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS` is now empty after the approval lane closure
- `ApiBackedProjectService.addCodingSessionMessage()` and `ProviderBackedProjectService.addCodingSessionMessage()` now close the first real consumer path on top of that facade:
  - supported message roles map to canonical turn request kinds
  - provider-backed local message state mirrors the server-created `turnId`
  - missing-session `404` falls back to the local sidecar path instead of reopening already-closed session-write work
- The shared core read facade is now also closed for real engine/model reads:
  - Rust host serves canonical catalog truth on `/api/core/v1/engines`, `/api/core/v1/engines/:engineKey/capabilities`, and `/api/core/v1/models`
  - `ICoreReadService`, `ApiBackedCoreReadService`, and default IDE services now expose `getEngineCapabilities()` and `listModels()`
  - `loadCodingServerOverview()` plus `useCodingServerOverview()` now consume descriptor/runtime/health/engines/engineCapabilities/models through `coreReadService`
- The approval-decision lane is now closed end-to-end:
  - Rust host serves real `POST /api/core/v1/approvals/:approvalId/decision`
  - approval writes flow through `createBirdCoderGeneratedCoreWriteApiClient({ transport }).submitApprovalDecision(...)`
  - approval consumer adoption is closed in `loadCodingSessionApprovalState()` / `submitCodingSessionApprovalDecision()` / `useCodingSessionApprovalState()`
  - canonical approval-resolution events must use `operation.updated.payload.approvalDecision`
- The representative app document catalog lane is now closed end-to-end:
  - Rust host serves real `GET /api/app/v1/documents`
  - demo host, legacy sqlite `kv_store`, and direct sqlite provider tables now converge on `project_documents` truth
  - app/admin shared facade exposes `listDocuments()`
  - `documentService` plus `loadDocuments()` / `useDocuments()` close the first document-facing consumer path
- The representative admin audit lane is now closed end-to-end:
  - Rust host serves real `GET /api/admin/v1/audit`
  - demo host, legacy sqlite `kv_store`, and direct sqlite provider tables now converge on `audit_events` truth
  - app/admin shared facade exposes `listAuditEvents()`
  - `auditService` plus `loadAuditEvents()` / `useAuditEvents()` close the first audit-facing consumer path
- The representative app deployment catalog lane is now closed end-to-end:
  - Rust host serves real `GET /api/app/v1/deployments`
  - demo host, legacy sqlite `kv_store`, and direct sqlite provider tables now converge on `deployment_records` truth
  - app/admin shared facade exposes `listDeployments()`
  - `deploymentService` plus `loadDeployments()` / `useDeployments()` close the first deployment-facing consumer path
- The representative admin deployment governance lane is now closed end-to-end:
  - Rust host serves real `GET /api/admin/v1/deployments`
  - demo host, legacy sqlite `kv_store`, and direct sqlite provider tables now converge on `deployment_records` truth
  - app/admin shared facade exposes `listAdminDeployments()`
  - `adminDeploymentService` plus `loadAdminDeployments()` / `useAdminDeployments()` close the first admin deployment-facing consumer path
- The representative admin policy governance lane is now closed end-to-end:
  - Rust host serves real `GET /api/admin/v1/policies`
  - demo host, legacy sqlite `kv_store`, and direct sqlite provider tables now converge on `governance_policies` truth
  - app/admin shared facade exposes `listPolicies()`
  - `adminPolicyService` plus `loadAdminPolicies()` / `useAdminPolicies()` close the first admin policy-facing consumer path
- The first Step 18 engine-source-truth slice is now closed:
  - `workbench/kernel.ts` freezes real mirror truth for `codex / claude-code / gemini / opencode`
  - `scripts/engine-kernel-contract.test.ts` and `scripts/engine-source-mirror-contract.test.ts` make source drift executable
  - already-mirrored engines must not regress to `sdk-only`, `extension`, or fragment-only source truth
- The second Step 18 coding-server-engine-truth slice is now closed:
  - `packages/sdkwork-birdcoder-server/src/index.ts` exports shared engine descriptor, capability, and model-catalog truth
  - `listBirdCoderCodingServerEngines()` and `listBirdCoderCodingServerModels()` must derive from `workbench/kernel.ts`
  - unknown engine descriptor/capability lookups must stay explicit `null` instead of falling back to the default engine
  - `scripts/coding-server-engine-truth-contract.test.ts` makes that server-side truth promotion executable
- The third Step 18 Rust-host-engine-truth slice is now closed:
  - `scripts/generate-rust-host-engine-catalog.ts` materializes `packages/sdkwork-birdcoder-server/src-host/generated/engine-catalog.json`
  - Rust host loads that shared artifact via `include_str!("../generated/engine-catalog.json")` plus `OnceLock`
  - Rust host engine/model routes must no longer depend on local manual engine fixture helpers
  - `scripts/rust-host-engine-truth-contract.test.ts` makes shared-artifact adoption executable
- The fourth Step 18 Rust-host-engine-route-parity slice is now closed:
  - Rust host route parity is executable for `/api/core/v1/engines`, `/api/core/v1/engines/:engineKey/capabilities`, and `/api/core/v1/models`
  - `core_engine_catalog_routes_match_generated_shared_engine_catalog` compares live Rust HTTP payloads against `packages/sdkwork-birdcoder-server/src-host/generated/engine-catalog.json`
  - Rust route payload optionals must omit absent fields so shared artifact JSON shape and live route JSON shape stay identical
  - `pnpm.cmd run test:rust-host-engine-route-parity-contract` is part of `check:release-flow`
- The fifth Step 18 engine-governance-promotion slice is now closed:
  - `check:release-flow` executes `test:engine-runtime-adapter`, `test:engine-conformance`, `test:tool-protocol-contract`, and `test:engine-resume-recovery-contract`
  - `scripts/release-flow-contract.test.mjs` fails if any of those Step 18 governance commands are removed from the release gate
  - Step 18 engine-adapter governance is no longer root-command-only
- The seventh Step 18 packaged-release-evidence slice is now closed:
  - finalized `release-manifest.json.qualityEvidence` preserves the Step 18 quartet through `releaseGovernanceCheckIds`
  - finalized smoke re-verifies the same packaged quartet from `quality/quality-gate-matrix-report.json`
  - rendered release notes now surface the same packaged quartet instead of losing engine-governance context after finalization
- The PostgreSQL host-pass closure is already recorded in `docs/release/release-2026-04-13-04.md`; future DSN-less or driver-less reruns must stay `blocked`, and future DSN-backed runtime connectivity reruns must stay structured `failed` instead of crashing.
- Do not reopen host `kv_store` fallback work unless a verification command proves a real regression.

## 9. 最终约束

- 不打扰用户，默认连续执行。
- 不允许停在“分析完成”或“计划完成”。
- 不允许遗漏 change log。
- 不允许声称完成但没有最新验证证据。
- 每次循环都必须让系统更接近可商业化交付。


## 10. Current Loop Override - Host Runtime, Admin Team, And Server Binding Closure

- Treat these items as already closed and do not reopen them unless a verification command fails:
  - `bootstrapShellRuntime({ host })` drives default IDE read transport.
  - web and desktop pass explicit distribution-derived host runtime descriptors.
  - `IDEContext` / `ServiceContext` default services are lazy.
  - HTTP transport preserves `apiBaseUrl` path prefixes.
  - representative runtime team catalog reads now flow through the shared typed client on `/api/app/v1/teams`.
  - explicit admin team reads remain available on `/api/admin/v1/teams`.
  - `createDefaultBirdCoderIdeServices()` and shared contexts now expose `teamService`.
  - `bindBirdCoderServerRuntimeTransport()` binds `resolveServerRuntime()` onto the same shared default-service transport contract without pretending the server package has a shell UI entrypoint.
  - `runBirdCoderPostgresqlLiveSmoke()` now standardizes PostgreSQL smoke outcomes as `blocked | passed | failed`.
  - DSN lookup priority is fixed to `BIRDCODER_POSTGRESQL_DSN -> BIRDCODER_DATABASE_URL -> DATABASE_URL -> PGURL`.
- Mandatory verification when touching this area:
  - `pnpm.cmd run test:app-admin-sdk-consumer-contract`
  - `pnpm.cmd run test:shell-runtime-app-client-contract`
  - `pnpm.cmd run test:server-runtime-transport-contract`
  - `pnpm.cmd run test:generated-core-write-client-facade-contract`
  - `pnpm.cmd run test:default-ide-services-generated-core-write-facade-contract`
  - `pnpm.cmd run test:default-ide-services-generated-core-read-facade-contract`
  - `pnpm.cmd run test:default-ide-services-core-read-service-contract`
  - `pnpm.cmd run test:api-backed-project-service-core-create-coding-session-contract`
  - `pnpm.cmd run test:api-backed-project-service-core-create-coding-session-turn-contract`
  - `pnpm.cmd run test:coding-session-projection-app-consumer-contract`
  - `pnpm.cmd run test:coding-server-overview-engine-model-consumer-contract`
  - `pnpm.cmd run test:coding-server-engine-truth-contract`
  - `pnpm.cmd run generate:rust-host-engine-catalog`
  - `pnpm.cmd run test:rust-host-engine-truth-contract`
  - `pnpm.cmd run test:rust-host-engine-route-parity-contract`
  - `pnpm.cmd run test:engine-runtime-adapter`
  - `pnpm.cmd run test:engine-conformance`
  - `pnpm.cmd run test:tool-protocol-contract`
  - `pnpm.cmd run test:engine-resume-recovery-contract`
  - `pnpm.cmd run test:shared-core-facade-governance-contract`
  - `pnpm.cmd run test:generated-app-admin-client-facade-contract`
  - `pnpm.cmd run test:default-ide-services-document-service-contract`
  - `pnpm.cmd run test:document-app-consumer-contract`
  - `pnpm.cmd run test:default-ide-services-audit-service-contract`
  - `pnpm.cmd run test:audit-admin-consumer-contract`
  - `pnpm.cmd run test:default-ide-services-release-service-contract`
  - `node scripts/host-runtime-contract.test.ts`
  - `pnpm.cmd run test:provider-backed-console-contract`
  - `pnpm.cmd run test:postgresql-live-smoke-contract`
  - `pnpm.cmd run test:skill-binding-contract`
  - `pnpm.cmd run test:template-instantiation-contract`
  - `pnpm.cmd run test:prompt-skill-template-runtime-assembly-contract`
  - `pnpm.cmd run test:prompt-skill-template-evidence-repository-contract`
  - `pnpm.cmd run test:prompt-skill-template-evidence-consumer-contract`
  - `pnpm.cmd run test:coding-server-prompt-skill-template-evidence-consumer-contract`
  - `cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml`
  - `pnpm.cmd run typecheck`
  - `pnpm.cmd run docs:build`
- Current next serial closure:
  1. PostgreSQL live smoke is now closed on this host with a real DSN-backed `passed` report via a temporary Docker-backed PostgreSQL 16 runtime on `127.0.0.1:55432`; do not reopen this lane unless a fresh rerun fails
  2. if a future rerun returns `missing_postgresql_dsn` or `missing_postgresql_driver`, keep that state blocked and backwrite the environment regression explicitly
  - if a future rerun returns `failed`, treat the PostgreSQL smoke path as a real executable defect and close it before claiming the environment gate is understood
  3. the Step 18 server-side canonical-runtime sink into `coding-server` / Core projection is now also closed; do not reopen it without a fresh failing contract
  4. if no lower-score unresolved Step is evidenced by current code/tests/docs, stop feature expansion, backwrite the alignment, and define the next Step before writing new production code
  5. the second-stage typed SDK/client generation lane is already closed on top of `packages/sdkwork-birdcoder-types/src/generated/coding-server-openapi.ts`
  6. the shared generated app/admin facade is already closed on top of `packages/sdkwork-birdcoder-types/src/generated/coding-server-client.ts`
  7. default IDE services already consume that shared facade directly for runtime HTTP and in-process fallback composition, and now expose governed release catalogs through `releaseService`
  8. the redundant infrastructure-side app/admin high-level wrapper is already removed; only transport factories remain in infrastructure
  9. the first shared core read facade is already closed for implemented representative core routes only
  10. default IDE services, shared contexts, and `useCodingServerOverview()` now adopt the implemented shared core read facade for overview reads without fabricating local in-process core authority
  11. the shared core projection read facade is already closed for implemented session detail / events / artifacts / checkpoints
  12. `loadCodingSessionProjection()` and `useCodingSessionProjection()` now adopt the implemented core projection read facade into the first app-level coding-session detail consumer boundary
  13. `BIRDCODER_SHARED_CORE_FACADE_OPERATION_IDS` and `BIRDCODER_SHARED_CORE_FACADE_EXCLUDED_OPERATION_IDS` now lock promoted vs blocked core high-level operations into executable governance
  14. the typed shared core write facade plus first consumer adoption for `core.createCodingSessionTurn` is now closed on top of the real Rust route
  15. the shared core read facade plus first overview-consumer adoption for `core.getEngineCapabilities` and `core.listModels` is now closed on top of the real Rust routes
  16. the representative admin audit lane is already closed end-to-end on top of `audit_events` truth and the shared audit service/consumer boundary
  17. the representative app deployment lane is already closed end-to-end on top of `deployment_records` truth and the shared deployment service/consumer boundary
  18. the representative admin deployment governance lane is already closed end-to-end on top of the same `deployment_records` truth and the shared admin deployment service/consumer boundary
  19. the dedicated admin policy governance lane is already closed: `/api/admin/v1/policies` is real, truth converges on `governance_policies`, and high-level policy consumption must stay on `listPolicies()` / `adminPolicyService` / `loadAdminPolicies()` / `useAdminPolicies()`
  20. PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`
  21. the first Step 18 source-mirror-truth slice is already closed through `engine-kernel-contract` plus `engine-source-mirror-contract`
  22. the second Step 18 coding-server-engine-truth slice is already closed through `coding-server-engine-truth-contract`
  23. the third Step 18 Rust-host-engine-truth slice is already closed through `generate-rust-host-engine-catalog` plus `rust-host-engine-truth-contract`
  24. the fourth Step 18 Rust-host-engine-route-parity slice is already closed through `test:rust-host-engine-route-parity-contract`
  25. the fifth Step 18 engine-governance-promotion slice is already closed by promoting `engine-runtime-adapter`, `engine-conformance`, `tool-protocol-contract`, and `engine-resume-recovery-contract` into `check:release-flow`
  26. the sixth Step 18 non-environmental slice is already closed by promoting the same governance quartet into governance regression and quality-matrix score surfaces so loop scoring can see engine-adapter risk directly
  25. the architecture-boundary blocker is already closed by aligning `check-arch-boundaries.mjs` with the active runtime package topology for chat/types, infrastructure/host-core, server shared-contract usage, shell runtime composition, and web runtime identity
  26. the i18n parity blocker is already closed by adding `app.menu.previousThread` and `app.menu.nextThread` to both `en` and `zh`
  27. governance regression now drives the web bundle budget through `pnpm run build`, so missing web `dist` artifacts are no longer treated as a valid blocker
  28. the real web bundle budget regression is now closed without weakening the cap:
    - entry `index-CKw7UVoM.js`: `68.1 KiB`
    - largest JS asset `vendor-markdown-DqZNkVdw.js`: `598.2 KiB`
    - cap: `700.0 KiB`
  29. the Step 07 Studio page-componentization slice is now closed:
    - `StudioPage` only keeps orchestration and execution handlers
    - sidebar chat and project/session switching live in `StudioChatSidebar`
    - find-in-files and quick-open live in `StudioWorkspaceOverlays`
    - the external terminal boundary lives in `StudioTerminalIntegrationPanel`
    - simulator remains on independent `StudioSimulatorPanel`
  30. bundle closure truth is now frozen by:
    - `pnpm.cmd run check:ui-bundle-segmentation`
    - `pnpm.cmd run check:web-react-compat-mode`
    - `pnpm.cmd run check:commons-shell-entry`
    - lightweight `@sdkwork/birdcoder-ui` root exports plus heavy `chat / editors / run-config` subpath exports
    - lightweight `@sdkwork/birdcoder-commons/shell` app-shell boundary
    - Vite `mode` propagation into `createBirdcoderVitePlugins(...)`
  31. the packaged release-evidence governance slice is already closed; if PostgreSQL live smoke stays blocked, re-score and move to the next lowest-score non-environmental slice instead of reopening `qualityEvidence` promotion
  32. the Step 06 Code page-componentization slice is now closed:
    - `CodePage` only keeps project/session/file/run state plus event/service orchestration
    - find-in-files and quick-open live in `CodeWorkspaceOverlays`
    - editor-mode `FileExplorer` / `CodeEditorSurface` / sidebar chat live in `CodeEditorWorkspacePanel`
    - `CodeEditorSurface` owns `CodeEditor` / `DiffEditor` plus diff header and editor empty-state behavior
    - run/debug/task/delete dialogs live in `CodePageDialogs`
    - the external terminal boundary lives in `CodeTerminalIntegrationPanel`
  33. bundle governance for that Code split is now also frozen:
    - `pnpm.cmd run check:code-page-componentization`
    - `pnpm.cmd run check:ui-bundle-segmentation`
    - heavy `editors` and `run-config` imports stay on child components instead of flowing back into `CodePage`
  34. the Step 06 file-system boundary slice is now closed:
    - `LocalFolderMountSource` is the shared folder-open payload across types, infrastructure, commons, and page consumers
    - `IFileSystemService.mountFolder(projectId, folderInfo)` must stay typed and must not fall back to `any`
    - `useFileSystem().mountFolder(projectId, folderInfo)` is the only page-level folder-mount entrypoint for Code and Studio
    - `CodePage` and `StudioPage` must not access `fileSystemService` directly or use `as any` for folder mounts
    - `pnpm.cmd run check:file-system-boundary` is part of lint and release-flow
  35. Step 06 is now fully closed:
    - command, run-entry, and editor-surface governance are all frozen inside lint and release-flow
    - at that checkpoint, the next non-environmental slice had to return to the `09 -> 17` mainline instead of reopening Code page internals; the later Step 17, Step 18, and Step `20` follow-on closures are recorded in `docs/release/release-2026-04-13-04.md`, `docs/release/release-2026-04-13-05.md`, and `docs/release/release-2026-04-13-08.md`
  36. the first Step 16 Prompt / SkillHub / AppTemplate standards slice is now closed:
    - `@sdkwork/birdcoder-types` freezes `platform_rule -> organization_rule -> template_preset -> skill_binding -> project_context -> turn_prompt`
    - `workspace / project / coding_session / turn` are the only valid skill binding scopes
    - `web / desktop / server / fullstack / plugin / agent-tooling` are the only valid app template target profiles
    - `prompt_* / skill_* / app_template_*` storage bindings are now explicit typed contracts instead of documentation-only concepts
    - `pnpm.cmd run test:skill-binding-contract` and `pnpm.cmd run test:template-instantiation-contract` are part of lint, release-flow, and governance regression
  37. the second Step 16 runtime-assembly slice is now closed:
    - `packages/sdkwork-birdcoder-core/src/promptSkillTemplateRuntime.ts` owns the kernel-side runtime assembly boundary for Prompt / Skill / Template composition
    - `assembleBirdCoderPromptRuntime()` freezes six-layer prompt composition without engine-order drift
    - `assembleBirdCoderSkillRuntime()` freezes `installation -> binding -> runtime_config` skill resolution
    - `instantiateBirdCoderAppTemplateRuntime()` freezes `preset -> target_profile -> instantiation` template resolution
    - `pnpm.cmd run test:prompt-skill-template-runtime-assembly-contract` is part of lint, release-flow, and governance regression
    - `CP16-2` is frozen; do not reopen runtime assembly while closing the remaining Step 16 persistence consumers
  38. the first Step 16 evidence-persistence slice is now closed:
    - `packages/sdkwork-birdcoder-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts` owns the shared provider and UnitOfWork repository boundary for `prompt_run`, `prompt_evaluation`, and `app_template_instantiation`
    - `scripts/prompt-skill-template-evidence-repository-contract.test.ts` proves commit and rollback visibility across the shared provider/UoW path instead of sidecar storage
    - `pnpm.cmd run test:prompt-skill-template-evidence-repository-contract` is part of lint, release-flow, and governance regression
  39. the second Step 16 evidence-consumer slice is now closed:
    - `ProviderBackedProjectService` now persists project and message evidence through the shared repositories for `app_template_instantiation`, `prompt_run`, and `prompt_evaluation`
    - `createDefaultBirdCoderIdeServices()` now injects those repositories on the same shared provider boundary instead of sidecar-only state
    - `scripts/prompt-skill-template-evidence-consumer-contract.test.ts` proves the default IDE project flow writes evidence on that shared path
    - `pnpm.cmd run test:prompt-skill-template-evidence-consumer-contract` is part of lint, release-flow, and governance regression
  40. the third Step 16 evidence-consumer slice is now closed:
    - `packages/sdkwork-birdcoder-server/src/projectionRepository.ts` now persists `prompt_run` and `prompt_evaluation` inside the same provider/UoW transaction used by coding-session projection persistence.
    - `scripts/coding-server-prompt-skill-template-evidence-consumer-contract.test.ts` proves coding-server projection consumers no longer bypass shared evidence repositories.
    - `pnpm.cmd run test:coding-server-prompt-skill-template-evidence-consumer-contract` is part of lint, release-flow, and governance regression.
    - Step 16 `CP16-3` is now fully closed; if PostgreSQL live smoke remains blocked, move to the next lowest-score non-environmental slice on the `09 -> 17` mainline.
  41. PostgreSQL live-smoke preflight governance promotion is now closed:
    - `pnpm.cmd run test:postgresql-live-smoke-contract` is part of lint, `check:release-flow`, and governance regression aggregation.
    - `scripts/release-flow-contract.test.mjs` and `scripts/governance-regression-report.test.mjs` now freeze that promotion as executable governance truth.
    - governance regression baseline is now `88` checks.
    - this closes non-environmental governance hardening only; at that checkpoint, DSN-backed `pnpm.cmd run release:smoke:postgresql-live` was still the sole Step 17 environment gate, and the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
  42. multilingual governance-doc count drift guard is now closed:
    - `scripts/live-docs-governance-baseline.test.mjs` now validates Chinese `N 项(既有)(合同)检查` count mentions against the executable governance baseline.
    - architecture docs `10 / 12 / 14` are realigned to the current `88`-check truth.
    - this closes docs-drift guarding only; at that checkpoint, DSN-backed PostgreSQL runtime smoke was still the active environment gate, and the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
  43. release quality loop-scoreboard evidence is now closed:
    - `scripts/release/quality-gate-release-evidence.mjs` now materializes `qualityEvidence.loopScoreboard` with deterministic `architecture_alignment / implementation_completeness / test_closure / commercial_readiness` plus `lowest_score_item` and `next_focus`.
    - `scripts/release/finalize-release-assets.test.mjs`, `scripts/release/smoke-finalized-release-assets.test.mjs`, and `scripts/release/render-release-notes.test.mjs` now freeze that loop-scoreboard summary across finalized manifest, finalized smoke, and rendered release notes.
    - this closes non-environmental loop-scoring determinism only; at that checkpoint, DSN-backed PostgreSQL runtime smoke was still the active environment gate, and the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
  44. quality loop-scoreboard governance promotion is now closed:
    - `check:quality-loop-scoreboard` now runs `node scripts/quality-loop-scoreboard-contract.test.mjs` as a first-class command.
    - `lint`, `check:release-flow`, and `scripts/governance-regression-report.mjs` now all include the same loop-scoreboard governance contract.
    - governance regression baseline is now frozen at `88` checks across code, tests, and docs.
    - this closes non-environmental governance promotion only; at that checkpoint, DSN-backed PostgreSQL runtime smoke was still the active environment gate, and the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
  45. PostgreSQL blocked-state recovery guidance contract is now closed:
    - `runBirdCoderPostgresqlLiveSmoke()` now emits actionable blocked-state recovery fields: `dsnEnvPriority`, `rerunCommand`, and `resolutionHint`.
    - `scripts/postgresql-live-smoke-contract.test.ts` now freezes those fields for both `missing_postgresql_dsn` and `missing_postgresql_driver`.
    - this closes non-environmental commercial-readiness guidance hardening only; at that checkpoint, DSN-backed PostgreSQL runtime smoke was still the active environment gate, and the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
  46. PostgreSQL blocked-state resolution-steps contract is now closed:
    - `runBirdCoderPostgresqlLiveSmoke()` now emits deterministic `resolutionSteps` arrays for `missing_postgresql_dsn` and `missing_postgresql_driver`.
    - blocked reports now contain machine-readable step sequencing instead of relying on free-text `resolutionHint` only.
    - `scripts/postgresql-live-smoke-contract.test.ts` now freezes `resolutionSteps` for both blocked reason codes.
    - this closes non-environmental blocked-flow operability only; at that checkpoint, DSN-backed PostgreSQL runtime smoke was still the active environment gate, and the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
  47. PostgreSQL DSN environment-status audit contract is now closed:
    - `runBirdCoderPostgresqlLiveSmoke()` now emits deterministic `dsnEnvStatus` across the DSN priority chain with `missing | empty | configured` states.
    - blocked reports now distinguish absent environment keys from whitespace-only misconfiguration without shell-side inspection.
    - `scripts/postgresql-live-smoke-contract.test.ts` now freezes `dsnEnvStatus` for `missing_postgresql_dsn`, `missing_postgresql_driver`, and whitespace DSN inputs.
    - this closes non-environmental DSN-audit operability only; at that checkpoint, DSN-backed PostgreSQL runtime smoke was still the active environment gate, and the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
  48. PostgreSQL DSN copy-paste remediation example contract is now closed:
    - `runBirdCoderPostgresqlLiveSmoke()` now emits `dsnExample` and `dsnPowerShellSetExample` for `missing_postgresql_dsn`.
    - blocked reports now provide deterministic DSN sample format plus direct PowerShell env-set example without requiring extra docs lookup.
    - `scripts/postgresql-live-smoke-contract.test.ts` now freezes these example fields for missing and empty DSN blocked paths.
    - this closes non-environmental operator-guidance hardening only; at that checkpoint, DSN-backed PostgreSQL runtime smoke was still the active environment gate, and the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
49. PostgreSQL cmd.exe remediation command contract is now closed:
  - `runBirdCoderPostgresqlLiveSmoke()` now emits deterministic `dsnCmdSetExample` for `missing_postgresql_dsn`.
  - blocked reports now provide direct Windows cmd.exe env-set guidance alongside PowerShell guidance.
  - `scripts/postgresql-live-smoke-contract.test.ts` now freezes `dsnCmdSetExample` for missing and empty DSN blocked paths.
  - this closes non-environmental Windows-operator guidance hardening only; at that checkpoint, DSN-backed PostgreSQL runtime smoke was still the active environment gate, and the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`.
50. The Step 12 runtime quality execution-truth slice is now closed:
  - `scripts/quality-gate-execution-report.mjs` must propagate Windows `pnpm.cmd` child exit codes through the PowerShell wrapper instead of fabricating `passed` tiers
  - `scripts/quality-gate-execution-report.test.mjs` now freezes a non-zero fake `pnpm.cmd` result as `failed`
  - root `lint` must run workspace and web TypeScript validation through direct `pnpm exec tsc --noEmit` and `pnpm --filter @sdkwork/birdcoder-web exec tsc --noEmit` entrypoints, so fast-gate evidence reaches the next real blocker instead of stopping on nested wrapper drift
  - this closes the Step 12 runtime quality execution-truth slice only; at that checkpoint, the next non-environmental serial slice was the remaining nested `pnpm run` lane inside `check:release-flow`, and the later closure is recorded in `docs/release/release-2026-04-13-02.md`
51. The remaining Windows nested-wrapper quality-execution slice is now also closed:
  - `check:desktop` and `check:server` now execute their concrete TypeScript and Rust commands directly instead of nesting through `pnpm run`
  - `check:quality:standard` now runs direct desktop, server, shared-SDK, web-host build, bundle-budget, server-build, and docs-build commands, so the standard tier no longer depends on Windows-fragile wrappers
  - `check:release-flow` now executes its nested contract lanes directly, so `check:quality:fast` no longer stops on wrapper drift before the real release-governance assertions
  - `check:quality:release` keeps the declared `fast -> standard -> matrix -> release-flow -> ci-flow -> governance` topology; only the fragile nested implementations underneath were flattened
  - the governed root `build` and `build:prod` commands now call `pnpm --dir packages/sdkwork-birdcoder-web exec node ../../scripts/run-vite-host.mjs build --mode production` instead of recursively re-entering `@sdkwork/birdcoder-web` through `pnpm --filter ... build`
  - `scripts/governance-regression-report.mjs` now strips parent `pnpm run` lifecycle metadata before command-backed checks, so the final governance tier can reuse `pnpm run build` without inheriting outer release-script context
  - `scripts/quality-gate-execution-report.mjs` now records `status: passed` with `passedCount: 3`, `failedCount: 0`, and `blockedCount: 0` in `artifacts/quality/quality-gate-execution-report.json`
  - this closes the remaining non-environmental Step 12 Windows quality blocker only; at that checkpoint, the lowest-score item had returned to DSN-backed PostgreSQL live smoke, which still had to stay explicitly `blocked` when DSN/driver were missing and explicitly `failed` when DSN-backed runtime connectivity was broken. The later failure-path closure is recorded in `docs/release/release-2026-04-13-03.md`, and the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`
52. The PostgreSQL DSN-backed failure-path cleanup slice is now also closed:
  - repo dependency governance now includes the runtime `pg` driver through the workspace catalog so DSN-backed smoke can execute on this host
  - `BirdCoderPostgresqlClientSqlExecutor.close()` now tolerates rejected connection-open promises instead of overwriting the smoke report path during provider cleanup
  - transactional connection bootstrap now closes partially opened PostgreSQL connections before rethrowing setup errors
  - `scripts/postgresql-live-smoke-contract.test.ts` now freezes DSN-configured `ECONNREFUSED` as structured `status: failed`
  - `pnpm.cmd run release:smoke:postgresql-live` now returns auditable `failed` JSON for DSN-backed connection refusal instead of crashing with an uncaught exception
  - this closes non-environmental PostgreSQL failure-path operability only; at that checkpoint, a real commercial-readiness closure still required a DSN-backed `passed` report from an available PostgreSQL backend, and the later host-pass closure is recorded in `docs/release/release-2026-04-13-04.md`
53. The PostgreSQL DSN-backed commercial-readiness gate is now also closed on this host:
  - `com.docker.service` plus Docker Desktop now provide a working local container runtime on the current Windows machine
  - a temporary `postgres:16-alpine` container published on `127.0.0.1:55432` produced a real `pnpm.cmd run release:smoke:postgresql-live` result of `status: passed`
  - the passed report included `migrations`, `preflight-clean`, `transaction-write-visible`, `transaction-isolation`, and `rollback-clean`
  - at that checkpoint, PostgreSQL environment availability had stopped being the active blocker on this host; later loops selected fresh lowest-score items, including the Step 18 closure recorded in `docs/release/release-2026-04-13-05.md` and the Step `20` closure recorded in `docs/release/release-2026-04-13-08.md`
54. The Step 18 server-side canonical-runtime projection sink is now also closed:
  - `executeBirdCoderCoreSessionRun()` now demonstrably consumes shared `describeRuntime()` plus `sendCanonicalEvents()` as the only valid server-side engine projection boundary
  - `streamBirdCoderCoreSessionEventEnvelopes()` now preserves canonical event flow through Core SSE envelopes
  - provider-backed projection persistence now demonstrably round-trips `nativeRef.transportKind`, `nativeSessionId`, `capabilitySnapshot`, canonical event kinds, and canonical artifact kinds
  - architecture and Step docs no longer describe this `coding-server` / Core projection sink as an open gap
  - the next loop must not reopen this lane without a fresh failing contract or a newly defined Step
55. Step `20` is now fully closed for the remaining `runtime-data-kernel-v2` authority entities:
  - `team_member` and `deployment_target` are both closed on shared repository, real route, shared facade, first consumer, and Rust host authority truth
  - future loops must not reopen Step `20` unless fresh failing evidence appears on those already-closed lanes
56. The first Step 20 `team_member` authority slice remains closed:
  - `packages/sdkwork-birdcoder-types/src/server-api.ts` exposes `listTeamMembers(teamId)` on the shared generated app/admin facade
  - `/api/admin/v1/teams/:teamId/members` is real across shared TS route contracts, generated client requests, in-process transport, and Rust host demo/sqlite authorities
  - `packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts` and `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts` now materialize `team_members` on the shared provider/UoW repository boundary
57. The second Step 20 `deployment_target` authority slice is now also closed:
  - `packages/sdkwork-birdcoder-types/src/server-api.ts` exposes `listDeploymentTargets(projectId)` on the shared generated app/admin facade
  - `/api/admin/v1/projects/:projectId/deployment-targets` is real across shared TS route contracts, generated client requests, in-process transport, and Rust host demo/sqlite authorities
  - `packages/sdkwork-birdcoder-infrastructure/src/storage/appConsoleRepository.ts` and `packages/sdkwork-birdcoder-infrastructure/src/services/appAdminConsoleQueries.ts` now materialize `deployment_targets` on the shared provider/UoW repository boundary
  - the next autonomous loop must select a new lowest-score Step from fresh evidence instead of continuing Step `20`
58. The remaining release-tier contract-tail drift is now also closed:
  - `scripts/ci-flow-contract.test.mjs` and `scripts/quality-gate-matrix-contract.test.mjs` now freeze the same direct web-host `check:quality:standard` chain already used by `build`, `build:prod`, `check:quality:standard`, and governance regression
  - the 2026-04-13 direct-runner evidence returned `101/101` passed checks with `failedCheckIds: []`
  - the 2026-04-13 direct-runner quality execution evidence returned `status: passed`, `passedCount: 3`, `failedCount: 0`, `blockedCount: 0`, and `lastExecutedTierId: release`
  - the declared `fast -> standard -> matrix -> release-flow -> ci-flow -> governance` topology remains unchanged; only the last stale contract expectations were realigned to the already-governed command truth
59. The Step 17 live-docs truth-drift closure is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now freezes that Step 17 and architecture docs must not preserve already-closed OpenAPI/codegen, shared-facade, representative-placeholder-route, or PostgreSQL-blocker language
  - `docs/step/17-Coding-Server-Core-App-Admin-API与控制台实现.md` and `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md` now backwrite the final Step 17 truth: representative placeholder routes are `none`, Step 17 has no remaining non-environmental representative-route gap, and PostgreSQL live smoke already has a recorded DSN-backed `passed` report on this host
  - future loops must not reopen Step 17 doc drift without fresh failing evidence from the live docs contract or a fresh PostgreSQL rerun regression
60. The PostgreSQL host-pass live-docs alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now freezes the current host-pass truth across architecture `09/10` and step `12/13/17D/17E-17ZB/18A-18G/19/19A` live docs and rejects stale current-state phrases such as `active environment gate`, `remains environment-gated`, `remains an independent environment gate`, or `blocked until first passed`
  - those live docs now backwrite one current truth: PostgreSQL live smoke already has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`
  - historical blocked checkpoints may remain only as checkpoint-local history explicitly superseded by `docs/release/release-2026-04-13-04.md`
  - future loops must not reopen PostgreSQL blocked-state docs drift without fresh failing evidence from the live docs contract or a fresh PostgreSQL rerun regression
61. The workspace quality-matrix evidence freshness closure is now also closed:
  - `scripts/quality-gate-matrix-contract.test.mjs` now rejects a stale workspace `artifacts/quality/quality-gate-matrix-report.json` whenever that file no longer matches the current stable generated quality-tier or workflow truth
  - `pnpm quality:report` regenerated the active workspace artifact so Step 12 quality evidence now records the governed direct web-host standard-tier build chain instead of the stale nested web build path
  - that freshness comparison ignores host-specific `environmentDiagnostics` drift when the same stable tier/workflow truth still holds
  - Step 12, architecture, and command docs now treat `pnpm quality:report` as the required refresh path after `check:quality-matrix` reports stale workspace evidence
  - future loops must not treat the workspace quality-matrix artifact as live evidence unless it still matches current generated output
62. The desktop startup-graph port-resilience closure is now also closed:
  - `scripts/desktop-startup-graph-contract.test.mjs` now traverses the desktop Vite startup graph on a dynamically allocated loopback port instead of hard-coding `127.0.0.1:1537`
  - `scripts/desktop-startup-graph-port-resilience.test.mjs` now occupies the legacy `1537` port and proves the startup-graph contract still passes by selecting another free port
  - `check:desktop-startup-graph` now runs both the baseline traversal and the resilience regression, so `check:quality:fast` and `pnpm quality:execution-report` no longer fabricate a Step 12 fast-tier failure when another local verification process already holds the old fixed port
  - future loops must not treat a legacy `1537` port collision as a real repo regression unless the new resilience contract also fails
63. The stale Step 16 and Step 18 next-target docs alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now freezes that Step 16 current-status docs must not keep `CP16-3` as the next serial target and architecture `19` must not keep the first persistence slice as an active remaining gap after the later consumer closures
  - the same live-docs contract now freezes that Step 18D and architecture `25` must not keep route-parity governance promotion as the next active target after that later promotion lane has already closed
  - `docs/step/16-Prompt-SkillHub-AppTemplate-项目模板体系.md`, `docs/step/18D-Rust-Host-Engine-Route-Parity-Lane.md`, `docs/架构/19-统一会话运行时-Prompt-SkillHub-AppTemplate标准.md`, and `docs/架构/25-Rust-Host-Engine-Route-Parity-Standard.md` now backwrite those lanes as historical closed slices instead of current next-step truth
  - future loops must not reopen these Step 16 or Step 18 docs as active next targets unless fresh failing evidence appears on the corresponding closed lanes
64. The architecture 09 coding-server maturity summary alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects the stale Architecture 09 summary that still described Rust host as a minimal `/health` placeholder and Step 17/18 route or OpenAPI landing as future work
  - `docs/架构/09-安装-部署-发布标准.md` now records the current truth: representative `core / app / admin` routes, canonical OpenAPI export and release evidence, and PostgreSQL host-pass truth are already closed on this host; representative placeholder routes are `none`
  - `docs/step/09-server-runtime-openapi-桌面-服务双模落地.md` now backwrites that later closure as a historical Step 09 outcome instead of leaving Architecture 09 free to regress to the earlier placeholder summary
  - future loops must not reopen the Architecture 09 maturity summary unless fresh failing evidence appears on the same coding-server route, OpenAPI, or PostgreSQL host-pass closures
65. The architecture README coding-server maturity summary alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects the stale architecture README summary that still described Rust host as a minimal host skeleton and `core / app / admin` implementation as future work
  - `docs/架构/README.md` now records the current truth: representative `core / app / admin` routes, canonical OpenAPI release evidence, representative placeholder routes `none`, and PostgreSQL host-pass truth are already closed on this host
  - `docs/step/09-server-runtime-openapi-桌面-服务双模落地.md` now backwrites that the top-level architecture README must stay aligned with the same Step 09 maturity closure
  - future loops must not reopen the architecture README maturity summary unless fresh failing evidence appears on the same coding-server route, OpenAPI, or PostgreSQL host-pass closures
66. The architecture 11 industry-position maturity summary alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects the stale Architecture 11 summary that still described `coding-server` as a minimal host skeleton and the multi-engine adapter/tool/server lane as not yet landed
  - `docs/架构/11-行业对标与能力矩阵.md` now records the current truth: representative `core / app / admin` routes, canonical OpenAPI release evidence, and multi-engine canonical runtime are already closed; Step 18 only reopens on new engine onboarding or fresh failing evidence
  - `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md` now backwrites that active industry-comparison docs must not regress to the earlier minimal-host or open-mainline summary
  - future loops must not reopen the Architecture 11 maturity summary unless fresh failing evidence appears on the same coding-server or Step 18 closures
67. The architecture 22 and 23 Step 18 next-target alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects the stale Architecture 22 summary that still treated shared engine descriptor / model-catalog promotion into `coding-server` as the next target after Step 18B had already closed
  - the same live-docs contract now rejects the stale Architecture 23 next target that still treated the later Rust host artifact-adoption and route-parity lanes as active work after Steps 18C and 18D had already closed
  - `docs/架构/22-多Code-Engine源码镜像真相补充标准.md`, `docs/架构/23-Coding-Server-Engine-Truth-Promotion-Standard.md`, and `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md` now backwrite those lanes as historical closed follow-ons instead of current next-target truth
  - future loops must not reopen Architecture 22 or 23 as active Step 18 next targets unless fresh failing evidence appears on the same mirror-truth, promoted engine-truth, or Rust parity closures
68. The architecture 24 Step 18 next-target alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects the stale Architecture 24 next target that still treated the later HTTP-level Rust route-parity lane as active work after Step 18D had already closed
  - `docs/架构/24-Rust-Host-Engine-Truth-Artifact-Standard.md` now records that the route-parity lane is already a closed historical follow-on instead of a current next target
  - `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md` now backwrites that active Rust artifact/parity architecture docs must not regress to the earlier Step 18C/18D next-target summary
  - future loops must not reopen Architecture 24 as an active Step 18 next target unless fresh failing evidence appears on the generated Rust engine artifact or route-parity closures
69. The architecture 26 Step 18 next-target alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects the stale Architecture 26 next target that still treated governance-regression and quality-matrix promotion as active work after Step 18F had already closed
  - `docs/架构/26-Step-18-Engine-Governance-Release-Flow-Standard.md` now records that the later score-surface lane is already a closed historical follow-on instead of a current next target
  - `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md` now backwrites that active Step 18 governance architecture docs must not regress to the earlier Step 18E/18F next-target summary
  - future loops must not reopen Architecture 26 as an active Step 18 next target unless fresh failing evidence appears on the release-flow-governed Step 18 quartet or its score-surface closures
70. The architecture 27 and 28 PostgreSQL-recheck next-target alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects the stale Architecture 27 and 28 next-target wording that still treated `after PostgreSQL live-smoke recheck` as the active serial prerequisite after PostgreSQL host-pass had already been recorded on this host
  - `docs/架构/27-Step-18-Engine-Governance-Score-Surface-Standard.md` and `docs/架构/28-Governance-Regression-Deterministic-Baseline-Standard.md` now record that PostgreSQL live smoke already has a DSN-backed `passed` report on this host, so future loops must move to the next lowest-score non-environmental slice instead of reopening Step 18 score-surface or packaged-evidence work
  - `docs/step/18-多Code-Engine-Adapter-统一工具协议闭环.md` and `docs/step/19-Governance-Regression-Deterministic-Baseline-Lane.md` now backwrite that active score-surface and deterministic-baseline docs must not regress to the earlier PostgreSQL-recheck next-target summary
  - future loops must not reopen Architecture 27 or 28 as active PostgreSQL-recheck next targets unless fresh failing evidence appears on PostgreSQL host-pass truth or the already-closed score-surface / packaged-evidence lanes
71. The architecture 29 packaged-evidence follow-on alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects the stale Architecture 29 next-target wording that still treated carrying engine-governance context into packaged evidence as the current `Web Bundle` follow-on after Step 18G had already closed
  - `docs/架构/29-Web-Bundle-Segmentation-And-Production-Build-Standard.md` now records that the packaged release-evidence handoff is already a closed historical follow-on, so future loops must move to the next lowest-score non-environmental slice instead of reopening bundle-boundary work unless fresh failing evidence appears on the governed bundle boundary or finalized `qualityEvidence` handoff itself
  - `docs/step/19A-Web-Bundle-Segmentation-And-Production-Build-Lane.md` now backwrites that active Architecture 29 docs must not regress to the earlier packaged-evidence next-target summary
  - future loops must not reopen Architecture 29 as an active packaged-evidence next target unless fresh failing evidence appears on the governed bundle boundary or finalized `qualityEvidence` handoff itself
72. The prompt and Step 12 PostgreSQL gate-history alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects the stale Step 12 wording that still treated DSN-backed `release:smoke:postgresql-live` as the current sole Step 17 environment gate after PostgreSQL host-pass had already been recorded on this host
  - `scripts/prompt-governance-contract.test.mjs` now rejects stale active-controller wording that restates PostgreSQL as the current sole Step 17 gate or current active environment gate inside `docs/prompts/反复执行Step指令.md`
  - `docs/step/12-测试矩阵-质量门禁-回归自动化.md` and `docs/prompts/反复执行Step指令.md` now keep those earlier PostgreSQL blocked-state notes only as checkpoint-local history explicitly superseded by `docs/release/release-2026-04-13-04.md`
  - future loops must not reopen Step 12 or the prompt controller as active PostgreSQL gate blockers unless fresh failing evidence appears on PostgreSQL host-pass truth itself
73. The prompt controller Step 12 follow-on and PostgreSQL host-pass alignment is now also closed:
  - `scripts/prompt-governance-contract.test.mjs` now rejects stale active-controller wording that still treats PostgreSQL host-pass as unmet, still treats the Step 12 `check:release-flow` nested-wrapper follow-on as current, or still treats PostgreSQL environment availability as the current lowest-score blocker after later prompt closures were already recorded
  - `docs/prompts/反复执行Step指令.md` now keeps those Step 12 and PostgreSQL checkpoint notes only as checkpoint-local history explicitly superseded by `docs/release/release-2026-04-13-02.md`, `docs/release/release-2026-04-13-03.md`, `docs/release/release-2026-04-13-04.md`, `docs/release/release-2026-04-13-05.md`, and `docs/release/release-2026-04-13-08.md`
  - future loops must not reopen the prompt controller as if Step 12 nested-wrapper follow-ons or PostgreSQL environment availability were still current blockers unless fresh failing evidence appears on those already-closed lanes
74. The architecture 09 and 20 engine-model next-target alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects stale active Architecture 09 and 20 wording that still treats real `engineCapabilities` / `models` server truth as the current next serial slice after that lane had already closed in `docs/release/release-2026-04-11-12.md`
  - `docs/架构/09-安装-部署-发布标准.md` and `docs/架构/20-统一Rust-Coding-Server-API-协议标准.md` now keep those engine/model next-target notes only as checkpoint-local history explicitly superseded by `docs/release/release-2026-04-11-12.md`
  - future loops must not reopen Architecture 09 or 20 as if the engine/model lane were still the current next serial slice unless fresh failing evidence appears on the already-closed engine/model route and shared-facade adoption lane
75. The Step 13 nested-wrapper runtime-blocker history alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects stale Step 13 wording that still treats the `check:release-flow` nested `pnpm run` lane as the current runtime blocker after that lane had already closed in `docs/release/release-2026-04-13-02.md`
  - `docs/step/13-发布就绪-github-flow-灰度回滚闭环.md` now keeps that nested-wrapper blocker note only as checkpoint-local history explicitly superseded by `docs/release/release-2026-04-13-02.md`
  - future loops must not reopen Step 13 as if the nested-wrapper lane were still the current runtime blocker unless fresh failing evidence appears on the already-closed quality execution path
76. The Step 06 and architecture 03 mainline-return history alignment is now also closed:
  - `scripts/live-docs-governance-baseline.test.mjs` now rejects stale active Step 06 and Architecture 03 wording that still treats “return to the `09 -> 17` mainline” as the current next serial closure after the later Step 17, Step 18, and Step `20` follow-on closures had already been recorded
  - `scripts/prompt-governance-contract.test.mjs` now rejects stale active-controller wording that still treats “return to the `09 -> 17` mainline” as the current next non-environmental slice inside `docs/prompts/反复执行Step指令.md`
  - `docs/step/06-code视图-编辑器-文件系统重构.md`, `docs/架构/03-模块规划与边界.md`, and `docs/prompts/反复执行Step指令.md` now keep that mainline-return note only as checkpoint-local history explicitly superseded by `docs/release/release-2026-04-13-04.md`, `docs/release/release-2026-04-13-05.md`, and `docs/release/release-2026-04-13-08.md`
  - future loops must not reopen Step 06, Architecture 03, or the prompt controller as if the `09 -> 17` mainline return were still the current next serial closure unless fresh failing evidence appears on those already-closed follow-on lanes
77. The Step 19 governed Vite-host blocker classification is now also closed:
  - `scripts/governance-regression-report.test.mjs` now freezes that command-backed `[vite:define] spawn EPERM` outcomes must be reported as `blocked` `toolchain-platform` diagnostics instead of ordinary failed repository regressions
  - `scripts/governance-regression-report.mjs` now emits `blockedCheckIds`, `blockingDiagnosticIds`, and `environmentDiagnostics`, so the current host can preserve `vite-host-build-preflight` without weakening the real `pnpm.cmd run build` bundle truth
  - current host evidence on `2026-04-15` records `status: blocked`, `passedCount: 100`, `blockedCount: 1`, `failedCount: 0`, `blockedCheckIds: ["web-bundle-budget"]`, and `blockingDiagnosticIds: ["vite-host-build-preflight"]`, while direct `pnpm.cmd run build` still passes under the governed bundle cap
  - future loops must not rewrite repository truth or weaken the web budget when governance regression is blocked only by the current governed Vite-host path; rerun the declared command path after the missing host capability is restored
78. The current-host quality execution blocker state is now also explicitly preserved:
  - fresh `node scripts/quality-gate-execution-report.mjs` evidence on `2026-04-15` returns `status: blocked`, `passedCount: 0`, `blockedCount: 1`, `failedCount: 0`, `lastExecutedTierId: fast`, and `blockingDiagnosticIds: ["vite-host-build-preflight"]`
  - downstream `standard` and `release` tiers remain explicit `skipped` truth inside that runtime execution report while the affected Vite-backed gate hits `[vite:define] spawn EPERM`; future loops must not rewrite repository code to hide this host-only blocker
  - Step 12 and architecture docs must keep that state auditable as a current host blocker until a fresh rerun clears it
79. The current-host direct quality-tier rerun split truth is now also explicitly preserved:
  - fresh direct outer-shell reruns on `2026-04-15` confirm `pnpm.cmd run build` passes on this host, while `pnpm.cmd check:quality:fast` fails at `check:web-vite-build` with `[vite:define] spawn EPERM`
  - fresh direct `pnpm.cmd check:quality:release` evidence on `2026-04-15` fails for the same reason because `fast` stops first
  - future loops must not misdescribe the direct tier contents as fully green or fully broken on this host; the remaining executable release blocker is the governed Vite-host boundary inside `quality-gate-execution-report.mjs` and `governance-regression-report.mjs`, even though a direct `pnpm.cmd run build` still passes
