# 贡献者指南

SDKWork BirdCoder 遵循包优先架构纪律，所有 SDKWork 平台能力通过 workspace federation 引入。

## 贡献期望

- 遵循 `sdkwork-specs/` 定义的 SDKWork 标准
- 通过共享发布脚本和工作流保持交付模式对齐
- 优先保持架构形态对齐，而非功能复制
- 关闭面向发布的工作前必须运行 `pnpm lint`、`pnpm run check:arch` 和 `pnpm docs:build`

## 规范参考

- [AGENTS.md](AGENTS.md) — 本地 Agent 入口和规范索引
- [sdkwork.app.config.json](sdkwork.app.config.json) — 应用身份和能力元数据
- [技术架构文档](docs/architecture/tech/TECH_ARCHITECTURE.md) — 系统技术架构规范
- [产品需求文档](docs/product/prd/PRD.md) — 产品设计定义
- [docs/README.md](docs/README.md) — 文档结构总览

## 开发流程

1. **环境准备**
   ```bash
   # 克隆平台依赖仓库（自动脚本）
   node scripts/bootstrap-workspace.mjs
   
   # 安装依赖
   pnpm install
   ```

2. **启动开发**
   ```bash
   # 默认私有 BirdCoder Web 栈
   pnpm dev
   
   # 单机桌面本地 Tauri 主机
   pnpm dev:desktop:local
   ```

3. **提交前检查**
   ```bash
   # 代码风格和静态检查
   pnpm lint
   
   # 架构契约验证
   pnpm run check:arch
   
   # TypeScript 类型检查
   pnpm typecheck
   ```

4. **持续验证**
   ```bash
   # 针对改动运行窄领域检查
   pnpm run check:desktop   # 桌面端
   pnpm run check:server    # 服务端
   pnpm run check:multi-mode # 全平台
   ```

## 验证命令

完整的验证命令清单请参考 [docs/README.md](docs/README.md) 中的"验证命令"章节。

## 提交规范

- 使用简短的祈使句格式，例如 `fix release asset manifest layout`
- Pull Request 需说明改动的架构区域、涉及的包/层、验证命令和关键输出
- UI 变更需附加截图
