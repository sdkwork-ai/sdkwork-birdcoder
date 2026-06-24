# 21-多Code-Engine协议-SDK-适配标准

## 1. 适用范围

本标准用于冻结 BirdCoder 对 `Codex / Claude / Gemini / OpenCode` 四类 Code Engine 的接入原则、统一运行时语义、适配器边界与治理要求。

本标准是多引擎接入的架构权威文档，优先级高于局部实现、临时接线、页面层兼容逻辑和历史 mock 叙述。

## 2. 官方核对基线（2026-04-14）

下表基于 `2026-04-14` 当天核对的官方资料与本地镜像源码快照形成，作为当前仓库的接入事实基线。

| Engine | 官方主入口 | BirdCoder 主接入级别 | 当前稳定主路径 | 补充官方路径 | 本地核对依据 |
| --- | --- | --- | --- | --- | --- |
| Codex | `@openai/codex-sdk` | `official-sdk` | TypeScript SDK | CLI JSONL、app-server JSON-RPC v2 | `external/codex/sdk/typescript` |
| Claude | `@anthropic-ai/claude-agent-sdk` | `official-sdk` | Agent SDK `query()` | Headless CLI、remote-control、V2 preview session API | 官方 `code.claude.com` 文档，仓库中保留协议镜像 |
| Gemini | `@google/gemini-cli-sdk` | `official-sdk` | Gemini CLI SDK | CLI / core / tool / skill 运行时 | `external/gemini/packages/sdk` |
| OpenCode | `@opencode-ai/sdk` | `official-sdk` | TypeScript SDK | OpenAPI / SSE / server mode | `external/opencode/packages/sdk/js` |

### 2.1 官方资料来源

- Codex SDK：`https://github.com/openai/codex/blob/main/sdk/typescript/README.md`
- Claude Agent SDK Overview：`https://code.claude.com/docs/en/agent-sdk/overview`
- Claude Agent SDK Migration Guide：`https://code.claude.com/docs/en/agent-sdk/migration-guide`
- Claude Agent SDK Sessions：`https://code.claude.com/docs/en/agent-sdk/sessions`
- Gemini CLI SDK：`https://github.com/google-gemini/gemini-cli/blob/main/packages/sdk/README.md`
- OpenCode SDK：`https://opencode.ai/docs/sdk/`

### 2.2 接入级别定义

- `official-sdk`：官方发布或官方仓库明示维护的 SDK 包。
- `official-protocol`：官方公开的 CLI、headless、SSE、OpenAPI、remote-control、JSON-RPC 等协议入口。
- `source-derived`：无官方 SDK 且无稳定官方协议，只能基于源码抽象。此级别必须显式标识，禁止伪装成官方 SDK 集成。

## 3. 冻结原则

- BirdCoder 对上统一运行时语义，不统一 provider 请求参数外观。
- 上层产品层只依赖 BirdCoder canonical runtime，不直接依赖第三方 engine SDK。
- 所有 provider 原生 DTO、event、tool payload 只允许出现在 adapter 内部。
- provider 原生高级能力允许保留，但只能经 `extensions/raw` 显式暴露。
- `official-sdk` 优先于 `official-protocol`，`official-protocol` 优先于 `source-derived`。
- 预览接口只能进 `experimental` 通道，不能混入稳定公共契约。

## 4. 统一架构分层

| 层 | 职责 | 禁止事项 |
| --- | --- | --- |
| Canonical Runtime Facade | 对 `Code / Studio / Terminal / Server` 暴露统一 session、turn、event、artifact、approval 语义 | 禁止直接暴露 provider DTO |
| Engine Adapter Layer | 把各 provider SDK 或官方协议映射为统一运行时对象 | 禁止让页面层自己做 provider 映射 |
| Transport Layer | 屏蔽 CLI、HTTP、SSE、SDK stream、JSON-RPC、remote-control 差异 | 禁止承载业务事件投影 |
| Capability / Policy Layer | 冻结 descriptor、capability、approval、health、fallback 策略 | 禁止 UI 猜测能力 |
| Extension / Raw Layer | 暴露 canonical 之外的 provider 原生能力 | 禁止污染公共接口 |

## 5. 标准包边界

BirdCoder 的长期目标包系应收敛为：

