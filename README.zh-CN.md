# SDKWork BirdCoder

[English](./README.md) | **简体中文**

SDKWork BirdCoder 是一个包优先组织的 AI IDE 工作区。它保留 BirdCoder 自身的产品模块，同时把宿主边界、发布流程、CI 规则、部署资产和文档治理统一对齐到 Claw Studio 的架构标准。身份体系、用户中心、认证运行时、部署画像、命令矩阵和 seed 契约统一来自 `sdkwork-appbase`，BirdCoder 只负责承接产品品牌、命名空间、路由和样板基础数据。

> BirdCoder 不是通用脚手架模板。这个仓库同时包含多宿主 AI IDE、可执行架构契约、发布自动化和部署资产，并且这些内容都在同一个受治理工作区里持续演进。

## 仓库交付内容

- 一套共享的 AI IDE 工作区，可从同一套包图运行在 Web、桌面端和原生服务端。
- 面向产品的工作面，包括代码、Studio、终端、设置、技能、模板，以及共享的身份与会员能力。
- 通过共享内核元数据和独立适配器接入 Codex、Claude Code、Gemini、OpenCode 四类引擎。
- 支持 `desktop`、`server`、`container`、`kubernetes`、`web` 五类发布产物，并包含 smoke 与 finalize 流程。
- Prompt、文档、包结构、发布闭环、质量分层和架构边界全部通过可执行治理规则进行约束。

## 工作区结构

### 基础层

- `@sdkwork/birdcoder-core`
- `@sdkwork/birdcoder-types`
- `@sdkwork/birdcoder-i18n`
- `@sdkwork/birdcoder-infrastructure`
- `@sdkwork/birdcoder-ui`
- `@sdkwork/birdcoder-commons`

### Shell 与宿主边界

- `@sdkwork/birdcoder-shell`
- `@sdkwork/birdcoder-host-core`
- `@sdkwork/birdcoder-host-studio`

### 交付宿主

- `@sdkwork/birdcoder-web`
- `@sdkwork/birdcoder-desktop`
- `@sdkwork/birdcoder-server`
- `@sdkwork/birdcoder-distribution`

### 产品模块

- `@sdkwork/birdcoder-code`
- `@sdkwork/birdcoder-studio`
- `@sdkwork/birdcoder-terminal`
- `@sdkwork/birdcoder-settings`
- `@sdkwork/birdcoder-skills`
- `@sdkwork/birdcoder-templates`
- `@sdkwork/birdcoder-auth`
- `@sdkwork/birdcoder-user`
- `@sdkwork/birdcoder-chat`
- `@sdkwork/birdcoder-chat-claude`
- `@sdkwork/birdcoder-chat-codex`
- `@sdkwork/birdcoder-chat-gemini`
- `@sdkwork/birdcoder-chat-opencode`

### 仓库级资产

- [`docs/`](./docs/)：架构、Step、Prompt、发布记录和运维说明
- [`scripts/`](./scripts/)：校验、发布编排、代码生成和治理自动化
- [`deploy/docker`](./deploy/docker/)：Docker 交付资产
- [`deploy/kubernetes`](./deploy/kubernetes/)：Helm 兼容的 Kubernetes 交付资产
- [`external/`](./external/)：协议对齐和引擎适配使用的源码镜像与参考资料

## 环境前提

- Node.js
- `pnpm` 10
- 进行桌面端或原生服务端开发时需要 Rust 与 Cargo
- 进行容器打包、本地 PostgreSQL smoke 或部署验证时需要 Docker

## 快速开始

按 CI 预期安装整个工作区：

```bash
pnpm install --frozen-lockfile
```

启动浏览器宿主：

```bash
pnpm dev
```

常用本地入口：

```bash
pnpm tauri:dev
pnpm tauri:dev:private
pnpm tauri:dev:external
pnpm tauri:dev:cloud
pnpm dev:local
pnpm dev:private
pnpm dev:external
pnpm dev:cloud
pnpm server:dev
pnpm server:dev:external
pnpm server:dev:cloud
pnpm desktop:dev:local
pnpm desktop:dev:private
pnpm desktop:dev:external
pnpm desktop:dev:cloud
pnpm stack:desktop:local
pnpm stack:desktop:private
pnpm stack:desktop:external
pnpm stack:desktop:cloud
pnpm web:dev:private
pnpm web:dev:external
pnpm web:dev:cloud
pnpm stack:web:private
pnpm stack:web:external
pnpm stack:web:cloud
pnpm server:dev:private
pnpm server:dev:external
pnpm server:dev:cloud
pnpm docs:dev
```

