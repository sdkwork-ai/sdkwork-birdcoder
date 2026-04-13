# 90 - 架构能力-Step-目录-证据映射矩阵

## 1. 目标与范围

用于在开工前快速回答五个问题：能力落在哪个 Step、对齐哪些架构文档、改哪些目录、需要哪些协同 Step、必须交付哪些证据。无法映射到本表的能力，不得直接进入实现。

## 2. 架构对齐

对齐 `/docs/架构/01-21` 全集，尤其是 `05`、`07`、`17`、`18`、`19`、`20`、`21`。若能力映射、目录边界、证据口径三者任意一项不清晰，先补文档再编码。

## 3. 能力正向映射

| 架构能力 | 关联架构文档 | 主 Step | 协同 Step | 主要目录 | 必要证据 |
| --- | --- | --- | --- | --- | --- |
| Shell/Host/Kernel 骨架 | `02` `03` `05` | `02` | `09` `17` | `packages/sdkwork-birdcoder-shell` `packages/sdkwork-birdcoder-host-core` `packages/sdkwork-birdcoder-core` | 入口链图、目录边界、依赖检查 |
| 领域模型/DTO/Repository 标准 | `05` `07` `18` `19` `20` | `03` | `15` `16` `17` | `packages/sdkwork-birdcoder-types` `packages/sdkwork-birdcoder-commons` | 实体表、DTO 表、Schema 说明 |
| Workspace/Project/Appbase 上下文 | `03` `07` `17` | `04` | `14` `17` | `packages/sdkwork-birdcoder-appbase` `packages/sdkwork-birdcoder-shell` `packages/sdkwork-birdcoder-settings` | 边界图、恢复语义、接入说明 |
| Code Engine SPI 与统一会话内核 | `04` `05` `19` `21` | `05` | `16` `18` | `packages/sdkwork-birdcoder-commons` `packages/sdkwork-birdcoder-chat-*` | Capability Matrix、Session 标准、Adapter 契约 |
| Code 视图/编辑器/文件系统 | `03` `06` `14` | `06` | `05` `16` | `packages/sdkwork-birdcoder-code` `packages/sdkwork-birdcoder-ui` | 文件流测试、编辑器回归、宿主一致性结果 |
| Studio/Preview/Simulator/Build | `06` `19` | `07` | `16` `17` | `packages/sdkwork-birdcoder-studio` `packages/sdkwork-birdcoder-host-studio` `packages/sdkwork-birdcoder-templates` | 预览闭环、构建 Profile、Smoke |
| 外部 Terminal 集成/启动映射/证据回写 | `12` `15` `16` `18` | `08` | `09` `17` `18` | `packages/sdkwork-birdcoder-terminal` `packages/sdkwork-birdcoder-desktop` `packages/sdkwork-birdcoder-shell` | 接入 contract、launch mapping、audit/evidence bridge |
| Server Runtime/OpenAPI/双模访问 | `02` `09` `20` | `09` | `17` | `packages/sdkwork-birdcoder-server` `packages/sdkwork-birdcoder-types` `packages/sdkwork-birdcoder-shell` `packages/sdkwork-birdcoder-web` `packages/sdkwork-birdcoder-desktop` | 双模拓扑、Host Identity、OpenAPI Contract、双模 Smoke |
| Appbase Auth/User/VIP 统一接入 | `17` | `14` | `04` `17` | `packages/sdkwork-birdcoder-appbase` `packages/sdkwork-birdcoder-shell` | Bridge 清单、路由意图、Parity Contract |
| 多数据库 Provider 与迁移 | `07` `18` | `15` | `03` `11` `12` `17` | `packages/sdkwork-birdcoder-infrastructure` `packages/sdkwork-birdcoder-types` | Provider Contract、迁移回放、authority 模式说明 |
| 剩余 schema-only collaboration/delivery authority 实体 | `07` `18` `20` | `20` | `15` `17` | `packages/sdkwork-birdcoder-types` `packages/sdkwork-birdcoder-infrastructure` `packages/sdkwork-birdcoder-server` | `team_member` 与 `deployment_target` 已闭环；共享仓储、project-scoped admin route、Facade、消费者、Rust host 证据 |
| Prompt/SkillHub/AppTemplate/项目模板 | `13` `19` | `16` | `05` `07` `17` | `packages/sdkwork-birdcoder-types` `packages/sdkwork-birdcoder-skills` `packages/sdkwork-birdcoder-templates` `docs/prompts` | 注入顺序、绑定表、实例化验证 |
| Rust `coding-server` / `core/app/admin` API / 控制台 | `09` `20` | `17` | `09` `14` `16` `18` | `packages/sdkwork-birdcoder-server` `packages/sdkwork-birdcoder-types` `packages/sdkwork-birdcoder-shell` `packages/sdkwork-birdcoder-web` `packages/sdkwork-birdcoder-desktop` | 路由矩阵、OpenAPI、Console Contract |
| 多 Engine Adapter 与统一工具协议 | `05` `12` `21` | `18` | `05` `08` `17` | `packages/sdkwork-birdcoder-chat-*` `packages/sdkwork-birdcoder-server` | Conformance Matrix、Canonical Event、Approval/Tool Contract |
| 性能/安全/观测/审计 | `08` `10` `12` | `10` | `17` `18` `12` | `scripts` `packages/sdkwork-birdcoder-server` | 基准结果、审计日志、阻断记录 |
| Docker/K8s/多平台打包 | `09` `10` | `11` | `15` `17` `13` | `deploy` `scripts/release` `artifacts` | 产物矩阵、Smoke、校验和 |
| 测试矩阵与 CI 门禁 | `06` `08` `10` | `12` | `15` `17` `18` | `.github` `scripts` `packages/*` | 测试矩阵、门禁结果、失败归档 |
| GitHub Flow/Release/回滚 | `09` `10` `11` `14` | `13` | `17` `12` | `.github` `docs/release` `scripts/release` | 发布说明、灰度记录、回滚演练 |

