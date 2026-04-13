# 17-Appbase Auth/User/VIP 统一接入标准

## 1. 目标
- `auth`、`user`、`vip` 必须统一收敛到 `packages/sdkwork-birdcoder-appbase`。
- BirdCoder 不再保留独立 `sdkwork-birdcoder-auth`、`sdkwork-birdcoder-user`、本地独立 `vip` 包作为当前有效边界。
- 统一对齐 `sdkwork-appbase` 的 capability 模型：`identity.auth`、`identity.user`、`commerce.vip`。

## 2. 边界
- `sdkwork-birdcoder-appbase`：统一暴露 `catalog / registry / appbase manifest / auth-user-vip workspace manifest / package meta / route intent / storage / pages`。
- `sdkwork-birdcoder-shell`：只消费 `sdkwork-birdcoder-appbase`，不直接依赖旧身份模块。
- `sdkwork-birdcoder-infrastructure`：只保留通用认证服务接口与运行时实现，不承载独立页面模块。
- `code/studio/terminal/settings`：只读取统一身份、用户、会员状态，不自建平行模型。

## 3. 包级标准
- `auth`：必须提供 `createBirdCoderAuthWorkspaceManifest(...)`、`createAuthWorkspaceManifest(...)`、`authPackageMeta`，并统一登录、注册、找回密码、OAuth 回调、扫码入口。
- `user`：必须提供 `createBirdCoderUserWorkspaceManifest(...)`、`createUserWorkspaceManifest(...)`、`createBirdCoderUserSectionRouteIntent(...)`、`createUserSectionRouteIntent(...)`、`userPackageMeta`。
- `vip`：必须提供 `createBirdCoderVipWorkspaceManifest(...)`、`createVipWorkspaceManifest(...)`、section-aware route intent、`vipPackageMeta`。
- 默认路由标准对齐上游：`/auth/login`、`/auth/register`、`/auth/forgot-password`、`/auth/oauth/callback/:provider`、`/auth/qr-login`、`/user`、`/user/sections/:sectionId`、`/vip`。

## 4. Registry / Manifest 标准
- appbase bridge 必须维护统一 `packages / packagesByDomain / packagesByName / packagesBySourcePackageName`。
- appbase bridge 必须能生成 `createBirdCoderAppbaseManifest(...)`，至少声明 `host`、`capabilityNames`、`sourcePackageNames`、`bridgePackageName`。
- capability catalog 中 `sourcePackageName` 必须显式追踪上游 `@sdkwork/auth-pc-react`、`@sdkwork/user-pc-react`、`@sdkwork/vip-pc-react`。

## 5. 存储标准
- 会话：`sdkwork-birdcoder:appbase.identity.auth:session`
- 用户资料：`sdkwork-birdcoder:appbase.identity.user:profile`
- 会员态：`sdkwork-birdcoder:appbase.commerce.vip:membership`

## 6. 演进约束
- 当前允许使用本地 bridge 模拟 `sdkwork-appbase` 架构，不允许退化为仅页面桥接。
- 后续接入真实 `sdkwork-appbase` 包时，只替换 bridge 内部实现，不改变 shell、页面入口、状态接口、存储键。
- 所有架构文档、Step、Prompt、Release 记录都必须以 `sdkwork-birdcoder-appbase` 为唯一主写来源。
- 已退役的 `packages/sdkwork-birdcoder-auth`、`packages/sdkwork-birdcoder-user` 目录不得保留目录壳或重新回流。

## 7. 对齐门禁
- 必须通过 `check:appbase-parity`，确保 BirdCoder bridge 与上游 `sdkwork-appbase` 的 `auth/user/vip` 关键导出面持续对齐。
- 必须通过 `check:sdkwork-birdcoder-structure`，确保退役独立模块目录不会重新出现。
- parity gate 至少校验上游参考文件存在、workspace manifest、package meta、route intent、route catalog 与核心文档描述不漂移。
