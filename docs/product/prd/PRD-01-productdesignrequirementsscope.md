# PRD-01 产品设计与需求范围

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder
Updated: 2026-06-26
Parent: [PRD.md](PRD.md)

本分片定义 SDKWork BirdCoder 的产品定位、目标用户、功能范围、设计要求与非功能要求，作为产品设计与商业化能力的范围基线。

## 1. 产品定位

SDKWork BirdCoder 是面向专业开发者的 AI 编码协作平台，以 SDKWork 合约治理（OpenAPI / generated SDK / IAM / 发布证据）为底座，提供跨 PC、H5、Flutter 三端一致的 AI 编码会话与工作台体验。当前 `sdkwork.app.config.json` 处于 `DRAFT` / `preLaunch`，本分片描述的是首个 governed release 应达到的范围基线。

## 2. 目标用户

- 主要：专业开发者（VS Code / Cursor 用户），需在本地或托管 SDKWork tenant 下进行 AI 编码协作
- 次要：企业开发团队，需共享工作区、项目与部署治理；教育机构，需受控的编码教学环境

## 3. 产品功能范围

### 3.1 核心

- AI 编码会话：multi-turn 对话、文件系统操作、终端集成、git overview
- 工作台：skills、templates、studio、projection 等产品模块（见 `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-*`）

### 3.2 引擎

四引擎集成（`external/` 已纳管对应 CLI 工程，PC 端 `sdkwork-birdcoder-pc-codeengine` 包提供引擎抽象）：

- codex
- claude-code
- gemini
- opencode

### 3.3 三端

- PC（React + Tauri，`apps/sdkwork-birdcoder-pc/`）— 浏览器 Web 与桌面 Tauri 双交付（当前主要实现面）
- H5（Capacitor，`apps/sdkwork-birdcoder-h5/`）— 移动 Web / Capacitor 原生壳（当前为骨架）
- Flutter Mobile — 三端之一，规划中以草稿状态登记，待建立独立应用根目录

三端需按 `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` 对齐包角色、route id、i18n key、SDK surface、host adapter 契约。

### 3.4 IAM

- 双 token JWT（access / refresh）
- tenant / organization / user 三元主体隔离
- 登录、注册、组织选择、AuthGate、logout 由 `sdkwork-appbase` IAM runtime 统一治理

### 3.5 商业化

商业化域（`database.manifest.json` 已声明 `commerce_` 表前缀，业务模块待落地）：

- order（订单）
- invoice（发票）
- payment（支付）
- usage metering（用量计量）
- API key（API 密钥管理与轮换）
- notification（通知）

## 4. 产品设计要求

- 视觉 / UI 对齐 Chrome / Edge / Arc 浏览器专业标准
- 设置页允许切换不同引擎（WebView / Servo / CEF）
- 三端功能对齐，避免单端独占业务逻辑
- 用户界面遵循 `FRONTEND_SPEC.md`、`UI_ARCHITECTURE_SPEC.md` 与各端 UI 架构规范

## 5. 非功能要求

- 性能：关键交互 p95 < 100ms（遵循 `PERFORMANCE_SPEC.md`）
- 安全：sandbox + RBAC + 审计（遵循 `SECURITY_SPEC.md`，含 Tauri host capability 白名单）
- 高可用：SLO 99.9%
- 可观测性：OpenTelemetry 全栈（日志 / 指标 / 链路，遵循 `OBSERVABILITY_SPEC.md`）

## 6. 商业化能力

- 会员套餐：free / pro / enterprise
- API key 管理 + 轮换
- Usage metering + 实时聚合
- Rate limiting / quota

商业化能力为首个 governed release 的范围目标；当前实现状态见 [PRD-01-baseline-audit.md](PRD-01-baseline-audit.md)。

## 7. 发布计划

与 `sdkwork.app.config.json` 的 `commercialReadiness` 与 PRD 发布阶段对齐：

1. PC private beta — standalone / cloud server profiles
2. Enterprise K8s — PostgreSQL HA overlay 与备份演练
3. Governed public release — 真实 artifacts + unified manifest truth
4. Mobile store lanes — Flutter / iOS release CI 与 catalog assets 完成后

## 8. Open Questions

- `@sdkwork/birdcoder-pc-server` 模块边界拆分时间表（当前为大型聚合包，与 PRD.md §9 一致）
