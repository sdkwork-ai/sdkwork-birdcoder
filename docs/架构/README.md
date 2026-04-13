# BirdCoder 架构文档总览

本目录用于冻结 BirdCoder 的统一 Kernel、统一 API、统一 `coding_session` 数据内核、统一 Rust `coding-server` 协议、多引擎、多数据库和多宿主交付标准。文档按“需求 -> 架构 -> Kernel -> Server API -> 数据 -> 治理 -> 发布”组织。

## 0. 当前冻结重点

- 统一引擎主键固定为 `codex / claude-code / gemini / opencode`；`claude`、`claude code` 仅是别名，不再是主 ID。
- 统一引擎标准已冻结到 `packages/sdkwork-birdcoder-types/src/engine.ts`，并已由 `packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts` 输出 descriptor 与 model catalog。
- 统一会话主骨架固定为 `workspace -> project -> coding_session`，运行时主骨架固定为 `runtime / turn / message / event / artifact / checkpoint`。
- `auth / user / vip` 统一通过 `sdkwork-birdcoder-appbase` 承载；BirdCoder 不再维护平行身份业务包。
- `Terminal` 已降级为外部工程集成边界；本仓主产品面固定为 `Code / Studio / coding-server / release-governance`。
- `coding-server` 协议标准、代表性 `core / app / admin` 路由、canonical OpenAPI 导出与发布侧证据链已闭环；Rust host 不再处于最小 host 骨架阶段，Representative placeholder routes 当前真相为 `none`。
- PostgreSQL live smoke 已在当前主机记录 DSN-backed `passed` 报告；未来缺失 DSN/driver 时保持 `blocked`，未来 DSN-backed 运行时连通性回归时保持结构化 `failed`。

## 1. 阅读目标

- 明确 BirdCoder 是统一 Code Engine 的 AI IDE，核心工作面是 `Code / Studio`，`Terminal` 只作为外部集成边界存在，不是本仓主线实现目标。
- 明确 Claude Code、Codex、Gemini、OpenCode 通过同一 Kernel 接入，不形成分叉产品。
- 明确 `workspace -> project -> coding_session` 是业务主骨架，`runtime / turn / message / event / artifact` 是运行时主骨架。
- 明确 `coding-server` 是唯一服务中枢，`web / desktop / server` 共用 `core / app / admin` 三组 API。
- 明确 `appbase`、`prompt`、`skillhub`、`app_template`、`storage`、`release` 的职责边界。
- 明确 `sqlite + postgresql` 双 Provider 与桌面、服务端、Docker、K8s 的统一交付规则。

## 2. 重点阅读顺序

1. [01-产品设计与需求范围](./01-产品设计与需求范围.md)
2. [02-架构标准与总体设计](./02-架构标准与总体设计.md)
3. [05-统一Kernel与Code Engine标准](./05-统一Kernel与Code%20Engine标准.md)
4. [21-多Code-Engine协议-SDK-适配标准](./21-多Code-Engine协议-SDK-适配标准.md)
5. [20-统一Rust-Coding-Server-API-协议标准](./20-统一Rust-Coding-Server-API-协议标准.md)
6. [07-数据模型-状态模型-接口契约](./07-数据模型-状态模型-接口契约.md)
7. [19-统一会话运行时-Prompt-SkillHub-AppTemplate标准](./19-统一会话运行时-Prompt-SkillHub-AppTemplate标准.md)
8. [13-规则-技能-MCP-知识系统标准](./13-规则-技能-MCP-知识系统标准.md)
9. [18-多数据库抽象-Provider-迁移标准](./18-多数据库抽象-Provider-迁移标准.md)
10. [03-模块规划与边界](./03-模块规划与边界.md)
11. [04-技术选型与可插拔策略](./04-技术选型与可插拔策略.md)
12. [06-编译环境-预览-模拟器-测试体系](./06-编译环境-预览-模拟器-测试体系.md)
13. [08-性能-安全-可观测性标准](./08-性能-安全-可观测性标准.md)
14. [09-安装-部署-发布标准](./09-安装-部署-发布标准.md)
15. [10-开发流程-质量门禁-评估标准](./10-开发流程-质量门禁-评估标准.md)
16. [11-行业对标与能力矩阵](./11-行业对标与能力矩阵.md)
17. [12-统一工具协议-权限沙箱-审计标准](./12-统一工具协议-权限沙箱-审计标准.md)
18. [14-现状基线-差距-演进路线](./14-现状基线-差距-演进路线.md)
19. [15-工作台偏好-终端运行时-本地存储补充标准](./15-工作台偏好-终端运行时-本地存储补充标准.md)
20. [16-终端主机会话-运行配置-本地存储标准](./16-终端主机会话-运行配置-本地存储标准.md)
21. [17-appbase-auth-user-vip-统一接入标准](./17-appbase-auth-user-vip-统一接入标准.md)

## 3. 总体验收维度

- 架构一致性：分层、命名、接口、发布链路、证据链一致。
- 会话一致性：不同引擎切换后，`coding_session`、审批流、Artifact、审计语义保持稳定。
- 接口一致性：`web / desktop / server` 全部访问同一套 `coding-server` `core/app/admin` API，不出现宿主私有平行协议。
- 数据一致性：`sqlite` 与 `postgresql` 逻辑模型一致；浏览器 `localStorage` 仅允许承担轻量 UI 缓存，不进入权威持久化链路。
- 治理一致性：Prompt、SkillHub、App Template、MCP 都经过统一规则、权限和审计。
- 可演进性：新增引擎、数据库、宿主、模板体系或 API 资源时，不破坏现有业务骨架。