## 4. 架构文档反向映射

| 架构文档 | 主 Step | 关键验收点 |
| --- | --- | --- |
| `01-产品设计与需求范围` | `01` | 目标范围、现状事实、能力差距一致 |
| `02-架构标准与总体设计` | `02` `09` | 共核拓扑、双模宿主、统一 API 成立 |
| `03-模块规划与边界` | `02` `04` `06` | 目录职责、依赖方向、页面边界稳定 |
| `04-技术选型与可插拔策略` | `05` `17` `18` | Engine、Adapter、Host 可插拔成立 |
| `05-统一Kernel与Code Engine标准` | `05` `18` | Kernel、Session、Engine 语义统一 |
| `06-编译环境-预览-模拟器-测试体系` | `07` `11` `12` | 预览、编译、测试、交付闭环 |
| `07-数据模型-状态模型-接口契约` | `03` `15` `20` | 统一模型、状态、契约、存储标准成立 |
| `08-性能-安全-可观测性标准` | `10` | 预算、审计、观测、阻断门禁生效 |
| `09-安装-部署-发布标准` | `09` `11` `13` | 双模访问、多形态交付与发布回滚闭环 |
| `10-开发流程-质量门禁-评估标准` | `00` `12` | Step 门禁与 CI 门禁一致 |
| `11-行业对标与能力矩阵` | `01` | 行业对标项已映射为可执行差距 |
| `12-统一工具协议-权限沙箱-审计标准` | `05` `08` `10` `18` | 工具协议、沙箱、审计口径统一 |
| `13-规则-技能-MCP-知识系统标准` | `16` `18` | Prompt/Skill/MCP 接入边界稳定 |
| `14-现状基线-差距-演进路线` | `01` `93` | 基线、波次、演进路线一致 |
| `15-工作台偏好-终端运行时-本地存储补充标准` | `04` `08` | 偏好、外部 Terminal 集成配置、本地缓存语义统一 |
| `16-终端主机会话-运行配置-本地存储标准` | `08` | 外部 Terminal 接入、RunConfig、证据回写闭环 |
| `17-appbase-auth-user-vip-统一接入标准` | `14` | Auth/User/VIP 主边界已切到 appbase |
| `18-多数据库抽象-Provider-迁移标准` | `15` `20` | Provider/Dialect/Migration/BlobStore 闭环 |
| `19-统一会话运行时-Prompt-SkillHub-AppTemplate标准` | `16` | Session 命名、Prompt/Skill/Template 注入闭环 |
| `20-统一Rust-Coding-Server-API-协议标准` | `09` `17` `20` | `coding-server` 双模底座与 `core/app/admin` API 闭环 |
| `21-多Code-Engine协议-SDK-适配标准` | `18` | Adapter、Transport、Canonical Event、Conformance 闭环 |

## 5. 检查点

- `CP90-1`：`/docs/架构/01-21` 全部可反向定位到主 Step。
- `CP90-2`：全部核心能力都已映射到主 Step、协同 Step、主目录、必要证据。
- `CP90-3`：`14-18` 五个专项能力不再悬空，不再隐含塞入 `03/05/09`。
- `CP90-4`：任一新需求都能先落表、再派工、再开工。

## 6. 执行方式

| 项 | 说明 |
| --- | --- |
| 使用时机 | Step 开工前、Review 前、波次验收前 |
| 是否可并行 | 可并行查阅，结论必须统一收口 |
| 输出要求 | 给出“能力-文档-Step-目录-证据”五元结论，再进入实现 |