当前脚本默认端口：

- Web 工作区：`http://localhost:3000`
- 文档预览：`http://127.0.0.1:4173`

## 身份部署模式

BirdCoder 通过根级 `pnpm` 包装脚本统一暴露三种标准身份部署模式：

| 模式 | 桌面端命令 | 服务端命令 | 身份权威 |
| --- | --- | --- | --- |
| `desktop-local` | `pnpm tauri:dev` 或 `pnpm tauri:dev:local` | 不需要单独服务端 | Tauri 内嵌 coding server，并使用本地 sqlite 用户中心 |
| `server-private` | `pnpm tauri:dev:private` | `pnpm server:dev` 或 `pnpm server:dev:private` | 私有化 BirdCoder Server 承载本地用户中心和认证接口 |
| `cloud-saas` | `pnpm tauri:dev:cloud` | `pnpm server:dev:cloud` | BirdCoder Server 将身份能力委托给 `sdkwork-cloud-app-api` |

这些包装脚本会通过 Vite 的 env 加载器读取 `.env`、`.env.local`、`.env.development`、`.env.development.local`、`.env.production`、`.env.production.local`，然后按模式补齐 sqlite 路径、远端 API base URL、用户中心 provider、本地 OAuth provider 与开发态快速登录默认值。前端 runtime bridge 也会消费 `VITE_BIRDCODER_IDENTITY_DEPLOYMENT_MODE`，因此远端私有化服务端模式会被明确识别为 `builtin-local`，不会在内部被误判成 cloud 模式。应用加载 `/api/app/v1/auth/config` 之后，还会把服务端返回的 `providerKind` 与 `providerKey` 回灌到 runtime binding，确保前端真实运行时始终以服务端权威配置为准。

作为样板工程，BirdCoder 现在还提供一组 `stack:*` 一键开发栈命令。在需要单独 BirdCoder Server 的模式下，这组命令会先按统一身份配置启动原生服务端，等待 `/api/core/v1/health` 与 `/api/app/v1/auth/config` 这两个标准接口都成功返回后，再启动匹配的桌面端或 Web 宿主，避免接入方手工协调多个终端。

`server-private` 和 `cloud-saas` 的桌面开发命令在本地迭代时，会默认把客户端 API base URL 指向 `http://127.0.0.1:10240`。而生产打包场景更严格，`tauri:build:private` 与 `tauri:build:cloud` 必须显式设置 `BIRDCODER_API_BASE_URL` 或 `VITE_BIRDCODER_API_BASE_URL`，避免打包产物误连本地地址。

内置本地用户中心在开发阶段会自动种下这组默认账号：

- 账户：`local-default@sdkwork-birdcoder.local`
- 邮箱：`local-default@sdkwork-birdcoder.local`
- 手机：`13800000000`
- 密码：`dev123456`
- 本地开发固定验证码：`123456`

共享的 `sdkwork-appbase` 认证界面会在 `desktop-local` 和 `server-private` 下自动接收这些预填值，因此密码登录、邮箱验证码登录、手机验证码登录都能直接点击验证，无需修改 UI 代码或手工输入测试账号。`cloud-saas` 也可以使用同一套预填机制，只需在 env 中设置 `VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT`、`VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL`、`VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE` 与 `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD`。

Seed 行为现在完全跟随部署画像并且默认 fail-closed。`desktop-local` 与 `server-private` + `builtin-local` 会启用权威 seed、认证开发 seed、固定本地验证码和 starter workspace bootstrap。`server-private` + `external-user-center` 以及 `cloud-saas` 会关闭 builtin-local 权威 seed，不再偷偷兜底生成本地用户、验证码或 starter project，这样上游配置缺失会在启动和治理校验时立即暴露。

如果需要在启动前检查最终生效的运行参数，可以使用：

