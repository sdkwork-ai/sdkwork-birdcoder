# PRD-01 基线审计

Status: active
Owner: SDKWork maintainers
Application: sdkwork-birdcoder
Updated: 2026-06-27
Parent: [PRD.md](PRD.md)

本分片记录 SDKWork BirdCoder 的商业化就绪度基线审计结果，作为修复路线图的输入依据。

> **Authoritative truth pointer:** 商业化就绪度的当前权威快照为 [`docs/architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md`](../../architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md)。2026-06-27 的再评估在该基线之上识别出额外的 P0/P1 问题（manifestHonesty、god module、iOS Info.plist、SecureStorage 命名、workspace federation、chat 后端缺失、OpenAPI 计数声明等），其闭环进度以该 TECH 文档为准；本分片的 P0/P1 计数为基线审计时点的发现，可能与后续再评估的计数不同。

## 1. 审计背景

SDKWork BirdCoder 是面向专业开发者的 AI 编码协作平台，承载多面应用体系：

- PC 端（React + Tauri，`apps/sdkwork-birdcoder-pc/`）— 浏览器 Web 与桌面 Tauri 双交付形态
- H5 端（Capacitor，`apps/sdkwork-birdcoder-h5/`）— 移动 Web / Capacitor 原生壳
- Flutter 移动端（`apps/sdkwork-birdcoder-flutter-mobile/`）— 三端之一，已在 `sdkwork.app.config.json` 的 `commercialReadiness` 与 `manifestHonesty` 中以草稿/预发布状态登记，应用根目录含 `lib/`、`packages/`、`sdks/`，主题切换与 chat UI 已接入（chat 后端仍为 mock，详见 TECH 文档 §15）
- Rust 服务端 — `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/` 提供本地 API 服务主机

当前 `sdkwork.app.config.json` 整体处于 `DRAFT` / `preLaunch: true`，安装包均 `enabled: false`（`artifactPending: true`），尚未具备商业化落地能力。本次审计目的是在首个 governed release 之前量化就绪度差距并给出修复路线图。

## 2. 审计范围

审计覆盖以下维度：

- 功能完整性 — 三端功能覆盖、AI 编码会话、引擎集成、商业化域
- 性能 — 延迟预算、并发能力、资源占用
- 安全 — sandbox、RBAC、token 模型、capabilities、审计
- 高可用 — 数据库 HA、SLO、备份恢复
- 数据契约 — 表前缀、种子、drift policy、迁移生命周期
- 移动端 — i18n、原生能力覆盖、Capacitor/Flutter 路线
- 设计 — 视觉与交互专业度
- 文档 — Canon 完整性、引用一致性

## 3. 审计标准

审计依据 `sdkwork-specs` 仓库标准，重点引用：

- `SOUL.md`、`AGENTS_SPEC.md` — 执行契约与字典解析
- `SECURITY_SPEC.md` — token、sandbox、tenant 隔离、capabilities
- `DATABASE_SPEC.md`、`DATABASE_FRAMEWORK_SPEC.md` — 表契约、迁移、种子、drift 生命周期
- `RELEASE_SPEC.md`、`SUPPLY_CHAIN_SECURITY_SPEC.md` — 发布证据、SBOM、签名、checksum
- `IAM_SPEC.md`、`IAM_LOGIN_INTEGRATION_SPEC.md` — 双 token、tenant/organization/user 三元主体隔离
- `APP_PC_ARCHITECTURE_SPEC.md`、`DESKTOP_APP_ARCHITECTURE_SPEC.md` — PC/Tauri 架构与 capabilities
- `APP_H5_ARCHITECTURE_SPEC.md`、`FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md` — H5/Flutter 架构对齐
- `DOCUMENTATION_SPEC.md` — Canon 布局与 PRD 分片规则

## 4. 审计结果摘要

- 商业化就绪度评分：当前 **2.5 / 10**；按修复路线图执行后预估可达 **7 / 10**（commercial launch 门槛）
- P0 阻断项：**12 个**（已闭环）
- P1 严重项：**14 个**（修复中）
- P2 改进项：**9 个**
- P3 优化项：**6 个**

