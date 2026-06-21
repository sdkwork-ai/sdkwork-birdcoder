# 30-Kernel-BirdCoder-职责边界标准

## 1. 目标

冻结 `sdkwork-kernel` 与 BirdCoder 之间的职责分界，避免 agent 能力与编程工具底座再次耦合。

## 2. 不变（sdkwork-kernel 拥有）

- `agent.runtime` / `agent.model` / `agent.session` / `agent.tool` / `agent.policy` / `agent.event`
- `agent.adapter` / `agent.sdk.binding`
- 官方 SDK 绑定、CLI/IPC fallback、模型调用与 streaming turn 执行
- `code.workspace` / `code.vcs` / `code.patch` / `code.terminal` / `code.verification` 等 code-kernel 能力

## 3. 不变（BirdCoder 拥有）

- `coding_session*` 投影模型与 `coding-server` app/backend API
- `workbench.*` UI、终端启动、模型配置
- `codeengine.dialect` 与 `native-session.catalog`
- 引擎 descriptor / model catalog / access plan 的产品侧真相

## 4. 唯一集成边界

| 层 |  crate / 包 | 职责 |
|---|---|---|
| Rust bridge | `sdkwork-birdcoder-kernel-bridge` | bootstrap 四引擎 slot、`execute_kernel_turn`、`BirdcoderKernelHost` |
| Server wiring | `sdkwork-birdcoder-api-server` | `KernelBridgeCodeEngineProvider` 注入 coding-sessions service |
| TS runtime | `@sdkwork/birdcoder-pc-codeengine` → `kernelRuntime.ts` | `birdcoder-kernel-turn` 子进程 + `sendCanonicalEvents()` |
| 投影 | `@sdkwork/birdcoder-pc-projection` | canonical event / transcript / dialect 消费，不执行 agent turn |

## 5. 已退役表面

- `@sdkwork/birdcoder-pc-chat*` 与 per-engine TS adapter 包
- `scripts/codeengine-official-sdk-bridge.ts` Node 子进程 bridge
- `sdkwork-birdcoder-codeengine` 内 provider `execute_turn*` agent lane
- `RegistryCodeEngineProvider` / `execute_official_sdk_bridge_turn*`

## 6. 保留的过渡能力

- `sdkwork-birdcoder-codeengine` 内 **native session inventory**（Codex CLI sessions、SDK-bridge 持久化会话目录、OpenCode HTTP catalog）
- OpenCode approval / user-question **reply 路由** 已迁入 `sdkwork-birdcoder-kernel-bridge`（`live_interaction.rs`）；`opencode_provider` 仅保留 session catalog

## 7. 验收

- `pnpm run check:kernel-birdcoder-alignment`
- `cargo test -p sdkwork-birdcoder-kernel-bridge`
- `node scripts/birdcoder-kernel-integration-contract.test.mjs`
- `node --experimental-strip-types scripts/kernel-runtime-adapter-contract.test.ts`
- `node --experimental-strip-types scripts/codeengine-native-provider-completeness-contract.test.ts`
- provider 源码不得再出现 `execute_turn(`

## 8. 延伸阅读

- [31-集成实施方案](./31-Kernel-BirdCoder-集成实施方案.md)
- [32-对齐验收与核对清单](./32-Kernel-BirdCoder-对齐验收与核对清单.md)
- [反复执行Kernel对齐指令](../prompts/反复执行Kernel对齐指令.md)
- 机器可读任务：`specs/kernel-birdcoder-alignment.spec.json`
