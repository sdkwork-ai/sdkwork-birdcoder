> Owner: SDKWork maintainers
> Updated: 2026-06-26

# 技术架构索引

本文件是 `docs/architecture/tech/` 目录的精选技术架构索引，按类别组织关键文档入口。完整的文档清单请参考 [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) 的 Document Map。

## Canon 入口

- [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) — 技术架构 Canon 入口文档，包含完整 Document Map

## 架构总览与边界

- [TECH-02-architecturestandardoverviewdesign.md](TECH-02-architecturestandardoverviewdesign.md) — 架构标准总览设计
- [TECH-03-modulesplanningboundaries.md](TECH-03-modulesplanningboundaries.md) — 模块规划与边界
- [TECH-04-tech-stack.md](TECH-04-tech-stack.md) — 技术栈
- [TECH-04-workspace-project-auth-settingsgovernance.md](TECH-04-workspace-project-auth-settingsgovernance.md) — 工作区、项目、认证与设置治理

## Code Engine 与 SPI

- [TECH-05-code-engine-spi.md](TECH-05-code-engine-spi.md) — Code Engine SPI
- [TECH-05-kernelcode-enginestandard.md](TECH-05-kernelcode-enginestandard.md) — Kernel Code Engine 标准
- [TECH-18-code-engine-adapter.md](TECH-18-code-engine-adapter.md) — 多 Code Engine Adapter 统一工具协议
- [TECH-22-code-engine-standard.md](TECH-22-code-engine-standard.md) — 多 Code Engine 源码镜像真相补充标准

## Coding Server 与 SDK

- [TECH-17-coding-server-app-backend-sdk.md](TECH-17-coding-server-app-backend-sdk.md) — Coding Server App Backend SDK 与控制台实现
- [TECH-20-rust-coding-server-api-standard.md](TECH-20-rust-coding-server-api-standard.md) — 统一 Rust Coding Server API 协议标准
- [TECH-21-code-engine-sdk-standard.md](TECH-21-code-engine-sdk-standard.md) — Code Engine SDK 标准

## 运行时与数据

- [TECH-02-shell-host-kernel.md](TECH-02-shell-host-kernel.md) — Shell Host Kernel
- [TECH-20-runtime-data-kernel-v2-authority.md](TECH-20-runtime-data-kernel-v2-authority.md) — 运行时数据 Kernel V2 权威

## IAM 集成

- [TECH-14-sdkwork-iam-integration.md](TECH-14-sdkwork-iam-integration.md) — SDKWork IAM 集成
- [TECH-17-sdkwork-iam-auth-user-standard.md](TECH-17-sdkwork-iam-auth-user-standard.md) — SDKWork IAM Auth User 标准

## 发布与部署

- [TECH-09-installation-deployment-releasestandard.md](TECH-09-installation-deployment-releasestandard.md) — 安装、部署、发布标准
- [TECH-09-server-runtime-openapi.md](TECH-09-server-runtime-openapi.md) — Server Runtime OpenAPI 桌面服务双模落地
- [TECH-11-docker-k8s-deployment-release.md](TECH-11-docker-k8s-deployment-release.md) — Docker、K8s 部署打包 Release 链路
- [TECH-13-release-github-flow.md](TECH-13-release-github-flow.md) — 发布就绪 GitHub Flow 灰度回滚闭环

## 治理标准

- [TECH-23-coding-server-engine-truth-promotion-standard.md](TECH-23-coding-server-engine-truth-promotion-standard.md) — Coding Server Engine Truth 提升标准
- [TECH-24-rust-host-engine-truth-artifact-standard.md](TECH-24-rust-host-engine-truth-artifact-standard.md) — Rust Host Engine Truth Artifact 标准
- [TECH-25-rust-host-engine-route-parity-standard.md](TECH-25-rust-host-engine-route-parity-standard.md) — Rust Host Engine Route Parity 标准
- [TECH-26-step-18-engine-governance-release-flow-standard.md](TECH-26-step-18-engine-governance-release-flow-standard.md) — Step 18 Engine Governance Release Flow 标准
- [TECH-27-step-18-engine-governance-score-surface-standard.md](TECH-27-step-18-engine-governance-score-surface-standard.md) — Step 18 Engine Governance Score Surface 标准
- [TECH-28-governance-regression-deterministic-baseline-standard.md](TECH-28-governance-regression-deterministic-baseline-standard.md) — Governance Regression Deterministic Baseline 标准
- [TECH-29-multi-engine-official-sdk-runtime-selection-standard.md](TECH-29-multi-engine-official-sdk-runtime-selection-standard.md) — 多 Engine 官方 SDK 运行时选择标准
- [TECH-29-web-bundle-segmentation-and-production-build-standard.md](TECH-29-web-bundle-segmentation-and-production-build-standard.md) — Web Bundle 分段与生产构建标准

## Kernel 对齐

- [TECH-30-kernel-birdcoder-boundariesstandard.md](TECH-30-kernel-birdcoder-boundariesstandard.md) — Kernel BirdCoder 职责边界标准
- [TECH-31-kernel-birdcoder-integrationimplementation.md](TECH-31-kernel-birdcoder-integrationimplementation.md) — Kernel BirdCoder 集成实现
- [TECH-32-kernel-birdcoder.md](TECH-32-kernel-birdcoder.md) — Kernel BirdCoder 总表
- [TECH-kernel.md](TECH-kernel.md) — Kernel 对齐指令

## Step 流程

- [TECH-step.md](TECH-step.md) — 反复执行 Step 指令
- [TECH-90-architecture-step.md](TECH-90-architecture-step.md) — Architecture Step
- [TECH-91-step-audit.md](TECH-91-step-audit.md) — Step 审计
- [TECH-92-step.md](TECH-92-step.md) — Step 流程
- [TECH-95-architecture-standard.md](TECH-95-architecture-standard.md) — 架构标准
- [TECH-97-step-architecture.md](TECH-97-step-architecture.md) — Step 架构
- [TECH-99-step.md](TECH-99-step.md) — Step 总览

## 测试与质量

- [TECH-06-testing.md](TECH-06-testing.md) — 测试
- [TECH-12-testing.md](TECH-12-testing.md) — 测试矩阵、质量门禁、回归自动化
- [TECH-12-auditstandard.md](TECH-12-auditstandard.md) — 审计标准

## 参考文档

- [TECH-commands.md](TECH-commands.md) — 命令参考
- [TECH-environment.md](TECH-environment.md) — 环境变量
- [TECH-getting-started.md](TECH-getting-started.md) — 快速开始
- [TECH-install-and-deploy.md](TECH-install-and-deploy.md) — 安装与部署
- [TECH-development.md](TECH-development.md) — 开发指南
- [TECH-desktop.md](TECH-desktop.md) — 桌面端
- [TECH-application-modes.md](TECH-application-modes.md) — 应用模式
- [TECH-api-reference.md](TECH-api-reference.md) — API 参考

## 贡献者指南

贡献者指南已迁移至仓库根目录 [CONTRIBUTING.md](../../../CONTRIBUTING.md)。
