# 技术架构目录

本目录持有仓库的技术架构 Canon。

## 固定入口

- [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) — 必需入口文档，包含完整 Document Map。
- [TECH-index.md](TECH-index.md) — 精选技术架构索引，按类别组织关键文档入口。

## 拆分规则

- 将大型架构内容拆分为同级分片，命名为 `TECH-<kebab-topic>.md`。
- 每个分片 `MUST` 从 `TECH_ARCHITECTURE.md` 链接。
- 禁止创建竞争性架构根，如 `docs/architecture/TECH_ARCHITECTURE.md`；该路径已退役，仅保留重定向。

参见 `DOCUMENTATION_SPEC.md` 第 2.2 节。

## 文档评估（2026-06-26）

### 统计

- TECH-*.md 文件总数：468
- TECH-release-*.md 文件数：200+（镜像副本）

### 评估结果

| 类别 | 数量 | 说明 |
| --- | --- | --- |
| 独立技术文档 | ~180 | 包含架构标准、Step 流程、治理标准、Kernel 对齐等真正独立的技术文档 |
| 镜像副本（建议删除） | 200+ | `TECH-release-YYYY-MM-DD-NN.md` 文件是 `docs/release/release-YYYY-MM-DD-NN.md` 的镜像副本，以 `> Migrated from` 头部标识 |

### 建议删除的文件

`TECH-release-YYYY-MM-DD-NN.md` 系列文件（200+个）是 `docs/release/` 目录下发布笔记的镜像副本。这些文件：

1. 内容与 `docs/release/release-*.md` 完全相同
2. 发布笔记的权威来源是 `docs/release/releases.json` 注册表和 `docs/release/release-*.md` 原始文件
3. 镜像副本存在于 `TECH_ARCHITECTURE.md` 的 Document Map 中，导致索引膨胀

**建议操作**：经用户确认后，删除所有 `TECH-release-YYYY-MM-DD-NN.md` 镜像副本，并从 `TECH_ARCHITECTURE.md` 的 Document Map 中移除对应链接。

### 非镜像的 TECH-release-* 文件

以下文件名称以 `TECH-release-` 开头，但 **不是** 发布笔记镜像，应保留：

- `TECH-release-and-deployment.md` — 从 `docs/core/release-and-deployment.md` 迁移的发布与部署架构文档

