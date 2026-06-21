# BirdCoder 架构文档总览

本目录用于冻结 BirdCoder 的统一 Kernel、统一 `coding_session` 运行时、多 Code Engine 接入标准、`coding-server` 协议、治理与发布标准。

## 当前冻结重点

- 统一引擎主键固定为 `codex / claude-code / gemini / opencode`
- agent turn 执行归 `sdkwork-kernel`，BirdCoder 经 `sdkwork-birdcoder-kernel-bridge` 集成；细则见 [30-Kernel-BirdCoder-职责边界标准](./30-Kernel-BirdCoder-职责边界标准.md)
- `@sdkwork/birdcoder-pc-projection` 承担 canonical 投影与 dialect 消费，不执行 agent turn
- 上层产品层禁止直接依赖第三方 engine SDK，必须通过 kernel bridge + canonical runtime 访问
- 运行时主骨架固定为 `session / turn / message / event / artifact / checkpoint`
- `coding-server` 协议标准、代表性 `app / backend` 路由、canonical OpenAPI 导出与发布侧证据链已闭环；Rust host 不再处于最小 host 骨架阶段，Representative placeholder routes 当前真相为 `none`。
- PostgreSQL live smoke 已在当前主机记录 DSN-backed `passed` 报告；未来缺失 DSN/driver 时保持 `blocked`，未来 DSN-backed 运行时连通性回归时保持结构化 `failed`。

## 建议阅读顺序

1. [01-产品设计与需求范围](./01-产品设计与需求范围.md)
2. [04-技术选型与可插拔策略](./04-技术选型与可插拔策略.md)
3. [05-统一Kernel与Code Engine标准](./05-统一Kernel与Code%20Engine标准.md)
4. [30-Kernel-BirdCoder-职责边界标准](./30-Kernel-BirdCoder-职责边界标准.md)
5. [31-Kernel-BirdCoder-集成实施方案](./31-Kernel-BirdCoder-集成实施方案.md)
6. [32-Kernel-BirdCoder-对齐验收与核对清单](./32-Kernel-BirdCoder-对齐验收与核对清单.md)
7. [21-多Code-Engine协议-SDK-适配标准](./21-多Code-Engine协议-SDK-适配标准.md)
8. [20-统一Rust-Coding-Server-API-协议标准](./20-统一Rust-Coding-Server-API-协议标准.md)
9. [11-行业对标与能力矩阵](./11-行业对标与能力矩阵.md)

## 配套技术文档

- [Engine SDK Integration](../reference/engine-sdk-integration.md)
- [Kernel 对齐 spec](../../specs/kernel-birdcoder-alignment.spec.json)
- [反复执行 Kernel 对齐指令](../prompts/反复执行Kernel对齐指令.md)

## 总体验收维度

- 架构一致性：分层、命名、接口、能力边界一致
- 会话一致性：切换引擎后 `session / turn / event / artifact / approval` 语义稳定
- 接口一致性：`web / desktop / server` 共享同一套 server contract
- 治理一致性：规则、技能、审批、审计、发布证据形成闭环
