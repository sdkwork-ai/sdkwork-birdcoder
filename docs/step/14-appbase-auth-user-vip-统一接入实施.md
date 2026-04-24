# Step 14 - Appbase Auth、User、VIP 统一接入实施

## 1. 目标与范围

以 `sdkwork-appbase` 作为唯一标准源，完成 BirdCoder 身份体系的薄适配接入：

- 删除 BirdCoder 本地 appbase 聚合壳层思路
- 保留 `sdkwork-birdcoder-auth`、`sdkwork-birdcoder-user` 两个薄适配包
- 登录页、用户中心页、验证插件、runtime bridge、storage binding 全部复用 `sdkwork-appbase`
- 支持本地私有化部署和统一云端接入双模式

## 2. 执行输入

- `/docs/架构/17-appbase-auth-user-vip-统一接入标准.md`
- Step `04` 的上下文与设置语义
- 当前 BirdCoder 的认证、用户中心、VIP、runtime bridge、validation、storage 现状

## 3. 本步非目标

- 不新增 BirdCoder 专属登录业务分支
- 不为兼容旧方案保留双轨壳层
- 不在 BirdCoder 内复制 `sdkwork-appbase` 的页面、协议、验证、核心定义

## 4. 最小输出

- `sdkwork-birdcoder-auth` 薄适配完成
- `sdkwork-birdcoder-user` 薄适配完成
- 页面工厂改为 `sdkwork-appbase` canonical surface factory
- runtime/core/validation 统一走 `sdkwork-appbase`
- 删除 `sdkwork-birdcoder-appbase` 的所有事实来源
- 文档与 contract 同步到新标准

## 5. 推荐 review 产物

- definition/manifest 清单
- route intent 与页面工厂清单
- runtime/validation 依赖边界图
- `check:identity-standard` 结果

## 6. 推荐并行车道

- E1：definition / manifest / route intent / package meta
- E2：auth page、user center page、vip page 薄适配
- E3：runtime bridge、validation、storage binding
- E4：文档与 contract 清理

## 7. 架构能力闭环判定

- 页面不再重建共享 UI，只消费 canonical page factory
- BirdCoder 的 runtime 不再依赖 UI 包，而是依赖 canonical core/validation 包
- BirdCoder 不再存在 `sdkwork-birdcoder-appbase` 包或兼容壳
- 认证、用户中心、验证体系都可以在本地模式和上游统一模式之间切换

## 8. 完成后必须回写的文档

- `/docs/架构/17-appbase-auth-user-vip-统一接入标准.md`
- `/docs/架构/02-架构标准与总体设计.md`
- `/docs/架构/03-模块规划与边界.md`
- `/docs/架构/07-数据模型-状态模型-接口契约.md`
- `/docs/prompts/反复执行Step指令.md`

## 9. 设计约束

- 单一真相源是 `sdkwork-appbase`，不是 BirdCoder 本地再封一层 appbase 壳
- `sdkwork-birdcoder-auth` 与 `sdkwork-birdcoder-user` 允许存在，但必须薄
- 页面只保留 route、service、locale、controller 映射
- validation 插件必须独立存在，但定义和协议必须复用 `sdkwork-appbase`

## 10. 实施落地规划

1. 对齐 BirdCoder `auth`、`user`、`user-center`、`validation` definition。
2. 统一页面入口到 `createSdkworkCanonicalAuthSurfacePage(...)` 与 `createSdkworkCanonicalUserCenterSurfacePage(...)`。
3. 对齐 runtime bridge 到 `@sdkwork/user-center-core-pc-react` 与 `@sdkwork/user-center-validation-pc-react`。
4. 清除 contract、Step、Prompt、架构文档中的旧壳层真相。

## 11. 测试与验证

- `node scripts/auth-ui-standard-contract.test.mjs`
- `node --experimental-strip-types scripts/user-center-plugin-contract.test.ts`
- `node scripts/check-sdkwork-birdcoder-structure.mjs`

## 12. 结果验证

- BirdCoder 页面层已经成为 `sdkwork-appbase` 的薄适配样板
- BirdCoder runtime 已经与 UI 包解耦，只依赖 core/validation 标准
- 本地壳层不会回流

## 13. 检查点

- `CP14-1`：definition、manifest、route intent、package meta 冻结
- `CP14-2`：页面工厂切换完成
- `CP14-3`：runtime/validation 切换完成
- `CP14-4`：旧文档和旧 contract 已更新到新真相

## 14. 风险与回滚

- 风险：旧 contract 或旧文档继续强推已退役结构，导致后续改动回退
- 回滚：只允许回退某个薄适配实现，不允许恢复 BirdCoder 本地 appbase 聚合壳

## 15. 完成定义

- BirdCoder 的 Auth/User/VIP 接入已经完全以 `sdkwork-appbase` 为标准源
- BirdCoder 仅保留最小必要薄适配层
- 接口、验证、页面、runtime、文档、contract 全部一致
