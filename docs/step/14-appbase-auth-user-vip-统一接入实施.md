# Step 14 - Appbase Auth/User/VIP 统一接入实施

## 1. 目标与范围

- 以 `sdkwork-appbase` 作为唯一 IAM/user-center/VIP 标准源，完成 BirdCoder 薄适配接入。
- 移除 BirdCoder 本地 appbase 聚合壳层和旧 IAM 重复实现。
- 保留 `@sdkwork/birdcoder-iam` 聚合入口，以及 `@sdkwork/birdcoder-auth`、`@sdkwork/birdcoder-user` 薄适配包。
- 登录页、用户中心页、VIP 页、验证插件、runtime bridge、storage binding 全部复用 appbase canonical 能力。
- 支持本地私有化部署和统一云端接入双模。

## 2. 执行输入

- `/docs/架构/17-appbase-auth-user-vip-统一接入标准.md`
- `../../specs/README.md`
- `../../specs/IAM_SPEC.md`
- 当前 BirdCoder 的认证、用户中心、VIP、runtime bridge、validation 和 storage 现状。

## 3. 本步非目标

- 不新增 BirdCoder 专属登录业务分支。
- 不为兼容旧方案保留双轨壳层。
- 不在 BirdCoder 内复制 appbase 的页面、协议、验证或核心 IAM 定义。
- 不改动非 IAM 业务域，除非它们直接引用了已退役的 IAM 表或语义。

## 4. 最小输出

- `@sdkwork/birdcoder-iam` 聚合入口只编排 appbase/BirdCoder 薄适配能力。
- `@sdkwork/birdcoder-auth` 薄适配完成。
- `@sdkwork/birdcoder-user` 薄适配完成。
- 页面工厂改为 appbase canonical surface factory。
- runtime/core/validation 统一来自 appbase user-center/core/validation 包。
- BirdCoder data kernel 移除 appbase-owned IAM 实体和旧核心 IAM 表。
- 文档与 contract 同步到 `iam` 标准命名。

## 5. 推荐 Review 产物

- IAM definition、manifest、route intent、package meta 清单。
- 页面 factory 和 route intent 对齐清单。
- runtime/validation 依赖边界。
- data-kernel appbase-owned IAM 实体移除清单。
- `check:iam-standard`、`test:user-center-standard`、`check:data-kernel` 结果。

## 6. 推荐并行车道

- E1：definition、manifest、route intent、package meta。
- E2：auth page、user center page、VIP page 薄适配。
- E3：runtime bridge、validation、storage binding。
- E4：data-kernel IAM duplicate removal。
- E5：文档与 contract 清理。

## 7. 架构能力闭环判定

- 页面不再重建共享 UI，只消费 canonical page factory。
- BirdCoder runtime 不再依赖 UI 包，而是依赖 canonical core/validation 包。
- BirdCoder 不再存在本地 appbase 壳包或兼容壳。
- BirdCoder 不再拥有 appbase-owned IAM 表、实体、业务逻辑和 API。
- 认证、用户中心和验证体系都可以在本地模式和上游统一模式之间切换。

## 8. 完成后必须回写的文档

- `/docs/架构/17-appbase-auth-user-vip-统一接入标准.md`
- `/docs/架构/07-数据模型-状态模型-接口契约.md`
- `/docs/step/14-appbase-auth-user-vip-统一接入实施.md`
- 相关 contract 和质量门禁脚本。

## 9. 设计约束

- 单一真相源是 `sdkwork-appbase`。
- BirdCoder 允许存在薄适配包，但不得把薄适配升级为 IAM 权威实现。
- 页面只保留 route、service、locale、controller 映射。
- validation 插件必须独立存在，但定义和协议必须复用 appbase。
- 本地私有化 IAM 存储必须使用 appbase native runtime 和 `iam_` 表标准。

## 10. 实施落地规划

1. 对齐 BirdCoder `auth`、`user`、`user-center`、`validation` definition。
2. 统一页面入口到 appbase canonical page factory。
3. 对齐 runtime bridge 到 `@sdkwork/user-center-core-pc-react` 与 `@sdkwork/user-center-validation-pc-react`。
4. 清理 BirdCoder data kernel 中 appbase-owned IAM 实体、旧 `plus_*` 核心 IAM 表和描述残留。
5. 清除 contract、Step、Prompt、架构文档中的旧域命名和旧壳层真相。

## 11. 测试与验证

- `node scripts/auth-ui-standard-contract.test.mjs`
- `node scripts/birdcoder-iam-standard-contract.test.mjs`
- `node scripts/user-center-plus-entity-standard-contract.test.mjs`
- `node --experimental-strip-types scripts/user-center-plugin-contract.test.ts`
- `node --experimental-strip-types scripts/data-kernel-contract.test.mjs`
- `node --experimental-strip-types scripts/provider-dialect-contract.test.mjs`
- `pnpm check:iam-standard`
- `pnpm test:user-center-standard`
- `pnpm check:data-kernel`

## 12. 结果验证

- BirdCoder 页面层已经成为 appbase 的薄适配样板。
- BirdCoder runtime 已经与 UI 包解耦，只依赖 core/validation 标准。
- BirdCoder data kernel 不再生成 appbase-owned IAM 表。
- 本地壳层不会回流。

## 13. 检查点

- `CP14-1`：definition、manifest、route intent、package meta 冻结。
- `CP14-2`：页面工厂切换完成。
- `CP14-3`：runtime/validation 切换完成。
- `CP14-4`：appbase-owned IAM 实体移除完成。
- `CP14-5`：文档与 contract 命名统一到 `iam`。