# SDKWork BirdCoder

[English](./README.md) | **简体中文**

SDKWork BirdCoder 是一个以包为优先组织方式的 AI IDE 工作区。它保留 BirdCoder 的产品模块，同时把宿主边界、发布流程、CI 策略、部署资产和文档治理对齐到 SDKWork 架构标准。IAM 只使用标准 SDKWork IAM 运行时、生成的 app/backend SDK，以及共享 auth/user/VIP UI 包；BirdCoder 只绑定产品品牌、路由和样板数据，不再保留应用级认证或账户兼容层。

## 交付内容

- 同一套包图支持 Web、桌面和原生服务端宿主。
- 产品能力包括 code、studio、terminal、settings、skills、templates、SDKWork IAM 登录、用户资料和 VIP 会员流程。
- 通过共享内核元数据和独立适配器接入 Codex、Claude Code、Gemini、OpenCode。
- 支持 `desktop`、`server`、`container`、`kubernetes`、`web` 发布产物。
- 用可执行契约治理 prompt、文档、包结构、发布闭环、质量分层、SDK 生成和架构边界。

## 快速开始

```bash
pnpm install --frozen-lockfile
pnpm dev
```

常用入口：

```bash
pnpm dev:local
pnpm dev:private
pnpm dev:cloud
pnpm tauri:dev
pnpm tauri:dev:private
pnpm tauri:dev:cloud
pnpm server:dev
pnpm server:dev:private
pnpm server:dev:cloud
pnpm stack:desktop:local
pnpm stack:desktop:private
pnpm stack:desktop:cloud
pnpm stack:web:private
pnpm stack:web:cloud
pnpm check:iam:sample
```

默认本地端口：

- Web 工作区：`http://localhost:3000`
- BirdCoder Server：`http://127.0.0.1:10240`
- 文档预览：`http://127.0.0.1:4173`

## IAM 部署模式

| 模式 | 桌面命令 | 服务端命令 | SDKWork 公开模式 | IAM 权威 |
| --- | --- | --- | --- | --- |
| `desktop-local` | `pnpm tauri:dev` 或 `pnpm tauri:dev:local` | 不需要独立服务端 | `local` | 桌面内嵌 BirdCoder coding server 和本地 SDKWork IAM |
| `server-private` | `pnpm tauri:dev:private` | `pnpm server:dev` 或 `pnpm server:dev:private` | `private` | 私有 BirdCoder server 和本地 SDKWork IAM |
| `cloud-saas` | `pnpm tauri:dev:cloud` | `pnpm server:dev:cloud` | `saas` | BirdCoder server 对接 SDKWork cloud app-api IAM |

包装脚本会加载 `.env`、`.env.local`、`.env.development`、`.env.development.local`、`.env.production`、`.env.production.local`，然后按模式补齐 sqlite、远端 API base URL、`SDKWORK_IAM_MODE`、`VITE_SDKWORK_DEPLOYMENT_MODE`、OAuth 样板配置和开发登录预填值。

本地开发请通过标准 SDKWork IAM 登录/注册流程获取会话。`tenant_id`、`organization_id`、`user_id`、`session_id` 和 `app_id` 必须来自双 token JWT claims，不能通过 bootstrap 环境变量注入固定身份。

可选登录表单预填需要显式开启：

- 设置 `VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED=true`
- 自行提供 `VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL`、`VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE` 和/或 `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD`
- 开发验证码固定值：`123456`（`SDKWORK_IAM_DEV_FIXED_VERIFY_CODE`）

启动前检查最终环境：

```bash
pnpm iam:show -- desktop-dev --iam-mode desktop-local
pnpm iam:show -- server-dev --iam-mode server-private
pnpm iam:show -- server-dev --iam-mode cloud-saas
```

就绪检查：

```bash
pnpm iam:doctor:desktop:local
pnpm iam:doctor:web:private
pnpm iam:doctor:server:cloud
```

`pnpm check:iam:sample` 会覆盖 local、private、cloud 三条样板链路，并验证私有和云端模式的 web/server 构建。若未显式设置 `SDKWORK_IAM_APP_API_BASE_URL`，云端样板会使用 `https://app-api.example.com` 作为确定性占位值。

BirdCoder 前端始终调用标准路由：`/app/v3/api/auth/*`、`/app/v3/api/system/iam/runtime`、`/app/v3/api/system/iam/verification_policy`、`/app/v3/api/iam/users/current`、`/app/v3/api/memberships/current`、`/app/v3/api/memberships/package_groups`。Auth UI 使用 `SdkworkIamAuthRoutes`，用户页面使用共享 SDKWork user 控制器，会员和套餐目录通过生成的 BirdCoder app SDK `commerce.memberships` surface 获取，运行时会话通过生成的 BirdCoder app SDK 和 `@sdkwork/iam-runtime` 完成。

## 常用命令

| 目标 | 命令 |
| --- | --- |
| 本地桌面样板 | `pnpm dev:local` 或 `pnpm desktop:dev:local` |
| 私有 Web 样板 | `pnpm dev` 或 `pnpm dev:private` |
| 云端 Web 样板 | `pnpm dev:cloud` |
| 私有 Web 栈 | `pnpm stack:web:private` |
| 云端 Web 栈 | `pnpm stack:web:cloud` |
| 本地桌面宿主 | `pnpm tauri:dev` |
| 私有桌面宿主 | `pnpm tauri:dev:private` |
| 云端桌面宿主 | `pnpm tauri:dev:cloud` |
| 私有服务端 | `pnpm server:dev` 或 `pnpm server:dev:private` |
| 云端服务端 | `pnpm server:dev:cloud` |
| IAM 标准契约 | `pnpm check:iam-standard` |
| 样板 IAM 矩阵 | `pnpm check:iam:sample` |
| Web 构建 | `pnpm build`、`pnpm build:private`、`pnpm build:cloud` |
| 桌面构建 | `pnpm tauri:build`、`pnpm tauri:build:private`、`pnpm tauri:build:cloud` |
| 文档构建 | `pnpm docs:build` |
| 仓库基线 | `pnpm lint` |
| 服务端构建 | `pnpm server:build` |

## 质量与治理

- `pnpm lint` 运行 TypeScript、架构、治理、IAM、SDK 和发布流程契约。
- `pnpm check:quality:fast`、`pnpm check:quality:standard`、`pnpm check:quality:release` 定义质量分层。
- `pnpm quality:report` 和 `pnpm quality:execution-report` 输出机器可读证据。
- `pnpm check:release-flow` 和 `pnpm check:ci-flow` 固化发布编排与 CI 拓扑。

改动包归属、发布自动化、IAM 行为、生成 SDK、文档治理或多宿主行为时，先从 `pnpm lint` 开始，再按变更范围补跑更窄的检查。

## 发布

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

发布产物输出到 `artifacts/release/`。完整交付契约见 [Release And Deployment](./docs/core/release-and-deployment.md)。
