# 贡献者指南

SDKWork BirdCoder 贡献者遵循与 Claw Studio 相同的包优先架构纪律，同时保持 BirdCoder 业务模块的产品特定性。

## 贡献期望

- 保留 BirdCoder 包名和产品标识
- 通过共享发布脚本和工作流保持交付模式对齐
- 优先保持架构形态对齐，而非功能复制
- 关闭面向发布的工作前必须运行 `pnpm lint`、`pnpm build` 和 `pnpm docs:build`

## 规范参考

- [架构](docs/core/architecture.md)
- [包](docs/core/packages.md)
- [发布与部署](docs/core/release-and-deployment.md)
- [技术架构 Canon](docs/architecture/tech/TECH_ARCHITECTURE.md)
- [命令参考](docs/reference/commands.md)

## 开发流程

1. 克隆仓库后运行 `pnpm install` 安装依赖
2. 使用 `pnpm dev` 启动默认私有 BirdCoder Web 示例栈
3. 使用 `pnpm dev:local` 启动单机 BirdCoder 示例循环（桌面本地 Tauri 主机）
4. 提交前运行 `pnpm lint` 确保代码风格一致
5. 构建前运行 `pnpm build` 验证生产构建
6. 文档变更后运行 `pnpm docs:build` 验证 VitePress 输出

## 验证命令

详细的验证命令清单请参考 [命令参考](docs/reference/commands.md)。
