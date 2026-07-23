# SDKWork BirdCoder

[English](README.md) | 简体中文

repository-kind: application

`sdkwork-birdcoder` 是 SDKWork 的 AI 编程工作台应用。当前架构收口只覆盖
Rust 后端与 PC 浏览器/Tauri，不把 H5、Flutter 或其他移动端纳入本次迁移及
验收证据。

应用尚未上线，因此领域调整采用一次性直接切换，不保留数据投影、影子表、
同步副本、双写、别名、兼容 facade 或第二套标识体系。

## 当前领域归属

BirdCoder 是无状态的应用组合宿主，只拥有应用描述、健康、路由目录和运行时
元数据。业务事实由对应的高内聚模块负责：

| 所有者 | 权威业务事实 |
| --- | --- |
| `sdkwork-agents` | Agent Project、组合槽、Session、Turn、Session Item、Interaction、Runtime Binding、Artifact、Checkpoint |
| `sdkwork-skills` | Skill 包、版本、制品、能力、安装状态与执行元数据 |
| `sdkwork-im` | 人际 Conversation、Message、Member、ReadCursor |
| `sdkwork-iam` | 认证、组织范围、成员关系、角色、权限与审计 |
| `sdkwork-drive` | Drive 与沙箱存储 |
| `sdkwork-documents` | 文档身份与内容 |

旧工作台 Workspace 聚合直接折叠为 IAM organization scope 加 canonical
Agents `AgentProject`。BirdCoder 与 PC 全程只使用一个 `projectId`，不再
存在 Workspace 服务、BirdCoder Project、双 ID 映射或兼容层。

AI 助手内容是 Agents Session Item 流；IM Message 表达人际或频道通信。
两者可以使用稳定关联标识，但都不能持久化为对方的副本。详细边界见
[`agent-session-item-view.spec.md`](specs/agent-session-item-view.spec.md)。

## 数据库设计

BirdCoder 服务端业务表为 **0**，没有 BirdCoder 服务端数据库、迁移、种子、
Schema、备份或恢复生命周期。

Tauri 宿主仅有一张本机 SQLite 表 `device_state_entry`，用于宿主私有设备
状态。允许范围只有应用设置、以 canonical Agents `projectId` 为键的设备
目录挂载，以及桌面 runtime-location 安装身份。`ProjectDeviceMountRegistry`
属于 PC 本地能力；原生路径、Git 进程、worktree 和终端句柄不能进入 BirdCoder
服务端记录。

## API 与权限

BirdCoder 只拥有 4 个 App API：

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| `GET` | `/app/v3/api/system/descriptor` | `birdcoder.system-descriptor.read` |
| `GET` | `/app/v3/api/system/health` | `birdcoder.system-health.read` |
| `GET` | `/app/v3/api/system/routes` | `birdcoder.system-routes.read` |
| `GET` | `/app/v3/api/system/runtime` | `birdcoder.system-runtime.read` |

Backend API 为 **0**，Open API 为 **0**。作者态权威是
[BirdCoder App OpenAPI](sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json)。
Project、Composition、Session、Skills、IM、IAM、Drive 和 Documents API
均由所属模块 SDK 提供，不复制进 BirdCoder。

## PC 运行时边界

- Project 与 Session 使用 `@sdkwork/agents-app-sdk`。
- Session 与 Project 使用同一个 canonical `projectId`，创建后通过 Agents
  `sessionRuntimeBindings` 写入不透明 runtime location id。
- 沙箱组合使用 Agents `drive/drive` 组合槽。
- 在 Agents 提供 canonical `document/documents` 组合槽之前，文档组合必须
  fail closed，不能借用其他类型冒充。
- 文件系统、Git、worktree 和终端只走 PC/Tauri 宿主适配器与授权设备挂载。
- 前端不得使用 raw HTTP、手写认证头、本地 DTO/SDK 副本或生成传输层内部实现。

## 目录

| 路径 | 职责 |
| --- | --- |
| [`apps/`](apps/README.md) | 应用端根目录；本次收口只覆盖 PC |
| `crates/` | 无状态 Rust assembly、gateway、System 路由与 Tauri 宿主 |
| [`apis/`](apis/README.md) | 作者态 API 权威索引 |
| [`sdks/`](sdks/README.md) | 仅包含 System 能力的 BirdCoder SDK family |
| [`specs/`](specs/README.md) | 应用机器合同及说明索引 |
| [`docs/`](docs/README.md) | 产品、架构、运维与证据文档 |
| `etc/` | 源码受控的安全运行配置 |
| `scripts/` | 生成与验证入口 |

仓库有意不再包含 `database/`。公共 SDKWork 能力通过同级工程和原生依赖清单
引用，不复制到本仓库。

## 开发与验证

```bash
pnpm install --frozen-lockfile
pnpm dev:desktop
pnpm dev:browser:standalone
pnpm build:server

pnpm check:domain-ownership
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:desktop
pnpm check:server
pnpm typecheck
pnpm lint
pnpm docs:build
```

全局规范位于 [`../sdkwork-specs/`](../sdkwork-specs/README.md)。本仓库只引用
规范与机器合同，不复制规范正文。

## 文档

- [文档索引](docs/README.md)
- [产品 PRD](docs/product/prd/PRD.md)
- [技术架构](docs/architecture/tech/TECH_ARCHITECTURE.md)
- [PC 应用文档](apps/sdkwork-birdcoder-pc/docs/README.md)
- [API 清单](apis/README.md)
- [本地 Specs 索引](specs/README.md)
