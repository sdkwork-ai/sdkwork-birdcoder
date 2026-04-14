# SDKWork BirdCoder

[English](./README.md) | **简体中文**

SDKWork BirdCoder 是一个以包为中心组织的 AI IDE 工作区。在保留 BirdCoder 自身产品边界的前提下，它将宿主边界、发布流程、CI 规则、部署资产和文档治理统一对齐到 Claw Studio 架构标准。

> 这不是一个通用脚手架仓库。当前仓库同时包含多宿主 AI IDE、可执行架构契约、发布自动化和部署资产，并且这些内容都通过统一治理流程维护。

## 这个仓库当前交付什么

- 一套共享的 AI IDE 工作区，可在 Web、桌面端和原生服务端三种宿主模式下运行。
- 面向产品的工作面：代码、Studio、终端、设置、技能、模板，以及与 appbase 对齐的身份和会员能力。
- 通过共享内核元数据和独立适配器接入 Codex、Claude Code、Gemini、OpenCode 四类引擎。
- 支持 `desktop`、`server`、`container`、`kubernetes`、`web` 五类发布产物，并带有 smoke 与 finalize 流程。
- Prompt、文档、包结构、release closure、质量门禁和架构边界都通过可执行契约进行治理。

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
- `@sdkwork/birdcoder-appbase`
- `@sdkwork/birdcoder-chat`
- `@sdkwork/birdcoder-chat-claude`
- `@sdkwork/birdcoder-chat-codex`
- `@sdkwork/birdcoder-chat-gemini`
- `@sdkwork/birdcoder-chat-opencode`

### 仓库级资产

- [`docs/`](./docs/)：架构、Step、Prompt、发布记录和运维说明
- [`scripts/`](./scripts/)：验证、发布编排、代码生成和治理自动化
- [`deploy/docker`](./deploy/docker/)：Docker 交付资产
- [`deploy/kubernetes`](./deploy/kubernetes/)：Helm 兼容的 Kubernetes 交付资产
- [`external/`](./external/)：用于协议对齐和引擎适配的源码镜像与参考资料

## 环境前提

- Node.js
- `pnpm` 10
- 如果需要开发桌面端或原生服务端，需要 Rust 与 Cargo
- 如果需要做容器打包、本地 PostgreSQL smoke 或部署类验证，需要 Docker

## 快速开始

按 CI 预期安装整个工作区：

```bash
pnpm install --frozen-lockfile
```

启动浏览器宿主：

```bash
pnpm dev
```

其他本地入口：

```bash
pnpm tauri:dev
pnpm server:dev
pnpm docs:dev
```

当前脚本默认端口：

- Web 工作区：`http://localhost:3000`
- 文档预览：`http://127.0.0.1:4173`

## 常用命令

| 目标 | 命令 | 说明 |
| --- | --- | --- |
| 启动 Web 工作区 | `pnpm dev` | 启动浏览器宿主下的 BirdCoder 工作台 |
| 启动桌面端宿主 | `pnpm tauri:dev` | 启动带工具链与端口防护的 Tauri 宿主 |
| 启动原生服务端宿主 | `pnpm server:dev` | 启动 Rust 驱动的服务端宿主 |
| 构建生产版 Web 工作区 | `pnpm build` | 准备共享 SDK 包并构建 Web 宿主 |
| 构建文档站点 | `pnpm docs:build` | 构建 VitePress 文档站点 |
| 运行仓库基线校验 | `pnpm lint` | 主要的提交前与推送前验证入口 |
| 校验包治理 | `pnpm check:package-governance` | 约束作用域包命名和 workspace 依赖归属 |
| 校验多宿主交付面 | `pnpm check:multi-mode` | 聚合桌面端、服务端和 release-flow 验证 |
| 生成质量执行报告 | `pnpm quality:execution-report` | 输出 `artifacts/quality/quality-gate-execution-report.json` |
| 构建原生服务端发布包 | `pnpm server:build` | 运行受治理的服务端构建封装脚本 |

## 质量门禁与治理

BirdCoder 把文档和发布行为都当作可执行契约，而不是静态说明。

- `pnpm lint` 会运行 TypeScript 校验以及当前仓库启用的架构、治理、Prompt、release-flow 契约集合。
- `pnpm check:quality:fast`、`pnpm check:quality:standard`、`pnpm check:quality:release` 定义了分层质量门禁。
- `pnpm quality:report` 与 `pnpm quality:execution-report` 会把机器可读证据写入 `artifacts/quality/`。
- `pnpm check:live-docs-governance-baseline` 用来防止架构、Step、Prompt 与发布文档落后于当前治理基线。
- `pnpm check:release-flow` 与 `pnpm check:ci-flow` 分别冻结发布编排和工作流契约。

如果你修改了包归属、发布自动化、文档治理或者多宿主行为，建议先跑 `pnpm lint`，再按变更范围补跑更窄的专项校验。

## 发布与部署

BirdCoder 从同一个工作区打包五类交付产物：

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

发布资产会落在 `artifacts/release/`。`finalize` 阶段会产出用于发布、回滚和后续审计的清单与质量证据。

完整交付契约请查看 [Release And Deployment](./docs/core/release-and-deployment.md)。

## 文档导航

- [快速开始](./docs/guide/getting-started.md)
- [应用模式](./docs/guide/application-modes.md)
- [架构总览](./docs/core/architecture.md)
- [包拓扑说明](./docs/core/packages.md)
- [命令参考](./docs/reference/commands.md)
- [发布与部署](./docs/core/release-and-deployment.md)
- [中文架构标准总览](./docs/架构/README.md)
- [Step 执行矩阵](./docs/step/README.md)

## 语言支持

- 根入口默认使用英文，即当前仓库的 `README.md`。
- 简体中文版本位于 [README.zh-CN.md](./README.zh-CN.md)。
- 大部分操作和工程说明文档以英文为主，而完整的架构标准和 Step 标准主要维护在 [`docs/架构`](./docs/架构/) 与 [`docs/step`](./docs/step/)。
