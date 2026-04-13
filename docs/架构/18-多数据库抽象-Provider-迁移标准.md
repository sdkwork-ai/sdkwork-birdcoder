# 18-多数据库抽象-Provider-迁移标准

## 1. 目标

BirdCoder 数据内核必须统一支撑 `sqlite`、`postgresql`，并为未来扩展 `mysql / libsql / cockroachdb` 预留稳定 SPI。统一目标是：逻辑模型不变、Repository 契约不变、Provider 可替换、迁移可审计、桌面与服务端行为一致。

## 2. 权威存储模式

- `standalone-desktop`：`sqlite` 为权威存储，适用于本地 IDE 与离线优先。
- `server-collaboration`：`postgresql` 为权威存储，适用于团队协作、发布治理、集中审计。
- `hybrid-edge`：`postgresql` 为权威源，`sqlite` 为本地缓存与断点恢复层。
- `localStorage`：仅浏览器轻量缓存，不属于权威 Provider，不参与正式迁移链。

## 3. 分层标准

统一链路固定为：

`Domain Model -> Repository -> UnitOfWork -> StorageProvider -> Dialect -> SchemaMigration -> BlobStore`

规则：

- 领域模型定义“存什么”和“怎么关联”。
- Provider 定义“怎么落表”和“怎么事务化”。
- BlobStore 定义“超大文本、补丁包、证据包放哪里”。
- 页面与 Hooks 只消费 Repository，不直接感知 Provider。

## 4. 数据落点标准

| 数据类别 | SQLite | PostgreSQL | Blob/FileStore | 规则 |
| --- | --- | --- | --- | --- |
| `workspace/project/preferences` | 可作为权威 | 可作为权威 | 否 | 由宿主模式决定 |
| `coding_session_*` 元数据 | 可作为权威 | 可作为权威 | 否 | 同一逻辑 schema，方言各自适配 |
| 原始事件、大日志、Diff 归档 | 索引 + 小对象 | 索引 + 小对象 | 是 | 超大内容只保存引用 |
| `prompt/skill/template` 目录与绑定 | 可缓存/可权威 | 可缓存/可权威 | 包归档可落文件 | 版本化且可回放 |
| 审计、发布、质量证据 | 本地缓存可选 | 推荐权威 | 是 | Server/Release 优先走集中存储 |

## 5. 当前基线与下一步冻结

- 当前已冻结 `coding_session_*`、`engine_registry`、`model_catalog`、`workbench_preference`、`run_configuration`、`terminal_session`、`terminal_execution` 等核心 runtime/workbench 实体。
- `coding-server-kernel-v2` 现已把以下实体冻结到共享迁移与 provider truth：
  - `prompt_*`
  - `skill_*`
  - `app_template_*`
  - `team`
  - `team_member`
  - `project_document`
  - `deployment_record`
  - `release_record`
  - `governance_policy`
- `team_member` 与 `deployment_target` 现已同时闭环到共享 provider 或 UoW 仓储、共享生成 facade、in-process transport、以及 Rust host demo/sqlite authority。
- `deployment_target` 现已物化到 `deployment_targets` provider table，并通过 shared repository/query、`/api/admin/v1/projects/:projectId/deployment-targets`、以及 provider/demo/sqlite host route 统一读取。
- Step `20` 已完成，后续循环不得重新扩张已经完成的 Prompt、Template、Document、Deployment Record、Release Record、team_member 或 deployment_target 车道，除非出现新的失败证据。
- `auth / user / vip` 继续由 `appbase` 维护主模型和主迁移，BirdCoder 只维护扩展表与投影表。

## 6. Provider 标准

| Provider | 定位 | 关键约束 |
| --- | --- | --- |
| `sqlite` | 桌面、本地优先、单机场景 | 占位符 `?1`；`json -> TEXT`；`timestamp -> TEXT/INTEGER` |
| `postgresql` | Server、协作、治理、发布场景 | 占位符 `$1`；`json -> JSONB`；`timestamp -> TIMESTAMPTZ` |
| `mysql/libsql/cockroachdb` | 未来扩展 Provider | 不改领域契约，只新增 `Dialect + Provider + Migration` |

当前仓库闭环：

- `sqlPlans.ts` 已统一 `sqlite/postgresql` 的迁移、列表、计数、按 ID 查询、upsert、delete、clear 计划。
- `sqlExecutor.ts` 已统一 Provider 迁移执行、通用表仓储执行、UoW 可见性。
- `sqlBackendExecutors.ts` 已落地真实 `sqlite` 文件执行器，并提供带 `BEGIN / COMMIT / ROLLBACK` 语义的 `postgresql` 客户端执行器边界。
- `runMigrations()` 现在会在执行器路径下自动引导 `runtime-data-kernel-v1`，确保 `schema_migration_history` 在独立执行 `coding-server-kernel-v2` 时也先被创建。
- 共享实体定义已补齐代表性运行时与 app/admin 空字段的 `nullable` 标记，避免真实 SQLite schema 与 Rust authority 语义漂移。
- `appConsoleRepository.ts` 已把 `workspace / project / team / release_record` 收敛到同一套共享表仓储；默认 IDE workspace/project 服务也已改为消费这套仓储，而不是再把目录真相停留在默认内存 mock。
- `packages/sdkwork-birdcoder-types/src/server-api.ts` 现已冻结 `BIRDCODER_CODING_SERVER_API_VERSION`、`BirdCoderApiTransport`、`BirdCoderAppAdminApiClient` 与带 `createdAt / updatedAt` 的 `project` summary；`appAdminApiClient.ts` 与 API-backed workspace/project service 让默认 IDE 目录读链路先经过统一 client/transport，再回到共享仓储写路径。

## 7. 迁移与切换规则

- 所有新表先定义逻辑实体，再生成多 Provider SQL，不允许只写单库脚本。
- 所有迁移必须带稳定 `migrationId`，写入 `schema_migration_history`。
- 采用前向迁移；回滚通过补偿迁移，不依赖隐式降级。
- 不提供长期向后兼容运行时读链；旧缓存、旧本地表、旧页面状态只允许通过一次性导入脚本处理，不得继续演化成主模型。

## 8. 评估标准

- 契约通过：`pnpm.cmd run check:data-kernel`
- 类型通过：`pnpm.cmd run typecheck`
- 文档通过：`pnpm.cmd run docs:build`
- 验收标准：
  - 同一实体在 `sqlite/postgresql` 下字段语义一致
  - 同一 Repository 在桌面、Server、混合模式下接口一致
  - 新增 Provider 仅扩展 `Dialect / Provider / Migration / BlobStore`，不改业务层 API