`sdkwork.app.config.json` 的 `commercialReadiness` 现状佐证该评分：`pcPrivateBeta` 报告 OpenAPI `100-paths-147-methods-iam-federation-teams-aligned`（132/147 操作已实现，15 个 commerce 操作 pre-launch deferred），但 `saasPublicCloud` 仍为 `prelaunch-artifacts-pending`，`releaseGovernanceCI` 为 `pending-release-validation`。

## 5. 核心问题清单（按维度）

### 5.1 功能

- H5 / Flutter 功能对齐不足：H5 端已有 `App.tsx` 入口、chat UI（mock）、Capacitor 主机壳，但 AI 编码会话核心能力未对齐；Flutter 端已有独立应用根目录（`apps/sdkwork-birdcoder-flutter-mobile/`，含 `lib/`、`packages/`、`sdks/`）、主题切换、chat UI（mock），但编码会话与原生能力覆盖仍不足
- 商业化域缺失：`database.manifest.json` 已声明 `commerce_` 表前缀，但 order / invoice / payment / usage metering / API key / notification 等业务模块尚未落地
- AI 编码会话核心能力（multi-turn、文件系统操作、终端集成、git overview）尚未在 H5/Flutter 对齐

### 5.2 安全

- `codex.rs` 旁路：PC 服务端存在绕过标准 web-framework / generated SDK 边界的直接调用路径
- Tauri host capabilities 缺失：`sdkwork-birdcoder-pc-desktop/src-tauri` 未声明完整的 native capability 白名单，sandbox 边界不完整
- 双 token JWT 与 tenant/organization/user 三元主体隔离在部分路径未闭环

### 5.3 高可用

- SQLite 单写：`database.manifest.json` `defaultEngine: "sqlite"`，单写者模型无法支撑商业并发
- PostgreSQL HA overlay 缺失：`commercialReadiness.enterpriseK8s` 仅为 `postgresql-ha-backup-template-ci-smoke` 模板级，未落地真实 HA 与备份演练

### 5.4 数据契约

- tablePrefix 冲突：`database.manifest.json` 声明 `ai_ / commerce_ / ops_ / runtime_ / studio_` 前缀与 `contract/prefix-registry.json`、`contract/table-registry.json` 双轨登记，存在冲突与权威不清风险
- 种子缺失：`database/seeds/common/` 与各 locale 目录（en-US / ja-JP / de-DE / fr-FR / ru-RU / ko-KR）仅 `.gitkeep`，仅 `zh-CN` 为 active，locale-aware 种子基本为空
- drift policy 空骨架：`database/drift/policy.yaml` 仅含空数组（`ignoreTables: []`、`ignoreColumns: []`、`severityOverrides: {}`），无生效规则

### 5.5 移动端

- i18n 缺失：移动端未建立 message catalog，未对齐 `I18N_SPEC.md`
- 原生能力覆盖 2 / 15：Capacitor / Flutter 原生插件覆盖严重不足

## 6. 修复路线图

路线图分四阶段，总计约 8 周：

| 阶段 | 时间窗口 | 目标 |
| --- | --- | --- |
| 阶段 1 | 2026-06-27 ~ 2026-07-15 | P0 阻断项闭环（已闭环） |
| 阶段 2 | 2026-07-16 ~ 2026-08-05 | P1 闭环 + P2 打磨 |
| 阶段 3 | 2026-08-06 ~ 2026-08-15 | P3 商业化能力补齐 |
| 阶段 4 | 2026-08-12 ~ 2026-08-15 | Beta release smoke 验收 |

## 7. 结论

当前 SDKWork BirdCoder 不具备商业化落地能力：核心评分 2.5/10，`sdkwork.app.config.json` 仍处于 `DRAFT` / `preLaunch`，安装包均未启用。需按上述四阶段路线图执行 8 周，使就绪度达到 7/10 commercial launch 门槛后，方可进入首个 governed release。