```bash
pnpm identity:show -- desktop-dev --identity-mode desktop-local
pnpm identity:show -- server-dev --identity-mode server-private
pnpm identity:show -- server-dev --identity-mode cloud-saas
```

这个检查器会打印解析后的 `BIRDCODER_*` 与 `VITE_BIRDCODER_*` 变量，并自动掩码敏感字段，方便确认 sqlite 路径、provider 选择、远端 API base URL、开发预填账号、本地 OAuth provider 与云端 OAuth provider 配置。

如果希望在看到同一份部署画像的同时完成可执行校验，可以直接使用 doctor 别名：

```bash
pnpm identity:doctor:desktop:local
pnpm identity:doctor:web:private
pnpm identity:doctor:server:cloud
```

Doctor 命令会验证必需 env、解析后的 provider kind、实际 API base URL、存储目标、就绪检查、seed 行为和开发预填可用性。cloud 与 external-provider 通道在上游配置不完整时会直接 fail-closed。

在统一用户中心标准下，`desktop-local`、`server-private`、`cloud-saas` 始终复用同一套 BirdCoder facade 路由。`desktop-local` 和 `server-private` 由 builtin-local 权威直接提供密码登录、邮箱验证码登录、手机验证码登录、本地 OAuth URL、本地 OAuth 登录、验证码发送、注册、忘记密码、个人资料和会员信息。`cloud-saas` 则把同样的契约桥接到上游 `sdkwork-cloud-app-api`。当需要接入第三方身份网关时，BirdCoder 也可以把同一 facade 切到 `external-user-center` provider，而无需改前端接口层。二维码登录仍然保留在 BirdCoder 自身 facade 上，通过 BirdCoder 的 session confirm 流完成闭环，因此前端不需要因部署模式不同而写分支逻辑，左侧二维码区域也能在所有模式下稳定存在。

`desktop-local` 和 `server-private` 默认启用 `wechat`、`douyin`、`github` 三个本地 OAuth 样板 provider。它们始终走标准 `/api/app/v1/auth/oauth/url` 与 `/api/app/v1/auth/oauth/login` facade，可通过 `BIRDCODER_LOCAL_OAUTH_PROVIDERS` 关闭或替换，也可以用 `BIRDCODER_LOCAL_OAUTH_GITHUB_NAME`、`BIRDCODER_LOCAL_OAUTH_WECHAT_EMAIL` 之类的 env 做 provider 级覆盖。

## 常用命令

