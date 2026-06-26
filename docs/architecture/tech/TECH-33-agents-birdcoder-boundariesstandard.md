# TECH-33 Agents ↔ BirdCoder 职责边界标准

## 1. 目标

冻结 `sdkwork-agents` 与 BirdCoder 之间的职责分界。产品应用不得直接依赖 `sdkwork-agent-kernel` 或 `sdkwork-agent-provider-*`。

## 2. sdkwork-agents 拥有

- `agents-runtime-facade`：code engine bootstrap、turn 执行、engine catalog、live interaction 路由
- `agents-engine-catalog-api`：统一 engine/model catalog HTTP
- Managed agents CRUD、provider bindings、deployments、composition slots
- MCP marketplace HTTP 与 persistence
- Preview / prompt optimization 运行时执行（经 runtime facade 调用 kernel provider）

## 3. BirdCoder 拥有

- `coding_session*` 投影与 coding-server API
- `codeengine.dialect` 与 native-session catalog
- workbench UI、终端、模型配置
- 产品侧 prompt 构建（`build_codeengine_turn_prompt`）与 OpenCode live reply 适配

## 4. 唯一集成边界

| 层 | crate / 包 | 职责 |
|---|---|---|
| Agents facade | `sdkwork-agents-runtime-facade` | 产品运行时唯一 Rust 入口 |
| BirdCoder adapter | `sdkwork-birdcoder-kernel-bridge` | 薄适配：coding_session 类型转换 + OpenCode live handler 注册 |
| Server wiring | `sdkwork-birdcoder-api-server` | `KernelBridgeCodeEngineProvider` |
| TS runtime | `@sdkwork/birdcoder-pc-codeengine` | `birdcoder-kernel-turn` 子进程 |

## 5. 验收

- `node scripts/birdcoder-agents-integration-contract.test.mjs`
- `node scripts/agents-birdcoder-alignment-contract.test.mjs`
- `cargo test -p sdkwork-birdcoder-kernel-bridge`
- `cargo test -p sdkwork-agents-runtime-facade`

机器可读任务：`specs/agents-birdcoder-alignment.spec.json`
