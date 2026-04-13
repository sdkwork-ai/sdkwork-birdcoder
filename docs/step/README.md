# BirdCoder 分步实施计划索引

## 1. 文档定位

本目录把 `/docs/架构/` 的标准拆成可执行、可并行、可验收、可回写的 Step。实际调度以“主线优先 + 最短闭环”为准。

## 2. 当前主线

- 主产品主线：`Code -> Studio -> coding-server -> release / governance`
- 架构主线：`appbase / provider / prompt-skill-template / engine adapter`
- `Terminal` 已调整为外部工程集成边界，不再是本仓主线实现 Step。

## 3. 总体执行顺序

| Step | 主题 | 核心目标 | 硬前置 | 主要输出 | 并行性 |
| --- | --- | --- | --- | --- | --- |
| `00` | 总实施原则与执行门禁 | 冻结统一执行、证据、回滚口径 | 无 | 门禁与模板 | 串行 |
| `01` | 现状基线冻结与差距审计 | 冻结当前事实与风险目录 | `00` | 基线矩阵 | 串行 |
| `02` | Shell/Host/Kernel 骨架收敛 | 统一宿主、壳层、Kernel 边界 | `01` | 基础骨架 | 串行 |
| `03` | 领域模型-接口契约-数据标准冻结 | 冻结实体、DTO、Repository、Schema | `02` | 统一数据与协议基线 | 串行 |
| `04` | Workspace/Project/Auth/Settings 治理 | 冻结工作台上下文与 appbase 边界 | `03` | Workspace / Project 语义 | 串行 |
| `05` | Code Engine SPI 与统一会话内核 | 冻结多 Engine SPI 与会话语义 | `03-04` | Engine SPI / Session Kernel | 串行 |
| `06` | Code 视图-编辑器-文件系统重构 | 打磨左侧 Code 主工作面 | `05` | Code 主链路 | 高并行 |
| `07` | Studio 视图-预览-模拟器-编译环境体系 | 打磨 Studio 所见即所得主链路 | `05` | Studio 主链路 | 高并行 |
| `08` | Terminal 外部工程集成边界 | 冻结外部 Terminal 接入协议与治理回写 | `05,09,17,18` | 集成 contract / adapter / evidence 接口 | 外部条件并行 |
| `09` | Server Runtime-OpenAPI-桌面/服务双模落地 | 固化统一 `coding-server` 访问与双模部署 | `05-07,14-16,18` | OpenAPI / DTO / 双模运行 | 串行为主 |
| `10` | 性能-安全-观测-审计治理 | 建立门禁与审计证据链 | `09` | 治理门禁 | 条件并行 |
| `11` | Docker-K8s-部署-打包-Release 链路 | 打通多宿主交付链 | `09-10,15` | 交付矩阵 | 串行为主 |
| `12` | 测试矩阵-质量门禁-回归自动化 | 建立契约、集成、E2E、回归闭环 | `09-10,15,18` | 测试矩阵 / CI 门禁 | 条件并行 |
| `13` | 发布就绪-GitHub Flow-灰度回滚闭环 | 固化发布、灰度、回滚、Release 证据 | `10-12,17` | 发布与回滚闭环 | 串行 |
| `14` | Appbase Auth/User/VIP 统一接入实施 | 用 appbase 替换本地平行模块 | `04` | appbase 主边界 | 条件并行 |
| `15` | 多数据库 Provider 与迁移标准化 | 固化 `sqlite/postgresql` Provider 与 authority | `03` | Provider / Dialect / Migration 标准 | 条件并行 |
| `16` | Prompt/SkillHub/AppTemplate-项目模板体系 | 固化 Prompt、Skill、Template 注入链 | `05` | Prompt / Skill / Template 体系 | 条件并行 |
| `17` | Coding-Server Core/App/Admin API 与控制台实现 | 落地统一 API 与项目生命周期控制台 | `09,14,16` | `core/app/admin` API 与控制台 | 串行为主 |
| `18` | 多 Code-Engine Adapter-统一工具协议闭环 | 落地多引擎适配与工具协议 | `05` | Adapter / Tool Protocol / Conformance | 条件并行 |
| `20` | runtime-data-kernel-v2 剩余实体 Authority 闭环 | `20A team_member` 与 `20B deployment_target` 已闭环，Step 20 完成并解锁下一未定义 Step | `15,17` | 共享仓储 / 路由 / Facade / Consumer 真相 | 串行为主 |

## 4. 实施波次

- 波次 A：`00-05`
- 波次 B：`06/07/14/15/16/18`
- 波次 C：`09 -> 17`
- 波次 D：`10/11/12`
- 波次 E：`13`
- 波次 F：`20`
- 外部窗口：`08`，仅在外部 Terminal 工程版本冻结后开启

## 5. 执行红线

- 不得让 Terminal 集成阻塞 `Code / Studio` 主线。
- 不得在本仓继续扩张 Terminal authority 数据模型、Repository、SQLite 迁移与 UI 深化。
- 不得绕过 `coding-server`、`types`、`appbase`、Provider 标准做平行实现。
- 每个 Step 完成后都必须回写 `/docs/架构/`、`/docs/step/`、`/docs/release/`。