| 目标 | 命令 | 说明 |
| --- | --- | --- |
| 启动标准本地单机样板 | `pnpm dev:local` 或 `pnpm desktop:dev:local` | 打开 Tauri 桌面宿主，内嵌 coding server、本地 sqlite 用户中心、默认基础数据和开发预填账号 |
| 一键启动标准本地单机样板栈 | `pnpm stack:desktop:local` | 推荐作为 BirdCoder 样板工程的标准参考入口 |
| 启动连接私有 BirdCoder Server 的 Web 工作区 | `pnpm dev` 或 `pnpm dev:private` | 浏览器宿主会在本地开发时默认把 `VITE_BIRDCODER_API_BASE_URL` 指向 `http://127.0.0.1:10240` |
| 一键启动私有模式 Web 样板栈 | `pnpm stack:web:private` | 先启动原生 BirdCoder Server，待健康检查与认证配置接口成功后再启动 Web 宿主 |
| 一键启动外部用户中心 Web 样板栈 | `pnpm stack:web:external` | 与私有模式相同的 BirdCoder facade，但服务端 provider 绑定为 `external-user-center` |
| 启动连接云端 BirdCoder Server 的 Web 工作区 | `pnpm dev:cloud` | 浏览器宿主使用 env 中配置的 cloud 模式 API 地址 |
| 一键启动云端模式 Web 样板栈 | `pnpm stack:web:cloud` | 启动 `cloud-saas` 模式 BirdCoder Server，再启动 Web 宿主；需要 `BIRDCODER_USER_CENTER_APP_API_BASE_URL` |
| 启动内嵌本地认证的桌面宿主 | `pnpm tauri:dev` | 默认 `desktop-local` 模式，适合单机样板验证 |
| 启动连接私有服务端的桌面宿主 | `pnpm tauri:dev:private` | 使用 `BIRDCODER_API_BASE_URL`，未配置时默认连 `http://127.0.0.1:10240` |
| 启动连接外部用户中心服务端的桌面宿主 | `pnpm tauri:dev:external` | 使用 `external-user-center` provider 的私有服务端部署通道 |
| 启动连接云端服务端的桌面宿主 | `pnpm tauri:dev:cloud` | 要求目标 BirdCoder Server 已启用 `sdkwork-cloud-app-api` 集成 |
| 一键启动私有模式桌面样板栈 | `pnpm stack:desktop:private` | 先启动原生 BirdCoder Server，待健康检查与认证配置接口成功后再启动桌面宿主 |
| 一键启动外部用户中心桌面样板栈 | `pnpm stack:desktop:external` | 先启动绑定 `external-user-center` 的 BirdCoder Server，再启动桌面宿主 |
| 一键启动云端模式桌面样板栈 | `pnpm stack:desktop:cloud` | 先启动 `cloud-saas` 模式 BirdCoder Server，再启动桌面宿主 |
| 用显式模式矩阵启动桌面宿主 | `pnpm desktop:dev:local`、`pnpm desktop:dev:private`、`pnpm desktop:dev:external`、`pnpm desktop:dev:cloud` | 适合样板工程接入说明与运维手册 |
| 用显式模式矩阵启动浏览器宿主 | `pnpm web:dev:private`、`pnpm web:dev:external`、`pnpm web:dev:cloud` | 让 Web 命名方式与 desktop、server 保持一致 |
| 启动本地私有认证的原生服务端 | `pnpm server:dev` | 默认 `server-private` 模式，使用本地 sqlite 用户中心 |
| 启动外部用户中心 provider 的原生服务端 | `pnpm server:dev:external` | 维持 BirdCoder facade 不变，只切换服务端身份 provider |
| 用显式模式矩阵启动原生服务端 | `pnpm server:dev:private`、`pnpm server:dev:external`、`pnpm server:dev:cloud` | 适合私有化、外部用户中心与云端集成切换验证 |
| 启动云端 app-api 身份集成的原生服务端 | `pnpm server:dev:cloud` | 需要配置 `BIRDCODER_USER_CENTER_APP_API_BASE_URL` |
| 检查任意目标与模式的身份 env | `pnpm identity:show -- <target> --identity-mode <mode>` | 输出 `.env` 加载和模式归一化后的最终 BirdCoder env |
| 通过标准别名矩阵检查身份 env | `pnpm identity:show:desktop:local`、`pnpm identity:show:web:private`、`pnpm identity:show:server:cloud` | 对标准 env 命令做的薄别名，适合运维文档和 CI 调用 |
| 通过标准别名矩阵校验身份 env 与部署就绪性 | `pnpm identity:doctor:desktop:local`、`pnpm identity:doctor:web:private`、`pnpm identity:doctor:server:cloud` | 校验必需 env、provider kind、base URL、存储目标、seed 策略和快速登录可用性；远端通道缺少上游配置时直接 fail-closed |
| 按 canonical appbase 契约运行 BirdCoder 身份治理 | `pnpm check:identity-standard` | 校验 BirdCoder 仍然只是 canonical auth UI、runtime bridge、command matrix 与 plugin 组装的薄封装 |
| 构建私有模式 Web 包 | `pnpm build` 或 `pnpm build:private` | 生成连接私有 BirdCoder Server 的浏览器生产包 |
| 构建云端模式 Web 包 | `pnpm build:cloud` | 生成连接云端身份集成的浏览器生产包 |
| 构建本地模式桌面包 | `pnpm tauri:build` | 生成内嵌本地部署的桌面应用 |
| 构建私有服务端模式桌面包 | `pnpm tauri:build:private` | 打包成连接外部 BirdCoder Server 的桌面应用 |
| 构建云端模式桌面包 | `pnpm tauri:build:cloud` | 打包成连接云端 BirdCoder Server 的桌面应用 |
| 使用显式标准矩阵构建 | `pnpm desktop:build:local`、`pnpm desktop:build:private`、`pnpm desktop:build:cloud`、`pnpm web:build:private`、`pnpm web:build:cloud`、`pnpm server:build:private`、`pnpm server:build:cloud` | 保持 CI、运维文档和部署模式命名一致 |
| 使用显式模式名打包桌面产物 | `pnpm package:desktop:local`、`pnpm package:desktop:private`、`pnpm package:desktop:cloud` | 对标准桌面 build 的薄包装，适合操作手册和产物流程 |
| 使用显式模式名打包 Web 产物 | `pnpm package:web:private`、`pnpm package:web:cloud` | 对标准 Web build 的薄包装，适合操作手册和交付流程 |
| 使用显式模式名打包服务端产物 | `pnpm package:server:private`、`pnpm package:server:cloud` | 对标准 server build 的薄包装，适合私有化与云端部署打包 |
| 构建生产版 Web 工作区 | `pnpm build` | 预处理共享 SDK 包并构建 Web 宿主 |
| 构建文档站点 | `pnpm docs:build` | 构建 VitePress 文档站点 |
| 运行仓库基线校验 | `pnpm lint` | 主要的提交前与推送前验证入口 |
| 校验包治理 | `pnpm check:package-governance` | 约束作用域包命名与 workspace 依赖归属 |
| 校验跨宿主交付面 | `pnpm check:multi-mode` | 聚合桌面端、服务端与 release-flow 验证 |
| 生成质量执行证据 | `pnpm quality:execution-report` | 输出 `artifacts/quality/quality-gate-execution-report.json` |
| 构建原生服务端发布包 | `pnpm server:build` | 运行受治理的服务端构建包装脚本 |

