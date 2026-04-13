# 05-统一Kernel与Code Engine标准

## 1. 目标

BirdCoder 的产品中心必须是统一 Kernel，而不是某个具体引擎。Claude Code、Codex、Gemini、OpenCode 只提供推理与执行能力；工作区、工具协议、Artifact、构建、预览、测试、发布必须由 Kernel 统一编排。

## 2. 当前基线

- `sdkwork-birdcoder-chat` 已定义基础聊天协议，`sdkwork-birdcoder-chat-claude`、`-codex`、`-gemini`、`-opencode` 已独立分包。
- `packages/sdkwork-birdcoder-types/src/engine.ts` 已冻结统一 `engineKey / transportKinds / capabilityMatrix / modelCatalog` 类型标准。
- `packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts` 已冻结 canonical engine id：`codex / claude-code / gemini / opencode`，并已输出 `listWorkbenchCodeEngineDescriptors()` 与 `listWorkbenchModelCatalogEntries()`。
- `Terminal / Settings / Workbench Preferences` 已统一切换到 `claude-code` 作为 canonical id；`claude`、`claude code` 仅用于别名归一。
- `useProjects.sendMessage()` 仍在前端 Hook 层做部分 `commands`、`fileChanges` 归一，这部分还未完全提升为 Kernel 公共能力。
- 当前外部源码已纳入 `external/codex`、`external/gemini`、`external/opencode`、`external/claude-code`，具备对齐原生会话模型的依据。
- 多引擎协议与 SDK 细化标准以下一篇《21-多Code-Engine协议-SDK-适配标准》为准，本文件只冻结 Kernel 主骨架与职责边界。

## 3. Kernel 标准职责

- 统一管理 `coding_session` 生命周期、会话恢复、引擎切换和宿主切换。
- 装配文件、Git、外部 Terminal 集成上下文、规则、提示、技能、模板、诊断等上下文。
- 统一工具注册、权限校验、审批、执行、错误映射和审计。
- 统一投影文本、Diff、命令、日志、补丁、证据和发布结果。
- 统一编排外部 Terminal 集成、`Build / Preview / Simulator / Test / Release`。
- 统一把 Kernel 能力映射到 `coding-server core API`，供 `web / desktop / server` 三种宿主以同一协议消费。

## 4. 统一会话运行时标准

- `coding_session`：IDE 面向用户的稳定业务单元。
- `coding_session_runtime`：引擎原生 `thread/session/stream`、能力快照、恢复点、宿主状态。
- `coding_session_turn`：一次用户输入触发的一轮计划、推理、工具执行闭环。
- `coding_session_message`：统一 UI 投影消息，供 `Code / Studio` 与外部 Terminal 集成入口共享。
- `coding_session_event`：原生事件保真层，保留流式片段、工具进度、系统事件。
- `coding_session_artifact`：Diff、命令输出、文件变更、构建结果、预览证据、测试证据。
- `coding_session_checkpoint`：可恢复快照、审批挂起点、断点续跑点。

规则：用户界面读 `coding_session_message`，排错与回放读 `coding_session_event`，引擎私有 ID 只落在 `coding_session_runtime`，不污染上层业务语义。

## 5. 引擎映射标准

| 引擎 | 原生传输 | 原生主容器 | 原生迭代单元 | BirdCoder 映射 |
| --- | --- | --- | --- | --- |
| Codex | CLI JSONL / app-server JSON-RPC v2 | `thread` | `turn -> item/event` | `coding_session -> coding_session_turn -> coding_session_event` |
| Gemini | SDK event stream | `session` | `tool call + stream event` | `coding_session_runtime -> coding_session_event` |
| OpenCode | OpenAPI HTTP + SSE | `session` | `message/part + status/diff/todo/pty/question` | `coding_session_message + coding_session_event + coding_session_artifact` |
| Claude Code | remote-control HTTP/SSE | `session/code-session` | `sdk message/stream_event/tool_progress/result` | `coding_session_runtime + coding_session_event + coding_session_artifact` |

## 6. Code Engine SPI

