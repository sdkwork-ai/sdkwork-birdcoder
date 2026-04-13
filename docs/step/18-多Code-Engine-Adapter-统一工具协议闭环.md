# Step 18 - 多 Code-Engine Adapter 与统一工具协议闭环

## 1. 目标与范围

把 `/docs/架构/21` 落到真实可执行 Step，完成 `Codex / Claude Code / Gemini / OpenCode` 的适配层、统一工具协议、统一审批语义、统一 Artifact 投影与 Conformance 验证。

## 2. 执行输入

- `/docs/架构/05`、`12`、`21`
- Step `05` 的 Engine SPI 与 Session 内核
- `external/` 中四类 Engine 源码快照与 SDK/协议资料

## 3. 本步非目标

- 不新增顶层 `conversation / chat_session / native_session` 等平行容器
- 不让页面直接消费 JSONL、JSON-RPC、原生 SDK payload
- 不绕过统一 Tool/Approval/Artifact/Audit 标准

## 4. 最小输出

- 四类 Engine Adapter
- Canonical Event 映射表
- Tool/Approval/Artifact 统一协议
- Engine Conformance Suite

## 5. 推荐 review 产物

- Engine Conformance Matrix
- Event 映射表
- Tool/Approval 统一语义表

## 6. 推荐并行车道

- 执行模式：条件并行
- 车道 E1：共享 Descriptor/Capability/Event/Approval
- 车道 E2：四类 Engine Adapter
- 车道 E3：Conformance/Test/文档回写

## 7. 架构能力闭环判定

- Engine 切换后 `message / event / artifact` 语义稳定
- Tool、Approval、Artifact、Audit 不再由页面做分引擎分支

## 8. 完成后必须回写的架构文档

- `/docs/架构/05-统一Kernel与Code Engine标准.md`
- `/docs/架构/12-统一工具协议-权限沙箱-审计标准.md`
- `/docs/架构/21-多Code-Engine协议-SDK-适配标准.md`

## 9. 设计

- 固定适配层：Transport -> Session -> Turn -> Event -> Tool -> Artifact -> Approval
- 固定主键：`codex / claude-code / gemini / opencode`
- 固定 Canonical Event 与 Capability Matrix

## 10. 实施落地规划

1. 冻结 Descriptor、Capability、Transport Kind、Approval Policy。
2. 分别实现四类 Engine 的 Transport/Session Adapter。
3. 收敛 Tool Bridge、Approval、Artifact、Resume/Recovery 语义。
4. 建立 Canonical Event 映射表与 Conformance Suite。

## 11. 测试计划

- `pnpm.cmd run test:engine-conformance`
- `pnpm.cmd run test:tool-protocol-contract`
- `pnpm.cmd run test:engine-resume-recovery-contract`

## 12. 结果验证

- 新增 Engine 只需补 Adapter，不需改主视图
- 原生异常都能落成标准事件并可审计、可恢复、可诊断

## 13. 检查点

- `CP18-1`：Descriptor/Capability/Approval Policy 冻结
- `CP18-2`：四类 Adapter 全部接入
- `CP18-3`：Canonical Event 映射冻结
- `CP18-4`：Conformance Suite 可重复执行

## 14. 风险与回滚

- 风险：Adapter 落地前先让页面直接接原生协议，会永久制造分叉
- 回滚：保留统一 Event/Tool/Artifact 主标准，只回退局部 Adapter 实现

## 15. 完成定义

- BirdCoder 已具备可扩展的多 Engine 适配层和统一工具协议

## 16. 快速并行执行建议

- E1 先冻结共享事件集、能力矩阵、审批策略
- E2 并行实现四类 Engine Adapter
- E3 最后补齐 Tool/Artifact/Resume Conformance 与文档回写

## 17. 下一步准入条件

- `12`、`17`、`13` 的质量门禁、统一 API 与发布闭环必须基于本步 Conformance 结果推进

## 18. 当前落地状态（2026-04-10）

- 已在 `packages/sdkwork-birdcoder-commons/src/workbench/runtime.ts` 落地共享 `WorkbenchCanonicalChatEngine`
- `createWorkbenchChatEngine()` 现默认返回带 `describeRuntime()` 与 `sendCanonicalEvents()` 的统一运行时包装层
- 当前四个引擎已统一投影 `session.started -> turn.started -> message.delta|completed -> tool.call.requested -> artifact.upserted -> approval.required -> operation.updated -> turn.completed|failed`
- `Codex / Claude Code / OpenCode` 的副作用型工具已统一进入 `approval.required`
- `Gemini` 的只读型工具已统一落入无审批的只读工具路径
- 已新增仓库级契约 `scripts/engine-runtime-adapter-contract.test.ts` 与根命令 `pnpm.cmd run test:engine-runtime-adapter`
- 同一 canonical runtime 现已继续下沉到 `coding-server`：
  - `executeBirdCoderCoreSessionRun()` 直接消费 `describeRuntime()` 与 `sendCanonicalEvents()`
  - `streamBirdCoderCoreSessionEventEnvelopes()` 直通 canonical event envelope
  - provider-backed projection persistence 已回写 `nativeRef.transportKind / nativeSessionId / capabilitySnapshot` 与 canonical events/artifacts
- 对应闭环已冻结在 `docs/step/18H-Coding-Server-Canonical-Runtime-Projection-Lane.md`
- 行业对标与能力矩阵类活跃文档不得再把 `coding-server` 描述成“最小 host 骨架”，也不得把 Step 18 当前主线描述成尚未落地的开放主线。
- Engine source-mirror、engine-truth promotion、Rust artifact adoption、route parity、release-flow governance 与 score-surface promotion 类活跃架构文档不得再把 Step 18B、18C、18D、18E 或 18F 写成当前 next target；这些车道都只保留为已关闭历史 follow-on。
- Step 18 score-surface 与 deterministic-baseline 活跃架构文档不得再把 `after PostgreSQL live-smoke recheck` 写成当前 next target；当前主机已记录 DSN-backed `passed`，未来循环只允许转向 next lowest-score non-environmental slice 或在 fresh failing evidence 下重开对应车道。
- 当前闭环级别：`server_projection_closure`
- Step 18 当前主线已闭环；后续只在新增引擎接入或 fresh failing evidence 出现时重新打开
