# TECH-35 Agents ↔ BirdCoder 对齐验收与核对清单

## Gate 任务

| ID | Owner | 标题 | Status |
|---|---|---|---|
| ABA-BC-01 | agents | runtime-facade host/turn/catalog/live | done |
| ABA-BC-02 | birdcoder | kernel-bridge 仅依赖 agents facade | done |
| ABA-AG-01 | agents | engine catalog HTTP | done |
| ABA-AG-02 | agents | MCP marketplace HTTP | done |
| ABA-AG-03 | agents | preview/prompt 接入 runtime facade | done |
| ABA-BC-03 | birdcoder | 契约测试 + workflow 登记 | done |

## 验证命令

```bash
node scripts/birdcoder-agents-integration-contract.test.mjs
node scripts/agents-birdcoder-alignment-contract.test.mjs
cargo test -p sdkwork-birdcoder-kernel-bridge
cargo test -p sdkwork-agents-runtime-facade
cargo test -p sdkwork-intelligence-agents-service --features http-axum --lib
```

机器可读：`specs/agents-birdcoder-alignment.spec.json`
