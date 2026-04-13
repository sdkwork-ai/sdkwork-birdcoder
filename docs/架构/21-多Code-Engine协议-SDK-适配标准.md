# 21-多Code-Engine协议-SDK-适配标准

## 1. 来源快照

本标准直接基于本地源码快照抽取，不依赖二手描述：

- Codex：`external/codex/sdk/typescript/README.md`、`src/thread.ts`、`src/events.ts`、`sdk/python/README.md`
- Gemini：`external/gemini/packages/sdk/src/session.ts`、`tool.ts`、`types.ts`
- OpenCode：`external/opencode/packages/web/src/content/docs/sdk.mdx`、`custom-tools.mdx`
- Claude Code：`external/claude-code/packages/remote-control-server/src/routes/v2/code-sessions.ts`、`packages/remote-control-server/src/routes/web/sessions.ts`、`src/remote/sdkMessageAdapter.ts`

说明：

- 本地源码镜像用于协议抽取；运行时元数据与真实接入成熟度仍以 `packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts` 和 `packages/sdkwork-birdcoder-server` 的实现现状为准。

## 2. 统一目标

- 同一 `coding_session` 标准承载四类引擎，不形成 Claude/Codex/Gemini/OpenCode 专属业务容器。
- 同一 `coding-server` 协议承载 Desktop、Web、Server，不把原生 CLI、SDK、HTTP 细节暴露给页面。
- 同一 Tool/Approval/Artifact/Audit 标准覆盖 `Code / Studio`、外部 Terminal 集成、补丁、预览、测试、发布。

## 2.1 当前冻结主键

- 统一 engineKey 固定为 `codex / claude-code / gemini / opencode`。
- `claude`、`claude code`、`open-code` 等仅作为 alias 归一，不再作为顶层主键。
- 工作台内核必须能直接导出 descriptor 与 model catalog；页面不再私拼引擎元数据。

## 3. 四引擎协议画像

| 引擎 | 主传输 | 原生会话模型 | 原生能力重点 | BirdCoder 适配重点 |
| --- | --- | --- | --- | --- |
| Codex | CLI JSONL；app-server JSON-RPC v2 | `thread -> turn -> item/event` | `resumeThread`、`outputSchema`、工作目录、审批策略 | 保留 thread 连续性与 turn 边界，统一映射为标准 event/artifact |
| Gemini | SDK event stream | `sessionId + transcript` | Tool Registry、Skill 装载、动态 instructions、工具调度 | 把 tool/skill/instruction 注入统一到 ContextAssembler 与 ToolBridge |
| OpenCode | OpenAPI HTTP + SSE | `session/message/part` | 自定义工具、结构化输出、`diff/todo/pty/question`、事件订阅 | 把 IDE 原生产物升格为一等 Artifact，而不只看文本消息 |
| Claude Code | remote-control HTTP/SSE | `session/code-session` | bridge、history、实时事件、`tool_progress/result/stream_event`、MCP | 统一远程桥接、本地回放与进度/审批事件标准化 |

## 4. BirdCoder 统一适配层

| 层 | 职责 |
| --- | --- |
| `EngineTransportAdapter` | 屏蔽 CLI、SDK、HTTP、SSE、JSON-RPC 差异 |
| `EngineSessionAdapter` | 创建、恢复、关闭原生会话，并维护 `coding_session_runtime` |
| `TurnDriver` | 把一次输入统一编排为标准 turn 生命周期 |
| `EventNormalizer` | 把原生事件归一为标准 `kind` 集合 |
| `ToolBridgeAdapter` | 统一工具注册、参数校验、审批、执行和回传 |
| `ArtifactProjector` | 把 diff、pty、todo、日志、预览、测试、发布证据投影为 `coding_session_artifact` |
| `ApprovalPolicyAdapter` | 统一 AutoAllow / OnRequest / Restricted / ReleaseOnly |
| `CapabilityRegistry` | 冻结当前宿主下的真实能力矩阵，禁止 UI 猜测能力 |

## 5. 标准归一规则

