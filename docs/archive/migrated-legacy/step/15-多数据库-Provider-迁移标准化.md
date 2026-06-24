# Step 15 - 多数据库 Provider 与迁移标准化

## 1. 目标与范围

把 `/docs/架构/18` 落成可执行 Step，统一 `sqlite / postgresql` Provider、Dialect、Schema Migration、BlobStore 与 authority 模式，保证桌面、本地缓存、Server 协作共享同一逻辑模型与 Repository 契约。

## 2. 执行输入

- `/docs/架构/07`、`18`
- Step `03` 的实体、DTO、Repository 主标准
- `Code / Studio / Server` 的持久化消费需求，以及外部 Terminal 摘要/证据引用需求

## 3. 本步非目标

- 不重新定义领域实体与 DTO
- 不让页面直接感知 Provider 细节
- 不引入长期兼容旧表的双轨运行

## 4. 最小输出

- Provider/Dialect 标准
- Migration/BlobStore 标准
- authority 模式定义
- 多库 Contract Test

## 5. 推荐 review 产物

- Provider 能力表
- 字段映射与事务边界表
- Migration ID 与补偿策略说明

## 6. 推荐并行车道

- 执行模式：条件并行
- 车道 E1：Provider/Dialect
- 车道 E2：Migration/BlobStore
- 车道 E3：authority 模式与 Contract Test

## 7. 架构能力闭环判定

- 同一 Repository 在 `sqlite / postgresql` 下语义一致
- 新 Provider 只需扩展 `Dialect / Provider / Migration / BlobStore`

## 8. 完成后必须回写的架构文档

- `/docs/架构/07-数据模型-状态模型-接口契约.md`
- `/docs/架构/18-多数据库抽象-Provider-迁移标准.md`

## 9. 设计

- 固定链路：`Domain -> Repository -> UoW -> Provider -> Dialect -> Migration -> BlobStore`
- 固定 authority：`standalone-desktop`、`server-collaboration`、`hybrid-edge`
- `localStorage` 只做浏览器轻缓存，不进入权威存储链
- Node 直跑合同允许共享 in-memory fallback，但它只服务测试链，不计入 authority 存储

## 10. 实施落地规划

1. 冻结 `schema_migration_history`、`migrationId`、补偿迁移规则。
2. 收敛 `sqlite / postgresql` 字段映射、占位符、事务边界。
3. 建立统一 Repository Contract Test，并先落地 provider-scoped table repository adapter 作为真实 SQL Provider 之前的共享接口层。
4. 明确 BlobStore 对大日志、补丁、预览、测试证据的落点规则。

## 11. 测试计划

- `pnpm.cmd run check:data-kernel`
- `pnpm.cmd run test:storage-provider-contract`
- `pnpm.cmd run test:migration-replay`

## 12. 结果验证

- 多库切换不改变业务 API
- 多模式下 schema、迁移、回放语义稳定
- `coding-server` projection 已能在共享 data-kernel table repository 上验证 provider 隔离语义

## 13. 检查点

- `CP15-1`：Provider/Dialect/Migration 分层冻结
- `CP15-2`：多库 Contract Test 通过
- `CP15-3`：三类 authority 模式冻结

## 14. 风险与回滚

- 风险：在实体未冻结前做多库适配会造成 schema 漂移
- 回滚：回退到统一 Repository 主标准，不保留 Provider 私有分叉

## 15. 完成定义

- BirdCoder 已具备可扩展的多数据库 Provider 与迁移能力

## 16. 快速并行执行建议

- E1 先收敛 `sqlite / postgresql` Dialect
- E2 并行推进 Migration、BlobStore、补偿回滚
- E3 最后补 Contract Test 与 authority 模式文档

## 17. 下一步准入条件

- `11`、`12`、`17` 涉及存储、部署、治理的实现必须以本步结果为准
