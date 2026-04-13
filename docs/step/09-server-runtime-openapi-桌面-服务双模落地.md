# Step 09 - Server Runtime、OpenAPI 与桌面/服务双模落地

## 1. 目标与范围

收敛 `web / desktop / server` 的统一服务访问标准。所有宿主必须访问同一个 Rust `coding-server`，统一 `apiBaseUrl`、OpenAPI、DTO、错误模型与事件流协议。

## 2. 执行输入

- `/docs/架构/02`、`09`、`20`
- Step `05-08` 的 Session、Terminal、Studio、Code 标准

## 3. 本步非目标

- 不完成 App/Admin Console 细节
- 不替代 Step `17` 的全量生命周期 API 收口
- 不做发布闭环脚本

## 4. 最小输出

- 统一 `coding-server` 运行时基线
- 统一 `apiBaseUrl` 语义
- OpenAPI 生成链
- 双模访问与宿主身份标准

## 5. 推荐 review 产物

- 双模拓扑图
- `apiBaseUrl` 与 Host Identity 表
- OpenAPI/DTO 生成链说明

## 6. 推荐并行车道

- 执行模式：串行为主
- 车道 A1：Server Host/Runtime/OpenAPI
- 车道 A2：Host Identity/Runtime Descriptor
- 车道 F：双模 Smoke 脚手架

## 7. 架构能力闭环判定

- 三类宿主都访问同一服务协议
- DTO、错误模型、事件流不再分宿主定义

## 8. 完成后必须回写的架构文档

- `/docs/架构/02-架构标准与总体设计.md`
- `/docs/架构/09-安装-部署-发布标准.md`
- `/docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`

## 9. 设计

- `coding-server` 是唯一服务事实源
- OpenAPI 只是契约发布载体，DTO 主源仍在 `packages/sdkwork-birdcoder-types`
- Desktop 默认本地回环；Web 默认远程访问；Server 直接暴露同一协议

## 10. 实施落地规划

1. 冻结双模运行时、`apiBaseUrl`、Host Identity 字段。
2. 冻结 OpenAPI 生成与 SDK 消费链。
3. 收敛统一错误模型、Operation Descriptor、SSE 事件基线。
4. 输出 `17` 继续扩展 `core/app/admin` API 的稳定底座。

## 11. 测试计划

- Host Runtime Contract Test
- OpenAPI Contract Test
- 双模访问 Smoke

## 12. 结果验证

- Desktop 与 Server 都能通过同一协议访问 `coding-server`
- 页面不再维护私有 API 族

## 13. 检查点

- `CP09-1`：`coding-server` 基线冻结
- `CP09-2`：`apiBaseUrl` 语义冻结
- `CP09-3`：OpenAPI/DTO 主从关系冻结
- `CP09-4`：双模 Smoke 通过

## 14. 风险与回滚

- 风险：双模切换与 DTO 生成链不一致会造成后续 API 大面积返工
- 回滚：保留统一 `apiBaseUrl` 与 DTO 主源，不恢复宿主私有 API

## 15. 完成定义

- BirdCoder 已具备统一服务访问底座与双模运行时标准

## 16. 快速并行执行建议

- A1 先收敛 Server Host、OpenAPI、DTO 投影
- A2 并行收敛 Host Identity、Runtime Descriptor
- F 只做双模 Smoke 脚手架
- 最终由总控统一冻结 `apiBaseUrl`、错误模型、SSE 基线

## 17. 下一步准入条件

- `17` 可在统一服务底座上落地 `core/app/admin` API 与控制台

## 18. Current Loop Addendum - Architecture 09 Maturity Alignment

- Step 09 的统一服务底座已在后续 Step 17/18 闭环中继续落地为代表性 `core / app / admin` 实路由、canonical OpenAPI 导出与发布侧证据链。
- `docs/架构/README.md` 也必须复用同一成熟度摘要，不得回退到“最小 host 骨架、`core / app / admin` 仍属后续主线”的过时总览叙述。
- 活跃架构文档不得再把 Rust host 描述成仅暴露 `/health` 的最小占位态。
- PostgreSQL live smoke 已在当前主机记录 DSN-backed `passed` 报告；Step 09 当前只保留历史基线职责，不再作为活跃未闭环主线。