- Session 归一：顶层只认 `coding_session`；原生 `thread/session/code-session` 只进入 `coding_session_runtime.native_*`。
- Turn 归一：Codex `turn`、Gemini 一轮流式执行、OpenCode 一次 prompt、Claude Code 一轮 remote result 都投影为 `coding_session_turn`。
- Message 归一：只把稳定 UI 需要的文本、说明、系统提示投影为 `coding_session_message`。
- Event 归一：原生流式片段、工具进度、权限请求、状态变化全部进入 `coding_session_event`。
- Artifact 归一：diff、todo、pty 输出、命令结果、结构化输出、构建证据、预览证据、测试证据都进入 `coding_session_artifact`。

## 6. Canonical Event Kinds

- `session.started`
- `turn.started`
- `message.delta`
- `message.completed`
- `tool.call.requested`
- `tool.call.progress`
- `tool.call.completed`
- `artifact.upserted`
- `approval.required`
- `operation.updated`
- `turn.completed`
- `turn.failed`

映射要求：

- Codex `thread.started` 对齐 `session.started`；`item.*` 细分映射到 `message/tool/artifact`。
- Gemini `ToolCallRequest` 必须落成 `tool.call.requested`；技能与工具执行结果进入 `tool.call.completed`。
- OpenCode 的 `diff/todo/pty/question/status` 不得丢弃，必须映射为 `artifact.upserted` 或 `operation.updated`。
- Claude Code 的 `stream_event/tool_progress/result` 必须分别映射到 `message.delta`、`tool.call.progress`、`turn.completed|failed`。

## 7. SDK 与协议准入门槛

- 必须支持会话恢复或可证明的连续会话能力。
- 必须支持流式事件或可观测的长任务状态。
- 必须能挂接统一工具与审批策略。
- 必须能输出结构化结果、补丁、命令或等价 Artifact。
- 必须能在本地宿主或远程 `coding-server` 中稳定运行。
- 必须能被 `packages/sdkwork-birdcoder-types` 投影为稳定 DTO，不引入页面专属私有结构。

## 8. 对 BirdCoder 类型标准的冻结要求

- 不再新增顶层 `thread`、`conversation`、`chat_session` 业务容器。
- `packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts` 必须暴露 `listWorkbenchCodeEngineDescriptors()` 与 `listWorkbenchModelCatalogEntries()`，并与 `@sdkwork/birdcoder-types` 同步。
- `coding_session_runtime` 必须显式保存 `engineKey`、`nativeSessionId`、`transportKind`、`capabilitySnapshot`。
- `coding_session_event.kind` 只能从标准集合扩展，不允许页面临时自造。
- `EngineCapabilityMatrix` 必须明确流式、结构化输出、工具调用、审批、Artifact、远程桥接、MCP 支持状态。

## 9. 评估标准

- 新增引擎时，是否只增加 adapter，而不改 `Code / Studio` 主流程与外部 Terminal 集成入口。
- 切换引擎后，`coding_session_message/event/artifact` 是否仍保持稳定语义。
- 同一能力在 Desktop、Web、Server 下是否仍通过同一 `coding-server` 协议访问。
- 任一原生协议异常是否都能落为可审计、可恢复、可诊断的标准事件。

## 10. 当前仓库落地（2026-04-10）

- 共享运行时包装层：`packages/sdkwork-birdcoder-commons/src/workbench/runtime.ts`
- 统一入口：`packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts` 中的 `createWorkbenchChatEngine()`
- 当前已落地能力：
  - 统一 runtime descriptor：`engineId / modelId / transportKind / approvalPolicy / capabilityMatrix`
  - 统一 canonical event stream：`session.started / turn.started / message.delta / message.completed / tool.call.requested / artifact.upserted / approval.required / operation.updated / turn.completed|failed`
  - 统一 tool 投影：
    - 文件改写类 -> `patch`
    - 命令执行类 -> `command-log`
    - 检索读取类 -> `diagnostic-bundle`
  - 统一审批语义：默认 `OnRequest`，副作用工具进入审批门
- 当前边界：
  - 已完成 engine 侧共享 runtime 标准化
  - 已完成 `coding-server` / Core projection 侧事件直通、SSE envelope 透出与 provider-backed 持久化入库
  - 代表性 app/admin 路由闭环继续由 Step 17 路线治理，不在本条 canonical runtime sink 里重复打开
- 当前准则：
  - 页面层不得再直接解析各引擎私有 `tool_calls` 语义来定义标准
  - 新引擎必须先接入该共享 runtime，再进入 UI、Server、Release 闭环
