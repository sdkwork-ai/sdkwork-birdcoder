# Step 04 - Workspace、Project、Auth、Settings 治理

## 1. 目标与范围

把工作区、项目、认证、设置从页面私有状态和散落存储中抽离出来，收敛为统一服务层和统一持久化桥。

## 2. 执行输入

- `/docs/架构/03`、`07`、`15`、`17`
- Step `03` 数据与 DTO 主标准

## 3. 本步非目标

- 不新做 Auth/VIP 业务功能
- 不直接替代 Step `14` 的 appbase 总接入
- 不落地 CLI 或多数据库细节

## 4. 最小输出

- Workspace/Project 服务接口
- Settings/Preference 服务接口
- Auth 边界与 appbase 对接点
- 恢复与切换语义标准

## 5. 推荐 review 产物

- Context 边界图
- 恢复语义清单
- 旧键迁移与硬切换说明

## 6. 推荐并行车道

- 执行模式：串行收口
- 车道 A：Workspace/Project
- 车道 B：Auth/Settings
- 车道 C：迁移与持久化桥

## 7. 架构能力闭环判定

- 页面层不再直接管理核心工作台状态
- Workspace/Project/Auth/Settings 切换与恢复语义稳定

## 8. 完成后必须回写的架构文档

- `/docs/架构/03-模块规划与边界.md`
- `/docs/架构/07-数据模型-状态模型-接口契约.md`
- `/docs/架构/15-工作台偏好-终端运行时-本地存储补充标准.md`
- `/docs/架构/17-appbase-auth-user-vip-统一接入标准.md`

## 9. 设计

- 工作台上下文是统一服务，不是页面状态拼装
- Auth/User/VIP 主边界继续由 `appbase` 维护
- Settings 与 Preference 必须支持稳定恢复与跨宿主一致

## 10. 实施落地规划

1. 梳理当前 Context、Mock Service、存储键使用点。
2. 收敛到统一 Service Interface 与持久化入口。
3. 建立一次性旧数据清理与硬切换脚本。
4. 回归项目切换、设置恢复、登录态恢复。

## 11. 测试计划

- 项目切换与恢复回归
- 设置默认值、升级、恢复回归
- Web/Desktop 登录态恢复一致性测试

## 12. 结果验证

- Workspace/Project/Auth/Settings 不再在各页面私有分叉
- `05`、`08`、`14` 能共享同一上下文语义

## 13. 检查点

- `CP04-1`：上下文边界冻结
- `CP04-2`：统一服务接口与迁移路径完成
- `CP04-3`：恢复回归通过

## 14. 风险与回滚

- 风险：状态键硬切换不完整会造成恢复失效
- 回滚：若恢复语义异常，回退到统一服务接口，不恢复散乱页面状态

## 15. 完成定义

- 工作台上下文已从页面私有状态提升为统一服务能力

## 16. 快速并行执行建议

- A 车道先收敛 Workspace/Project
- B 车道并行收敛 Auth/Settings
- C 车道最后补迁移脚本与持久化桥
- 最终统一冻结 ID、键名、恢复语义

## 17. 下一步准入条件

- Engine 偏好、Terminal 恢复、appbase 接入所依赖的上下文语义已稳定

