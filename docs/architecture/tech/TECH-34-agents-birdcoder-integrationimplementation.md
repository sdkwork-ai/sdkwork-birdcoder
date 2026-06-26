# TECH-34 Agents ↔ BirdCoder 集成实施方案

## 1. 依赖方向

```text
sdkwork-kernel (SPI + providers)
        ↑
sdkwork-agents-runtime-facade
        ↑
sdkwork-birdcoder-kernel-bridge (产品薄适配)
        ↑
BirdCoder coding-server / pc-codeengine
```

## 2. 已落地

| 组件 | 路径 | 说明 |
|---|---|---|
| Agents runtime host | `sdkwork-agents-runtime-facade/src/runtime_host.rs` | `AgentsCodeEngineHost` |
| Turn 执行 | `sdkwork-agents-runtime-facade/src/turn.rs` | `execute_code_engine_turn` |
| Engine catalog | `sdkwork-agents-runtime-facade/src/engine_catalog.rs` | facade + HTTP |
| Live interaction | `sdkwork-agents-runtime-facade/src/live_interaction.rs` | 可注册 per-engine handler |
| BirdCoder adapter | `sdkwork-birdcoder-kernel-bridge/src/host.rs` | 委托 facade + OpenCode handler |
| Agents HTTP catalog | `sdkwork-intelligence-agents-service` | `GET /app/v3/api/ai/code_engines` |
| MCP marketplace HTTP | `sdkwork-intelligence-agents-service` | `/app/v3/api/ai/mcp_servers` |
| Runtime executions | `runtime_facade_bridge.rs` | preview / prompt optimization |

## 3. BirdCoder bridge 瘦身规则

- `Cargo.toml` 仅允许 `sdkwork-agents-runtime-facade` + `sdkwork-birdcoder-codeengine`
- 禁止 `sdkwork-agent-kernel`、`sdkwork-code-kernel`、`sdkwork-agent-provider-*`
- 产品 prompt 构建保留在 `turn_executor.rs`，执行委托 facade

## 4. 延伸阅读

- [TECH-33 边界标准](./TECH-33-agents-birdcoder-boundariesstandard.md)
- [TECH-35 对齐验收](./TECH-35-agents-birdcoder-alignment.md)
- [sdkwork-agents AGENTS_LAYERING.md](../../../sdkwork-agents/docs/architecture/AGENTS_LAYERING.md)