- `@sdkwork/birdcoder-engine`
- `@sdkwork/birdcoder-engine-types`
- `@sdkwork/birdcoder-engine-runtime`
- `@sdkwork/birdcoder-engine-transport`
- `@sdkwork/birdcoder-engine-registry`
- `@sdkwork/birdcoder-engine-codex`
- `@sdkwork/birdcoder-engine-claude`
- `@sdkwork/birdcoder-engine-gemini`
- `@sdkwork/birdcoder-engine-opencode`

### 5.1 现有仓库过渡规则

- 现有 `@sdkwork/birdcoder-chat` 与四个 `@sdkwork/birdcoder-chat-*` 包只作为兼容 facade。
- 新的 provider 真实实现应进入 `engine-*` 包系，而不是继续把完整能力压进 `chat-*`。
- `packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts` 继续作为当前注册中心入口，但后续 descriptor、catalog、capability 信息应逐步迁入 engine registry 层。

## 6. Canonical Domain Model

BirdCoder 统一的是下列运行时对象，而不是 provider 私有请求格式。

| 对象 | 说明 | 最小字段 |
| --- | --- | --- |
| `EngineDescriptor` | 静态元数据 | `engineKey`、`displayName`、`vendor`、`integrationClass`、`officialEntry`、`transportKinds`、`stabilityLevel` |
| `EngineSession` | 持续会话容器 | `sessionId`、`engineKey`、`modelId`、`transportKind`、`workingDirectory`、`approvalPolicy`、`nativeSessionRef` |
| `EngineTurn` | 一次输入驱动的执行轮次 | `turnId`、`sessionId`、`status`、`startedAt`、`completedAt` |
| `EngineMessage` | 稳定展示与审计消息 | `messageId`、`role`、`segments[]`、`status`、`visibility` |
| `EngineEvent` | 统一事件流 | `eventId`、`sessionId`、`turnId`、`kind`、`timestamp`、`payload` |
| `EngineArtifact` | 一等产物 | `artifactId`、`kind`、`status`、`summary`、`payload` |
| `ApprovalCheckpoint` | 审批与风险闸门 | `approvalId`、`scope`、`riskLevel`、`requestedAction`、`blocking` |
| `CapabilitySnapshot` | 运行时能力快照 | `declaredCapabilities`、`detectedCapabilities`、`experimentalCapabilities`、`disabledCapabilities` |

### 6.1 Canonical Event Kinds

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

### 6.2 Canonical Artifact Kinds

- `patch`
- `command-log`
- `todo-list`
- `pty-transcript`
- `preview-link`
- `test-result`
- `diagnostic-bundle`
- `question`
- `plan`
- `file-tree-delta`

## 7. Adapter Contract

每个 provider adapter 必须至少实现以下契约。

| Contract | 职责 | 说明 |
| --- | --- | --- |
| `EngineAdapter` | 统一入口 | 暴露 descriptor、models、capabilities、health、session factory |
| `SessionAdapter` | 会话生命周期 | `startSession`、`resumeSession`、`closeSession`、`sendTurn` |
| `EventNormalizer` | 原生流归一 | 把 provider event 转成 canonical event |
| `ArtifactProjector` | 产物投影 | 从 event 或 provider payload 生成 artifact |
| `ApprovalAdapter` | 审批映射 | 支持 `approve / deny / defer` |
| `ExtensionAdapter` | provider 原生能力旁路 | 必须显式访问 |
| `HealthAdapter` | 环境探测 | SDK 可用性、CLI、auth、版本、fallback 模式 |

### 7.1 HealthAdapter 最低要求

- 探测 SDK 包是否可用
- 探测 CLI 是否可用
- 探测认证配置是否满足
- 产出当前实际运行模式：`sdk`、`headless`、`remote-control`、`protocol-fallback`
- 产出版本兼容性与诊断消息

### 7.2 集成声明与运行健康的区别

- `describeIntegration()` 描述 BirdCoder 对该 provider 的标准接入策略，因此可以稳定标记为 `official-sdk`
- `getHealth()` 描述当前环境里真实选中的运行路径
- 当官方 SDK 包未安装时，`health.runtimeMode` 必须切换到补充官方路径，而不是继续伪装成 `sdk`
- Claude 本地 `external/claude-code` 仅作为协议/实现镜像，不得在 descriptor 中冒充官方 Agent SDK 包根
- OpenCode 本地官方 JavaScript SDK 包根应落实到 `external/opencode/packages/sdk/js`

