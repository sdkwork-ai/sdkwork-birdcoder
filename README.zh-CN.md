# SDKWork BirdCoder

[English](./README.md) | **简体中文**

`sdkwork-birdcoder` 是 SDKWork 的 AI 编程工作台应用。它提供 PC、H5 和
Flutter 三类用户端，同时将可复用的平台领域能力保留在各自的 SDKWork
工程中。

当前应用尚未上线，契约版本为 `0.1.0`。数据库和 API 采用绿地直接切换，
不保留旧路由、影子表、双写、投影权威或兼容 facade。

## 应用端

| 应用端 | 根目录 | 架构规范 |
| --- | --- | --- |
| PC Web 与桌面端 | `apps/sdkwork-birdcoder-pc/` | `APP_PC_ARCHITECTURE_SPEC.md` |
| H5 与 Capacitor | `apps/sdkwork-birdcoder-h5/` | `APP_H5_ARCHITECTURE_SPEC.md` |
| Flutter 移动端 | `apps/sdkwork-birdcoder-flutter-mobile/` | `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md` |

应用身份、运行配置和发布元数据由 `sdkwork.app.config.json` 及各应用端清单
统一声明。

## 领域所有权

BirdCoder 只拥有一个限界上下文：

```text
domain: intelligence
capability: coding-workbench
```

其业务事实仅包括工作区/项目身份、项目文档绑定、项目运行位置与偏好、项目
沙箱绑定。机器权威为 `specs/domain-ownership.spec.json`。

可复用领域必须保留在对应工程中：

| 所有者 | BirdCoder 使用的权威事实 |
| --- | --- |
| `sdkwork-agents` | Agent Project、Session、Turn、Session Item、Interaction、Runtime Binding、Artifact、Checkpoint |
| `sdkwork-skills` | 技能包、版本、制品、能力、安装状态、API、SDK 与运行逻辑 |
| `sdkwork-prompts` | Saved Prompt 身份、内容、生命周期、API 与 SDK |
| `sdkwork-im` | 人际 Conversation、Message、Member、ReadCursor |
| `sdkwork-iam` | 认证、用户、组织、成员关系、角色、权限与审计 |
| `sdkwork-drive` | 沙箱与文件存储 |
| `sdkwork-documents` | 文档身份、内容、生命周期、API 与 SDK |
| 其他 SDKWork 模块 | Appstore、Deployments、Models、Settings、Messaging 与 Commerce 事实 |

AI 助手对话是 Agents Session Item 流，不是 IM 会话，也不得持久化为 IM
Message。BirdCoder 只允许使用 `specs/agent-session-item-view.spec.md` 定义的
内存 UI 适配。

依赖方向固定为：

```text
BirdCoder -> Agents -> Kernel
BirdCoder -> IM
IM -> Agents
Agents -/-> IM
BirdCoder -/-> Kernel
```

## 数据库

BirdCoder 只拥有以下 10 张 `studio_*` 表：

1. `studio_workspace`
2. `studio_project`
3. `studio_project_document_binding`
4. `studio_project_runtime_location`
5. `studio_project_runtime_location_preference`
6. `studio_project_runtime_location_idempotency`
7. `studio_project_runtime_location_audit`
8. `studio_project_sandbox_binding`
9. `studio_project_sandbox_binding_idempotency`
10. `studio_project_sandbox_binding_audit`

表注册表为 `database/contract/table-registry.json`，SQLite 与 PostgreSQL
绿地基线位于 `database/ddl/baseline/`。跨领域标识只保存稳定的不透明引用，
不建立跨领域数据库外键。

## API 与 SDK

| API 面 | 权威文件 | 操作数 |
| --- | --- | ---: |
| App API | `sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json` | 39 |
| Backend API | 无 | 0 |
| Open API | 无 | 0 |

App API 只包含工作区、项目、项目绑定、项目运行位置/偏好、项目 Git 编排和
系统元数据，不复制 Agents、Skills、IM、IAM、Drive 或其他 SDKWork 领域的
路由。

所有前端统一遵循：

```text
UI -> feature service/port -> 注入的生成 SDK client
```

bootstrap 使用应用全局 TokenManager 构造 SDK client。功能 UI 不得直接构造
HTTP client、手工设置认证头、导入其他工程私有源码或维护本地生成 SDK 副本。

## 目录

| 路径 | 职责 |
| --- | --- |
| `apps/` | PC、H5 与 Flutter 应用端 |
| `crates/` | BirdCoder 工作台服务、仓储、路由、宿主与 Git 集成 |
| `sdks/` | BirdCoder 自有 App SDK family |
| `database/` | 10 表工作台数据库权威 |
| `apis/` | API 权威索引 |
| `specs/` | 组件、领域、依赖、IAM 与拓扑契约 |
| `docs/` | 产品、架构、需求、迁移、运维与发布文档 |
| `scripts/` | 架构、生成、构建和验证入口 |
| `etc/` | 源运行配置和部署 profile |

共享 SDKWork 模块通过 `pnpm-workspace.yaml` 引用同级工程，不属于本仓库，
也不得复制到本仓库。

## 开发

基本依赖：Node.js、`pnpm` 10、Rust/Cargo；Flutter 应用端还需要 Flutter。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

常用入口：

```bash
pnpm dev:desktop
pnpm dev:browser:standalone
pnpm dev:browser:cloud
pnpm docs:dev
```

运行参数来自 `etc/` 源配置和 `sdkwork.app.config.json`。不得在客户端源码中
提交密钥或固定生产身份。

## 验证

架构收敛主循环：

```bash
pnpm check:domain-ownership
pnpm check:agents-birdcoder-alignment
pnpm check:kernel-birdcoder-alignment
pnpm check:api-transport-standard
pnpm db:validate
pnpm typecheck
pnpm lint
```

发布或部署变更还必须执行 `AGENTS.md` 与 `sdkwork-specs` 选择的发布流程和目标
宿主验证。

## 文档权威

- `docs/README.md`：文档索引。
- `docs/product/prd/PRD.md`：产品权威。
- `docs/architecture/tech/TECH_ARCHITECTURE.md`：技术架构权威。
- `apis/README.md`：当前项目 API 列表。
- `database/README.md`：当前项目数据库设计。
- `specs/README.md`：本地机器契约与说明索引。

全局 SDKWork 规则位于同级 `sdkwork-specs` 工程。本仓库只引用规范，不复制
其规范正文。
