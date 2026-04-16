# 05-统一Kernel与Code Engine标准

## 1. 目标

BirdCoder 的产品中心必须是统一 Kernel，而不是某一家具体引擎的界面包装。`Codex / Claude / Gemini / OpenCode` 提供的是推理与执行能力，工作区、规则、工具、Artifact、审批、预览、测试和发布必须由 Kernel 统一编排。

## 2. 当前基线

- 当前仓库已冻结 canonical engine id：`codex / claude-code / gemini / opencode`
- 当前仓库已在 `packages/sdkwork-birdcoder-types/src/engine.ts` 冻结统一 `engineKey / transportKinds / capabilityMatrix / modelCatalog` 类型标准
- 当前仓库已在 `packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts` 冻结 descriptor 与 model catalog 输出
- 当前仓库中的 `@sdkwork/birdcoder-chat` 与四个 `@sdkwork/birdcoder-chat-*` 包仍处于兼容层定位，不应继续承担完整多引擎生产级接入职责
- 多引擎接入细则以下一篇《21-多Code-Engine协议-SDK-适配标准》为准，本文只冻结 Kernel 主骨架与责任边界

## 3. Kernel 标准职责

- 统一管理 `coding_session` 生命周期、会话恢复、引擎切换和宿主切换
- 统一组装 workspace、project、prompt、rule、skill、template、tool、memory 等上下文
- 统一审批、沙箱、权限、审计、限流和诊断
- 统一把 provider 原生事件投影为 message、event、artifact、checkpoint
- 统一把运行时能力投影到 `coding-server` 的 `core / app / admin` API

## 4. 统一运行时骨架

BirdCoder 的统一运行时骨架固定为：

- `coding_session`
- `coding_session_runtime`
- `coding_session_turn`
- `coding_session_message`
- `coding_session_event`
- `coding_session_artifact`
- `coding_session_checkpoint`

### 4.1 分层约束

- 用户界面消费 `coding_session_message`
- 审计与回放消费 `coding_session_event`
- 差异、命令、测试、预览、计划等结构化结果进入 `coding_session_artifact`
- provider 私有 session id、thread id、bridge id、connection token 只允许落在 `coding_session_runtime`

## 5. Code Engine SPI

BirdCoder 的 Code Engine SPI 应围绕以下统一对象构建：

- `BirdCoderEngineDescriptor`
- `BirdCoderModelCatalogEntry`
- `EngineCapabilityMatrix`
- `EngineAdapter`
- `SessionAdapter`
- `EventNormalizer`
- `ArtifactProjector`
- `ApprovalAdapter`
- `HealthAdapter`

### 5.1 统一策略

- 上层统一运行时对象，不统一 provider 请求参数
- 官方 SDK 优先，官方协议补齐，源码抽象兜底
- provider 高级能力允许保留，但只能从 `extensions/raw` 旁路显式访问

## 6. 标准包边界

BirdCoder 的长期包边界应演进为：

- `@sdkwork/birdcoder-engine`
- `@sdkwork/birdcoder-engine-types`
- `@sdkwork/birdcoder-engine-runtime`
- `@sdkwork/birdcoder-engine-transport`
- `@sdkwork/birdcoder-engine-registry`
- `@sdkwork/birdcoder-engine-codex`
- `@sdkwork/birdcoder-engine-claude`
- `@sdkwork/birdcoder-engine-gemini`
- `@sdkwork/birdcoder-engine-opencode`

### 6.1 过渡要求

- 现有 `chat-*` 包只保留兼容 facade 职责
- 新的 provider 实现不再继续沉淀到 `chat-*`
- 页面层、Server 层、Studio 层禁止直接依赖第三方 engine SDK

## 7. 与 Coding Server 的关系

- Kernel 是运行时事实源
- `coding-server` 是统一协议投影面
- `web / desktop / server` 必须通过同一套 server contract 访问统一运行时
- 宿主模式切换不允许改写 canonical session / event / artifact 语义

## 8. 成熟度要求

- `L0`：只支持文本对话
- `L1`：支持流式输出与基础工具调用
- `L2`：支持结构化结果、diff、approval、resume
- `L3`：支持 build、test、preview、发布证据
- `L4`：统一投影到 `coding-server core/app/admin` 并支持跨宿主一致执行

BirdCoder 的多引擎中间层目标是以 `L2` 为最低落地门槛，以 `L4` 为最终交付标准。

## 9. 验收标准

- 新增 provider 时，只新增 adapter 与 registry，不改产品层主流程
- 切换 provider 后，消息、Artifact、审批和审计语义保持稳定
- 任何 provider 差异只能体现为 capability、feature gate、degrade 提示，而不能反向污染公共接口
