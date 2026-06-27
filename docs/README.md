# SDKWork BirdCoder Documentation

This directory contains repository-level documentation, architecture decisions, runbooks, design notes, changelogs, and user/developer guides.

## Purpose

Shared documentation across all application surfaces (PC, H5, Flutter).

## Directory Structure

| Directory | Description |
| --- | --- |
| `architecture/` | 技术架构 Canon、拓扑标准、ADR |
| `architecture/tech/` | TECH-*.md 技术架构分片，入口为 `TECH_ARCHITECTURE.md` |
| `archive/` | 历史文档（对齐报告、迁移计划、遗留存根） |
| `changelogs/` | 变更日志 |
| `contributing/` | 贡献者指南（VitePress 页面） |
| `core/` | 核心文档（架构、包、发布与部署） |
| `domains/` | 领域文档 |
| `engineering/` | 工程文档 |
| `guide/` | 用户指南 |
| `guides/operator/` | 运维与生产指南 |
| `migrations/` | 迁移文档 |
| `product/prd/` | 产品需求文档（PRD） |
| `prompts/` | Prompt 模板 |
| `reference/` | API 参考、命令、环境变量 |
| `release/` | 发布记录与 `releases.json` 注册表 |
| `releases/` | 发布历史（旧版入口） |
| `runbooks/` | 运行手册 |
| `.vitepress/` | VitePress 配置 |

## Canon Documents

| Document | Path |
| --- | --- |
| Product PRD | [product/prd/PRD.md](product/prd/PRD.md) |
| PRD-01 产品设计与需求范围 | [product/prd/PRD-01-productdesignrequirementsscope.md](product/prd/PRD-01-productdesignrequirementsscope.md) |
| PRD-01 基线审计 | [product/prd/PRD-01-baseline-audit.md](product/prd/PRD-01-baseline-audit.md) |
| Technical architecture | [architecture/tech/TECH_ARCHITECTURE.md](architecture/tech/TECH_ARCHITECTURE.md) |
| 技术架构索引 | [architecture/tech/TECH-index.md](architecture/tech/TECH-index.md) |
| Topology standard | [architecture/topology-standard.md](architecture/topology-standard.md) |
| Shared package verification | [reference/shared-package-dependency-verification.md](reference/shared-package-dependency-verification.md) |
| Contributor guide | [../CONTRIBUTING.md](../CONTRIBUTING.md) |

## Operator and Production Guides

| Guide | Path |
| --- | --- |
| Operator index | [guides/operator/README.md](guides/operator/README.md) |
| Deployment | [guides/operator/deployment-operations.md](guides/operator/deployment-operations.md) |
| Backup and restore | [guides/operator/backup-restore.md](guides/operator/backup-restore.md) |
| Monitoring | [guides/operator/monitoring.md](guides/operator/monitoring.md) |
| Incident response | [guides/operator/incident-response.md](guides/operator/incident-response.md) |

## Developer Reference

| Reference | Path |
| --- | --- |
| API reference | [reference/api-reference.md](reference/api-reference.md) |
| Engine SDK integration | [reference/engine-sdk-integration.md](reference/engine-sdk-integration.md) |
| Environment variables | [reference/environment.md](reference/environment.md) |
| Commands | [reference/commands.md](reference/commands.md) |

## Archive

Historical documents (alignment reports, migration plans, legacy stubs) are stored in [archive/](archive/).

## Related Specs

- `../sdkwork-specs/DOCUMENTATION_SPEC.md`
- `../sdkwork-specs/DEPLOYMENT_SPEC.md`
- `../sdkwork-specs/OBSERVABILITY_SPEC.md`

## Verification

- `pnpm check:live-docs-governance-baseline`
- `node scripts/commercial-readiness-truth-contract.test.mjs`
