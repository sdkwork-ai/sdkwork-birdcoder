# Step 14 - Appbase Auth、User、VIP 统一接入实施

## 1. 目标与范围

用 `sdkwork-birdcoder-appbase` 取代本地平行 `auth / user / vip` 模块，统一身份、用户、会员边界，并让 Shell、架构文档、Prompt、Release 记录全部以 appbase bridge 为准。

## 2. 执行输入

- `/docs/架构/17`
- Step `04` 的上下文与设置语义
- 当前 `auth / user / vip` 本地模块与 appbase bridge 现状

## 3. 本步非目标

- 不新增身份、会员业务
- 不保留长期双轨兼容
- 不在 BirdCoder 内重复维护 appbase 主模型

## 4. 最小输出

- `appbase` bridge
- registry/manifest/package meta
- route intent 与 storage scope
- Shell 切换方案
- 旧模块移除清单

## 5. 推荐 review 产物

- bridge 清单
- route intent 表
- parity contract 结果

## 6. 推荐并行车道

- 执行模式：条件并行
- 车道 E1：bridge/manifest/package meta
- 车道 E2：页面与 Shell 消费切换
- 车道 E3：旧模块清理与文档回写

## 7. 架构能力闭环判定

- Shell 不再直依赖本地 `auth / user / vip`
- BirdCoder 只维护扩展绑定与投影，不再维护平行主边界

## 8. 完成后必须回写的架构文档

- `/docs/架构/17-appbase-auth-user-vip-统一接入标准.md`

## 9. 设计

- 单包统一：catalog、registry、manifest、route intent、storage
- 本地 `auth / user / vip` 只允许清理，不允许继续扩展
- 页面与 Shell 只消费 `sdkwork-birdcoder-appbase`

## 10. 实施落地规划

1. 建立 capability catalog 与 source package 映射。
2. 建立 appbase registry、workspace manifest、route intent、package meta。
3. 统一 storage scope 与登录/用户/VIP 入口。
4. 切换 Shell 依赖并清理旧模块壳。

## 11. 测试计划

- Appbase parity contract
- Shell/页面入口回归
- 结构与边界检查

## 12. 结果验证

- `appbase` 成为唯一身份/用户/会员边界
- 结构检查持续阻断本地平行模块回流

## 13. 检查点

- `CP14-1`：bridge 与 manifest 冻结
- `CP14-2`：Shell 消费已切换
- `CP14-3`：旧模块已清理并被检查脚本阻断

## 14. 风险与回滚

- 风险：桥接能力不全会导致 Shell 与页面残留旧依赖
- 回滚：保持 `appbase` 为主边界，只回退桥接实现，不恢复本地平行模块

## 15. 完成定义

- BirdCoder 的 Auth/User/VIP 已完全归一到 `appbase`

## 16. 快速并行执行建议

- E1 先补 bridge、manifest、package meta
- E2 并行切页面与 Shell
- E3 最后清理旧包、补检查与文档回写

## 17. 下一步准入条件

- `17` 的 App/Admin 生命周期资源与权限治理可直接基于 appbase 边界推进