## 8. Transport 标准

BirdCoder 允许的统一 transport kind 保持为：

- `cli-jsonl`
- `json-rpc-v2`
- `sdk-stream`
- `openapi-http`
- `remote-control-http`

### 8.1 使用规则

- `transport` 只负责连通性与协议 framing，不负责把 provider payload 投影成业务对象。
- `adapter` 可以组合多个 transport，但对上只暴露一个 canonical session。
- 同一 provider 若存在多条官方路径，应优先选择语义最完整的稳定路径。

## 9. Provider 归一化要求

### 9.1 Codex

- 主路径：`@openai/codex-sdk`
- 原生关键语义：`native thread -> turn -> item/event`
- 必须保留：native thread 连续性、turn 边界、item 粒度、`outputSchema`、resume、approval/sandbox 语义
- BirdCoder 重点：把 `item.*` 分解映射为 message、tool、artifact，而不是压缩成单条聊天文本

### 9.2 Claude

- 主路径：`@anthropic-ai/claude-agent-sdk`
- 稳定主语义：`query()` 流式消息
- 预览语义：V2 `createSession()` 模式
- 补充官方路径：headless CLI、remote-control
- 必须保留：agent session 语义、tool progress、approval、headless/remote host 可切换能力
- BirdCoder 重点：官方 SDK 优先；remote-control 是补充 transport，不再作为唯一主路径

### 9.3 Gemini

- 主路径：`@google/gemini-cli-sdk`
- 原生关键语义：`agent / session / tool / skill / context`
- 必须保留：tool registry、skills、dynamic instructions、transcript、cwd / fs / shell context
- BirdCoder 重点：统一 skill 与 tool 的注入与调度，不在 UI 层重新定义 provider tool contract

### 9.4 OpenCode

- 主路径：`@opencode-ai/sdk`
- 原生关键语义：`client / server / session / prompt / event.subscribe()`
- 必须保留：OpenAPI v2、structured output、`diff/todo/pty/question` 一等事件
- BirdCoder 重点：把 IDE 原生产物保持为 artifact，而不是退化为纯文本消息流

## 10. Source-Derived Fallback 规则

只有满足以下条件时才允许进入 `source-derived`：

- 官方无稳定 SDK
- 官方无可复用协议
- 当前功能仍有业务必要性
- 已在 descriptor、docs、health diagnostics 中标为 `source-derived`

### 10.1 禁止事项

- 禁止把源码镜像推断出的接口包装成“官方 SDK”
- 禁止让 UI 或业务层直接依赖镜像源码类型
- 禁止把 `source-derived` 能力标成 `stable`

## 11. 测试与治理标准

每个 provider 适配必须具备：

- descriptor contract test
- capability contract test
- event normalization contract test
- artifact projection contract test
- approval contract test
- health detection contract test
- fallback policy contract test

### 11.1 仓库级治理要求

- 页面层禁止直接 import 第三方 engine SDK
- 新增 engine 只能经 registry 注册，不得私接 UI
- `coding_session_event.kind` 只允许来自 canonical 集合
- `capabilitySnapshot` 必须区分 declared / detected / experimental / disabled
- provider 预览接口必须有 feature gate

## 12. 当前仓库落地基线

当前仓库中与本标准直接相关的事实如下：

- `packages/sdkwork-birdcoder-types/src/engine.ts` 已冻结 `engineKey`、`transportKinds`、`capabilityMatrix`
- `packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts` 已冻结四个 canonical engine id
- 现有 `chat-*` provider 包仍是 mock chat facade，不代表最终生产级适配架构
- 本标准要求后续实现从 `chat mock` 迁移到 `engine runtime` 中间层

## 13. 验收标准

- 同一会话在切换 provider 后，`session / turn / event / artifact / approval` 语义保持稳定
- 上层产品不因 provider 差异而产生私有会话 DTO
- 官方 SDK 可用时不退回源码镜像抽象
- 文档、descriptor、registry、实现代码四者对同一 provider 的主接入路径保持一致
