# 17-Appbase Auth/User/VIP 统一接入标准

## 1. 目标

- `auth`、`user`、`vip` 的标准能力必须统一来自 `sdkwork-appbase`。
- BirdCoder 只保留 `sdkwork-birdcoder-auth`、`sdkwork-birdcoder-user` 两个薄适配包，不再创建 `sdkwork-birdcoder-appbase` 之类的本地聚合壳层。
- 统一对齐 `sdkwork-appbase` 的 capability 模型：`identity.auth`、`identity.user`、`identity.user-center-validation`、`commerce.vip`。
- 所有 UI、客户端逻辑层、server/runtime 集成必须支持两种部署模式：
  - 本地私有化部署，使用本地用户中心与本地认证体系
  - 上游统一接入，使用 `sdkwork-cloud-app-api` 或第三方用户中心

## 2. 核心边界

- `sdkwork-appbase`
  - 负责 canonical 定义、页面工厂、主题/slot/事件能力、runtime/validation/core 标准、server/client 抽象。
- `sdkwork-birdcoder-auth`
  - 只负责 BirdCoder 的认证 basePath、route intent、服务注入、运行时绑定、身份映射。
- `sdkwork-birdcoder-user`
  - 只负责 BirdCoder 的用户中心 basePath、用户投影、偏好存储映射、validation 插件定义、VIP 页面接入。
- `sdkwork-birdcoder-infrastructure`
  - 只负责 non-UI runtime bridge、local/private storage topology、上游统一接入绑定、server/client 运行时客户端。
- `sdkwork-birdcoder-shell`
  - 只消费 `sdkwork-birdcoder-auth`、`sdkwork-birdcoder-user` 暴露的标准页面和入口，不得消费任何 BirdCoder 本地 appbase 壳包。

## 3. 页面接入标准

- BirdCoder 登录页必须通过 `@sdkwork/user-center-pc-react` 根包导出的 `createSdkworkCanonicalAuthSurfacePage(...)` 生成。
- BirdCoder 用户中心页必须通过 `@sdkwork/user-center-pc-react` 根包导出的 `createSdkworkCanonicalUserCenterSurfacePage(...)` 生成。
- 页面层只允许保留以下 app-specific 信息：
  - basePath 与 homePath
  - locale hook
  - service hook
  - controller factory
  - BirdCoder 特有的文案补充或未登录状态文案
- 页面层不得重新拼装共享视觉骨架，不得重新复制登录表单、找回密码、注册、二维码、OAuth 组件。

## 4. 包级标准

- `sdkwork-birdcoder-auth` 必须提供：
  - `BIRDCODER_AUTH_DEFINITION`
  - `createBirdCoderAuthWorkspaceManifest(...)`
  - `createBirdCoderAuthRouteIntent(...)`
  - `authPackageMeta`
- `sdkwork-birdcoder-user` 必须提供：
  - `BIRDCODER_USER_DEFINITION`
  - `BIRDCODER_USER_CENTER_DEFINITION`
  - `BIRDCODER_USER_CENTER_VALIDATION_DEFINITION`
  - `createBirdCoderUserWorkspaceManifest(...)`
  - `createBirdCoderUserRouteIntent(...)`
  - `createBirdCoderUserCenterPluginDefinition(...)`
  - `createBirdCoderUserCenterServerPluginDefinition(...)`
  - `userPackageMeta`
- `vip` 页面可以继续挂在 `sdkwork-birdcoder-user` 下，但其 UI 必须复用 `@sdkwork/vip-pc-react`，不得再做本地平行实现。

## 5. 导入与导出标准

- 只允许根包导入，例如：
  - `@sdkwork/auth-pc-react`
  - `@sdkwork/user-pc-react`
  - `@sdkwork/user-center-pc-react`
  - `@sdkwork/user-center-core-pc-react`
  - `@sdkwork/user-center-validation-pc-react`
- 严禁使用任何子路径导入。
- BirdCoder 本地代码严禁通过相对路径直接导入 `sdkwork-appbase/.../src/...`。
- `sdkwork-appbase` 相关包必须只发布根导出，不发布 `./surface` 之类的子导出别名。

## 6. 运行时与部署标准

- 本地私有化部署：
  - 允许每个应用使用自己的数据库、schema、表名前缀、密钥体系。
  - 运行时统一走 `sdkwork-appbase` 的 canonical user-center runtime/core/validation 标准。
- 上游统一接入：
  - 允许直接接入 `sdkwork-cloud-app-api` 或第三方用户中心。
  - 本地不强制冗余建用户表，但认证接口、token 交换、session 语义必须与本地模式保持一致。
- 两种模式下，页面接口、客户端逻辑层接口、server 端登录验证接口必须保持一致。

## 7. 认证与验证标准

- 认证体系必须独立为插件能力，依赖统一用户中心标准。
- 必须兼容 `AuthToken` 与 `AccessToken` 双令牌语义，并允许通过配置切换本地校验、上游校验、或混合互通信任模式。
- handshake、secret、providerKey、providerKind、protected token 等跨服务互通信息必须由 `sdkwork-appbase` canonical 定义统一描述。
- BirdCoder 只允许在薄适配层做 provider 绑定、命名空间绑定、storage binding，不允许重做协议。

## 8. 存储标准

- 会话存储键、用户资料键、偏好存储键、protected token/header 名称等，都必须来源于 canonical storage plan。
- BirdCoder 允许补充：
  - 数据库 key
  - migration namespace
  - table prefix
  - private deployment sqlite/postgresql 具体路径
- 但不得修改 canonical 语义字段名称。

## 9. 验收门禁

- 必须通过 `check:identity-standard`，确保：
  - 根包导入规则成立
  - BirdCoder 页面使用 canonical page factory
  - BirdCoder runtime 使用 canonical core/validation 包
  - `sdkwork-birdcoder-appbase` 与 `sdkwork-birdcoder-appbase-storage` 没有回流
- 必须通过 `check:sdkwork-birdcoder-structure`，确保目录结构没有重新引入已退役包。

## 10. 文档真相

- 当前真相是：
  - `sdkwork-appbase` 是统一标准源
  - `sdkwork-birdcoder-auth`、`sdkwork-birdcoder-user` 是 BirdCoder 薄适配层
  - `sdkwork-birdcoder-appbase` 已彻底退役
- 架构文档、Step、Prompt、Contract 都必须以这套真相为准。
