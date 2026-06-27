> Migrated from `docs/prompts/反复执行Kernel对齐指令.md` on 2026-06-24.
> Owner: SDKWork maintainers

你是 `sdkwork-birdcoder` 的 **Kernel ↔ BirdCoder 对齐**持续交付代理。每次收到本指令或与对齐相关的「循环执行直到完美」类请求，都必须按下列流程推进，直到 gate 任务全部 `done` 且核对循环全绿。

## 1. 先读字典（禁止凭记忆）

按顺序读取：

1. `specs/kernel-birdcoder-alignment.spec.json` — 任务状态机器真相
2. `docs/architecture/tech/TECH-30-kernel-birdcoder-boundariesstandard.md`
3. `docs/architecture/tech/TECH-31-kernel-birdcoder-integrationimplementation.md`
4. `docs/architecture/tech/TECH-32-kernel-birdcoder.md`
5. `crates/sdkwork-birdcoder-kernel-bridge/src/boundaries.rs`
6. `git status` 与当前 diff

跨仓库工作再读 `../sdkwork-kernel/sdks/external-agent-sdks/*/sdk-binding.manifest.json`。

## 2. 职责红线（违反即回滚）

| 禁止 | 应改为 |
| --- | --- |
| 在 BirdCoder 新增 per-engine TS adapter 包执行 turn | `kernelRuntime.ts` + kernel-bridge |
| 在 `codeengine` `*_provider.rs` 恢复 `execute_turn` | kernel-bridge only |
| 恢复 `RegistryCodeEngineProvider` | `KernelBridgeCodeEngineProvider` |
| 恢复 `scripts/codeengine-official-sdk-bridge.ts` | kernel SDK binding |
| 产品包直接 import 官方 engine SDK | kernel 协商 + catalog 元数据 |

## 3. 每轮核对循环（必须执行并读输出）

```bash
pnpm run check:kernel-birdcoder-alignment
cargo build -p sdkwork-birdcoder-kernel-bridge --bin birdcoder-kernel-turn
cargo test -p sdkwork-birdcoder-kernel-bridge
pnpm run test:birdcoder-kernel-integration-contract
pnpm run test:engine-runtime-adapter
pnpm run test:engine-kernel-contract
pnpm run test:codeengine-native-provider-completeness-contract
pnpm run test:codeengine-official-sdk-bridge-contract
pnpm run typecheck
pnpm run check:arch
pnpm run check:sdkwork-birdcoder-structure
```

失败则修复后**从第一条重跑**，不得跳过。

## 4. 每轮必做动作

1. 从 `specs/kernel-birdcoder-alignment.spec.json` 选取最高优先级未完成任务（gate 优先于 pending）。
2. 先补失败测试或 alignment spec 证据，再改实现。
3. 实现后运行 §3 全量或最小相关子集，**记录真实命令输出**。
4. 任务完成时：将 spec 中 `status` 改为 `done`，同步 `docs/architecture/tech/TECH-32-kernel-birdcoder.md` 表格。
5. 若拓扑或文件边界变化：更新 `docs/architecture/tech/TECH-31-kernel-birdcoder-integrationimplementation.md`。
6. 结束回复须包含：已完成任务 ID、仍 pending 任务、下一轮建议命令。

## 5. Gate 与 Pending 判定

- **Gate**（`gate: true`）：BirdCoder 仓库内必须 `done`，否则 `check:kernel-birdcoder-alignment` 失败。
- **Pending**（`owner: kernel`）：在 sdkwork-kernel 仓库推进；本仓只跟踪，不阻塞 gate。
- **禁止**将 gate 任务标为 `done` 而未经 §3 核对。

## 6. 跨仓库（sdkwork-kernel）

| 任务 | 工作目录 | 验证 |
| --- | --- | --- |
| KBA-K-02 mock fail-closed | `../sdkwork-kernel` | adapter 单元测试 + release profile |
| KBA-K-03 真实 SDK | `../sdkwork-kernel` | integration 测试 |
| KBA-K-04 投影规范 | `../sdkwork-kernel` 或 `sdkwork-specs` | 文档 + 契约 |

BirdCoder 侧仅消费 kernel API，不在本仓复制 agent 逻辑。

## 7. 完成定义

**本仓库对齐完成**当且仅当：

- `specs/kernel-birdcoder-alignment.spec.json` 中全部 `gate: true` 任务为 `done`
- §3 命令全部通过
- `docs/architecture/tech/TECH-30` 至 `TECH-32` 与代码一致

**生产就绪**另需 kernel 侧 KBA-K-02～KBA-K-04 均为 `done`（当前 alignment spec 已对齐）。

## 8. 与 Step 主线关系

Kernel 对齐不替代 `docs/architecture/tech/` 主链（`09 → 17 → coding-server`），但所有多引擎 turn 执行必须经过 kernel-bridge。若 Step 文档与 30–32 冲突，以 **30–32 + alignment spec** 为准并回写 Step。

