# 32-Kernel-BirdCoder-对齐验收与核对清单

## 1. 用途

本文提供 **可反复执行的 TODO 与验收清单**。状态以 `specs/kernel-birdcoder-alignment.spec.json` 为机器真相；修改任务状态时必须同步更新该 JSON，再运行核对命令。

## 2. 反复核对循环（每轮必做）

```bash
# 1. 机器核对（证据 + gate 任务）
pnpm run check:kernel-birdcoder-alignment

# 2. 构建 kernel turn 二进制（TS 契约依赖）
cargo build -p sdkwork-birdcoder-kernel-bridge --bin birdcoder-kernel-turn

# 3. Rust 测试
cargo test -p sdkwork-birdcoder-kernel-bridge

# 4. 核心契约批次
pnpm run test:birdcoder-kernel-integration-contract
pnpm run test:engine-runtime-adapter
pnpm run test:engine-kernel-contract
pnpm run test:codeengine-native-provider-completeness-contract
pnpm run test:codeengine-official-sdk-bridge-contract

# 5. 结构与类型
pnpm run typecheck
pnpm run check:arch
pnpm run check:sdkwork-birdcoder-structure
```

任一失败：**停止宣称对齐完成**，修复后从步骤 1 重跑。

更完整的 agent 执行指令见 [反复执行Kernel对齐指令](../prompts/反复执行Kernel对齐指令.md)。

## 3. Gate 任务清单（BirdCoder 侧必须 done）

| ID | 标题 | 状态 | 验收命令 |
| --- | --- | --- | --- |
| KBA-BC-01 | kernel-bridge crate | done | `cargo test -p sdkwork-birdcoder-kernel-bridge` |
| KBA-BC-02 | api-server KernelBridge 接线 | done | `test:engine-runtime-adapter` |
| KBA-BC-03 | TS kernelRuntime | done | `test:engine-conformance` |
| KBA-BC-04 | pc-projection / pc-chat 退役 | done | `test:birdcoder-kernel-integration-contract` |
| KBA-BC-05 | codeengine 瘦身 | done | `test:codeengine-native-provider-completeness-contract` |
| KBA-BC-06 | 契约迁移 | done | `check:kernel-birdcoder-alignment` |
| KBA-DOC-01 | 文档 30–32 + spec | done | `check:kernel-birdcoder-alignment` |
| KBA-DOC-02 | engine-sdk-integration 更新 | done | `check:kernel-birdcoder-alignment` |
| KBA-BC-08 | legacy-archive 退役 | done | `legacy-src-host-retirement-contract` |
| KBA-BC-09 | 浏览器/Node kernel turn 边界 | done | `test:birdcoder-kernel-integration-contract` |

**Gate 规则**：`gate: true` 且 `status !== "done"` 时，`check:kernel-birdcoder-alignment` 必须失败。

## 4. 跟踪任务（非 gate，跨仓库或后续波次）

| ID | Owner | 标题 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| KBA-K-01 | kernel | 四引擎 sdk_integration | done | binding manifest 已存在 |
| KBA-K-02 | kernel | release mock fail-closed | done | `development_mock_fallback_enabled` + adapter guards |
| KBA-K-03 | kernel | 真实 SDK backend | done | `engine-sdk-live.mjs` + 四引擎 adapter sdk_integration |
| KBA-K-04 | kernel | KERNEL_PRODUCT_PROJECTION_SPEC | done | `sdkwork-kernel/specs/KERNEL_PRODUCT_PROJECTION_SPEC.md` |
| KBA-BC-07 | birdcoder | OpenCode live interaction → kernel | done | `kernel-bridge/live_interaction.rs` |

完成非 gate 任务后：更新 `specs/kernel-birdcoder-alignment.spec.json` 中对应 `status` 为 `done`，并回写本文表格。

## 5. 禁止项核对（自动化）

`check:kernel-birdcoder-alignment` 与下列契约共同保证无技术债务回潮：

| 禁止 | 核对方式 |
| --- | --- |
| `RegistryCodeEngineProvider` | `kernel-runtime-adapter-contract` |
| `execute_turn(` in `*_provider.rs` | alignment spec forbiddenPatterns |
| `execute_official_sdk_bridge_turn` | `codeengine-official-sdk-bridge-contract` |
| `pc-chat*` 包目录 | alignment spec forbiddenPaths |
| `codeengine-official-sdk-bridge.ts` | alignment spec forbiddenPaths |
| TS `officialSdkBridgeLoader` in kernelRuntime | alignment spec forbiddenPatterns |
| `src-host/legacy-archive/` 目录 | alignment spec forbiddenPaths + `legacy-src-host-retirement-contract` |

## 6. 文档一致性核对

每轮对齐后确认：

- [x] `docs/架构/30` 与 `boundaries.rs` 能力表一致
- [x] `docs/架构/31` 文件路径与仓库实际路径一致
- [x] `docs/reference/engine-sdk-integration.md` 以 kernel-bridge 为当前执行路径
- [x] `docs/架构/README.md` 阅读顺序含 30、31、32
- [x] `specs/README.md` 索引 `kernel-birdcoder-alignment.spec.json`

## 7. 完成定义（BirdCoder 仓库）

在 **本仓库** 宣称 Kernel 对齐完成，须同时满足：

1. 所有 **gate** 任务 `status: done`
2. §2 核对循环全部绿色
3. 无 `pc-chat*`、无 codeengine agent turn、无 Node SDK bridge turn
4. `pnpm run lint` 通过（或仅存在与本次无关的已知宿主 toolchain 警告并记录在 release note）

**生产就绪**  additionally 需要 sdkwork-kernel KBA-K-02～KBA-K-04 均为 `done`（跨仓库；当前 spec 已对齐）。

## 8. 状态更新流程

1. 实现代码或文档变更
2. 运行 §2 核对循环
3. 更新 `specs/kernel-birdcoder-alignment.spec.json` 中任务 `status`
4. 同步更新本文 §3、§4 表格
5. 若行为面变化，更新 `docs/架构/31` 与相关 step/release 文档