- `BirdCoderEngineDescriptor`：名称、厂商、宿主支持矩阵、安装方式、默认模型、官网、传输标准。
- `EngineCapabilityMatrix`：聊天、流式、工具调用、补丁、计划、终端、测试、预览、审批。
- `BirdCoderModelCatalogEntry`：模型名、状态、默认标记、传输标准、能力差异。
- `EngineTransportAdapter`：屏蔽 CLI、SDK、HTTP、SSE、JSON-RPC 差异。
- `EngineRuntimeAdapter`：创建/恢复原生会话，维护 `coding_session_runtime`。
- `TurnOrchestrator`：统一一轮输入的计划、执行、取消、超时、恢复。
- `ContextAssembler`：把工作区、规则、Prompt、Skill、Template 组装为统一上下文。
- `EventNormalizer`：把原生事件映射为标准 `coding_session_event.kind` 集合。
- `ToolBridgeAdapter`：统一工具注册、参数校验、权限校验、结果回传。
- `ResultNormalizer`：将原生消息、补丁、命令、错误映射为统一模型。
- `ArtifactProjector`：把 diff、todo、pty、预览、测试、发布证据投影为 `coding_session_artifact`。
- `SafetyPolicyAdapter`：沙箱、审批、密钥脱敏、速率限制、审计策略。
- `CapabilityRegistry`：冻结每个引擎在当前宿主下的真实能力矩阵。
- `ServerApiProjector`：把统一会话、Artifact、执行编排投影为 `core/app/admin` API DTO。

## 7. 原生协议对齐约束

- Codex：必须保留 `thread` 连续性、`turn` 边界、`item/event` 细粒度事件、`outputSchema`、工作目录与审批策略语义。
- Gemini：必须保留 `sessionId`、`transcript`、动态 instructions、Tool Registry、Skill 装载与调度闭环。
- OpenCode：必须保留 `session/message/part` 主结构、自定义工具优先级、`StructuredOutput`、`diff/todo/pty/question` 一等能力。
- Claude Code：必须保留 `session/code-session` 分层、bridge 握手、历史回放、SSE 事件和 `sdkMessageAdapter` 的消息类别。

## 8. 与 Coding Server 的关系

- Kernel 是事实源，`coding-server` 是协议投影面。
- `core API` 暴露 Kernel 能力；`app API` 暴露项目生命周期能力；`admin API` 暴露治理与控制台能力。
- `desktop` 不允许直接绕过 Kernel 调本地实现；应优先通过 `coding-server` 回环访问统一协议。

## 9. 一致性约束

- 切换引擎不改变导航、审批模型、Artifact 结构和主交互路径。
- 引擎差异只允许体现在 capability、性能、限流、降级提示，不允许形成页面分叉。
- 默认引擎由 distribution、workspace policy 或用户策略决定，不允许长期写死单一品牌。
- `Code / Studio` 与外部 Terminal 集成入口共用同一会话骨架，不得各自维护私有聊天协议。
- `web / desktop / server` 共用同一 API 骨架，不得各自维护私有会话 DTO。

## 10. 成熟度分级

- `L0`：仅文本对话。
- `L1`：支持流式输出与基础工具调用。
- `L2`：支持补丁、命令、上下文增量、审批、会话恢复。
- `L3`：支持构建、测试、预览、模拟器和发布编排。
- `L4`：统一投影到 `coding-server core/app/admin`，支撑项目全生命周期协作。

BirdCoder 当前运行时标准已到 `L2`，Studio 执行证据链已局部达到 `L3`，统一 `coding-server` 服务协同仍未到 `L4`。

## 11. 评估标准

- 新增引擎只新增适配器与注册，不改 `Code / Studio` 主流程与外部 Terminal 集成入口。
- 引擎切换后，`coding_session_message`、`coding_session_artifact`、审计事件结构保持稳定。
- Prompt、Skill、Template 的注入顺序不因引擎变化而变化。
- 任意引擎异常都能映射为可观测、可审计、可恢复的标准错误。
- Kernel 投影到 `coding-server` 后，DTO 字段、错误模型、事件协议不漂移。