## 质量与治理

BirdCoder 把文档和发布行为都视为可执行契约，而不是静态说明。

- `pnpm lint` 会运行 TypeScript 校验，以及当前仓库启用的架构、治理、Prompt 与 release-flow 契约集合。
- `pnpm check:quality:fast`、`pnpm check:quality:standard`、`pnpm check:quality:release` 定义了分层质量门禁。
- `pnpm quality:report` 与 `pnpm quality:execution-report` 会把机器可读证据写入 `artifacts/quality/`。
- `pnpm check:live-docs-governance-baseline` 用来防止架构、Step、Prompt 与发布文档落后于当前治理基线。
- `pnpm check:release-flow` 与 `pnpm check:ci-flow` 分别冻结发布编排与工作流契约。

如果你修改了包归属、发布自动化、文档治理或多宿主行为，建议先跑 `pnpm lint`，再根据变更范围补跑更窄的专项校验。

## 发布与部署

BirdCoder 从同一个工作区打包多类交付产物：

- `desktop`
- `server`
- `container`
- `kubernetes`
- `web`

核心发布命令：

```bash
pnpm release:plan
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
pnpm release:smoke:desktop
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
pnpm release:smoke:web
pnpm release:finalize
pnpm release:smoke:finalized
```

发布资产会输出到 `artifacts/release/`。`finalize` 会产出后续发布、回滚和审计使用的发布清单与质量证据。

完整交付契约请查看 [Release And Deployment](./docs/core/release-and-deployment.md)。

## 文档导航

- [快速开始](./docs/guide/getting-started.md)
- [应用模式](./docs/guide/application-modes.md)
- [开发说明](./docs/guide/development.md)
- [架构总览](./docs/core/architecture.md)
- [包拓扑说明](./docs/core/packages.md)
- [命令参考](./docs/reference/commands.md)
- [发布与部署](./docs/core/release-and-deployment.md)
- [中文架构标准总览](./docs/架构/README.md)
- [Step 执行矩阵](./docs/step/README.md)

## 认证 UI 规则

BirdCoder 是共享认证界面的样板接入工程。它的认证页必须在登录、注册和忘记密码三种状态下都把二维码面板固定在左侧。旧版左侧的密码、邮箱验证码、手机验证码方法卡片在这个样板里是明确禁止的，后续迭代也不能恢复。当前二维码能力依赖 `/api/app/v1/auth/qr/generate` 与 `/api/app/v1/auth/qr/status/{qrKey}` 两条标准接口，因此左侧区域始终绑定真实二维码登录流程，而不是装饰性占位布局。
