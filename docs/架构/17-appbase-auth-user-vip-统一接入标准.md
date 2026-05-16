# 17-Appbase Auth/User/VIP 统一接入标准

## 1. 目标

- `auth`、`user`、`vip` 的标准能力必须统一来自 `sdkwork-appbase`。
- BirdCoder 只保留面向产品路由和运行时装配的薄适配层，不复制 appbase 的页面、协议、验证、存储和业务逻辑。
- 统一对齐 `sdkwork-appbase` 的 IAM capability 模型：`iam.auth`、`iam.user`、`iam.user-center-validation`，以及与会员/权益相关的 appbase VIP 能力。
- 所有 UI、客户端服务层、server/runtime 集成必须支持本地私有化部署和上游统一接入两种模式。

## 2. 核心边界

- `sdkwork-appbase` 负责 canonical 定义、页面工厂、runtime、validation、core、server/client 抽象和本地 IAM 权威存储。
- `@sdkwork/birdcoder-iam` 只作为 BirdCoder 的 IAM 聚合入口，转发 appbase/user-center 能力和 BirdCoder 薄适配，不重新定义 IAM 协议。
- `@sdkwork/birdcoder-auth` 只负责 BirdCoder 的认证 basePath、route intent、服务注入和运行时绑定。
- `@sdkwork/birdcoder-user` 只负责 BirdCoder 的用户中心 basePath、用户投影、validation 插件定义和 VIP 页面接入。
- `@sdkwork/birdcoder-infrastructure` 只负责 non-UI runtime bridge、local/private storage topology、上游统一接入绑定和运行时客户端。
- `@sdkwork/birdcoder-shell` 只消费标准页面和入口，不得消费或恢复 BirdCoder 本地 appbase 壳包。

## 3. 页面接入标准

- BirdCoder 登录页必须通过 appbase 根包导出的 canonical auth surface factory 生成。
- BirdCoder 用户中心页必须通过 appbase 根包导出的 canonical user-center surface factory 生成。
- BirdCoder VIP 页必须复用 appbase 的 canonical VIP/user-center 页面能力，不得在 BirdCoder 内平行实现。
- 页面层只允许保留 app-specific 的 `basePath`、`homePath`、locale hook、service hook、controller factory 和必要的产品文案补充。
- 页面层不得重新拼装共享视觉骨架，不得复制登录表单、找回密码、注册、二维码或 OAuth 组件。

## 4. 包级标准

- `@sdkwork/birdcoder-iam` 必须提供 BirdCoder IAM 总入口、部署 profile、页面 loader、runtime bridge factory、validation preflight 和 user-center plugin helper。
- `@sdkwork/birdcoder-auth` 必须提供 `BIRDCODER_AUTH_DEFINITION`、`createBirdCoderAuthWorkspaceManifest(...)`、`createBirdCoderAuthRouteIntent(...)` 和 `authPackageMeta`。
- `@sdkwork/birdcoder-user` 必须提供 `BIRDCODER_USER_DEFINITION`、`BIRDCODER_USER_CENTER_DEFINITION`、`BIRDCODER_USER_CENTER_VALIDATION_DEFINITION`、user route intent、user-center plugin definition、server plugin definition 和 `userPackageMeta`。
- Appbase package imports must use root package exports. BirdCoder code must not import `sdkwork-appbase/.../src/...` through relative paths.

## 5. 运行时与部署标准

- 本地私有化部署使用 appbase user-center native runtime 作为 IAM 权威，核心表必须使用 `iam_` 前缀。
- 上游统一接入可以绑定 `sdkwork-cloud-app-api` 或第三方用户中心，但认证接口、token 交换、session 语义和 protected token 语义必须与本地模式一致。
- BirdCoder 不在自己的数据内核中生成 appbase-owned IAM 表，也不保留本地 `user_profile`、`vip_user`、`account`、用户账号、角色、权限等重复实体。
- BirdCoder 可保留非 IAM 的业务表和投影，例如订单、项目、工作空间、业务积分流水和非核心 VIP 商品配置。

## 6. 认证与验证标准

- 认证体系必须独立为插件能力，依赖统一用户中心标准。
- 必须兼容 `auth_token` 与 `access_token` 双令牌语义。
- `Sdkwork-Access-Token`、protected token、handshake、secret、providerKey、providerKind 等跨服务互通信息必须由 appbase canonical 定义统一描述。
- BirdCoder 只允许在薄适配层做 provider 绑定、命名空间绑定和 storage binding，不允许重做协议或保留兼容分支。

## 7. 存储标准

- IAM 会话、用户、身份、角色、权限、会员和账户核心存储由 appbase 统一拥有。
- BirdCoder data kernel 不得定义 appbase-owned IAM entity，也不得生成旧 `plus_*` 核心 IAM 表。
- BirdCoder 对 appbase IAM 返回的 Long/BIGINT API 字段只保留传输规范化能力，不能因此重新引入本地 IAM 持久化。
- 会话存储键、protected token/header 名称和 user-center storage plan 必须来源于 canonical appbase/user-center 定义。

## 8. 验收门禁

- 必须通过 `check:iam-standard`，确保根包导入、canonical page factory、runtime bridge、validation、命令矩阵和 appbase IAM 表标准都成立。
- 必须通过 `test:user-center-standard`，确保 BirdCoder user-center runtime、seed parity、Rust validation 和 IAM 命名标准一致。
- 必须通过 `check:data-kernel`，确保 BirdCoder 不再拥有 appbase-owned IAM 实体和旧核心 IAM 表。
- 必须通过 appbase IAM/user-center 标准契约，确保 appbase 侧仍是统一标准源。

## 9. 文档真相

- 当前真相是：`sdkwork-appbase` 是 IAM/user-center/VIP 统一标准源。
- BirdCoder 的 `auth`、`user`、`iam` 包是薄适配和聚合入口，不是新的 IAM 权威实现。
- BirdCoder 本地 appbase 壳包已退役，不得回流。
- 架构文档、Step、Prompt、Contract 都必须以这套真相为准。