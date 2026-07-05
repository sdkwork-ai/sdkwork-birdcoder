# PRD-01 基线审计

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder
Updated: 2026-07-04
Parent: [PRD.md](PRD.md)

本分片记录 SDKWork BirdCoder 的商业化就绪度基线审计框架与开放差距摘要。

> **Authoritative truth pointer:** 商业化就绪度的当前权威快照为 [`docs/architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md`](../../architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md)。具体 Phase 闭环状态、OpenAPI 161/0 注册表、manifest 诚实性、以及各 surface 就绪度以 TECH 文档为准。

## 1. 审计背景

SDKWork BirdCoder 是面向专业开发者的 AI 编码协作平台，承载 PC / H5 / Flutter 多面应用体系与 Rust standalone-gateway 后端。

当前 `sdkwork.app.config.json` 处于 `DRAFT` / `preLaunch: true`，安装包均 `enabled: false`（`artifactPending: true`）。在首个 governed release 完成前，不具备公开商业化落地能力。

## 2. 审计范围

功能完整性、性能、安全、高可用、数据契约、移动端、设计、文档——均对照 `sdkwork-specs` 标准执行。

## 3. 审计结果摘要（2026-07-04）

| 指标 | 当前状态 |
| --- | --- |
| 商业化就绪度评分 | **5.5 / 10**（工程治理强；发布证据与 commerce 业务层待补齐） |
| OpenAPI Rust 对齐 | **161 / 161 已实现，0 deferred** |
| P0 阻断项 | **已闭环** |
| P1 严重项 | **修复中**（commerce 订单/发票/支付服务、真实 release 证据、iOS CI） |
| Manifest 诚实性 | **DRAFT/preLaunch，安装包 disabled** |

## 4. 2026-07-04 工程闭环

| 项 | 状态 |
| --- | --- |
| Commerce 配额共享 crate | `sdkwork-birdcoder-commerce-quota`；turn 创建前校验 + 成功后记录 `METRIC_API_REQUESTS` |
| 移动端 chat 助手回复 | `generate_mobile_chat_assistant_reply`（kernel-bridge）；H5/Flutter 发送后重载历史 |
| H5 chat i18n | `chatPageMessages.ts`（en / zh-Hans / zh-Hant） |
| Code engine provider | 标准 provider 去除 `panic!`，结构化 registration |
| Workspace 治理 | `pnpm-workspace.yaml` 含 common/flutter/h5/pc 显式 app root + 架构限定 glob |

## 5. 核心开放差距

### 5.1 功能

- Commerce 业务层：usage metering 与 api-keys 已落地；order / invoice / payment 业务服务待实现
- 移动端 IDE parity：编码会话 multi-turn、终端、git overview 尚未在三端对齐
- Flutter Drive 附件 lane 仍 defer

### 5.2 安全

- Web 会话 `sessionStorage` 需在 SaaS 模式评估 httpOnly cookie 迁移
- Tauri 路径级 sandbox 需持续强化

### 5.3 高可用

- PostgreSQL HA overlay 为模板级；生产备份演练未完成
- 默认 SQLite 引擎限 standalone；SaaS 必须 PostgreSQL

### 5.4 数据契约

- locale-aware 种子除 `zh-CN` 外仍基本为空

### 5.5 移动端

- H5/Flutter chat i18n 基础 catalog 已补齐；全局 `I18N_SPEC.md` catalog 体系仍需扩展
- iOS Capacitor headless build CI 待接入

## 6. 修复路线图

| 阶段 | 目标 |
| --- | --- |
| 阶段 1 | P0 阻断项闭环（**已完成**） |
| 阶段 2 | P1 闭环 + P2 打磨（**进行中**） |
| 阶段 3 | Commerce 业务服务 + governed release 证据 |
| 阶段 4 | Beta smoke 与 manifest 安装包启用 |

## 7. 结论

工程治理与 OpenAPI 契约已显著对齐 sdkwork-specs，但 **尚未具备公开商业化落地能力**。需完成 governed release（`release:assert-ready`）、commerce 业务闭环与生产 HA 演练后，方可进入 commercial launch（目标 **7 / 10**）。
