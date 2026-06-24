# Step 08 - Terminal 外部工程集成边界与接入标准

## 1. 目标

把 Step 08 从“本仓实现 Terminal Runtime/CLI/SQLite”调整为“定义外部 Terminal 工程集成边界”。BirdCoder 只冻结接入协议、启动映射、治理回写和发布接口，不在本仓实现终端本体。

## 2. 上游依赖

- `/docs/架构/02-架构标准与总体设计.md`
- `/docs/架构/03-模块规划与边界.md`
- `/docs/架构/15-工作台偏好-终端运行时-本地存储补充标准.md`
- `/docs/架构/16-终端主机会话-运行配置-本地存储标准.md`
- `/docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`
- `/docs/架构/21-多Code-Engine协议-SDK-适配标准.md`
- Step `05`
- Step `09`
- Step `17`
- Step `18`

## 3. 非目标

- 本仓不实现 PTY 与终端执行引擎。
- 本仓不实现 CLI Registry 与 Launch Guard 业务细节。
- 本仓不实现 `terminal_session / terminal_execution` authority 表、Repository、SQLite 迁移。
- 本仓不继续深化 Terminal 专属 UI。

## 4. 核心输出

- 外部 Terminal 工程接入协议。
- `run_configuration -> external_terminal_launch_request` 映射。
- 外部会话引用、证据引用、审计引用标准。
- Desktop / Web / Server 的外部 Terminal 启动边界。
- 外部工程版本固定、兼容矩阵、回滚入口。

## 5. Review 重点

- 是否不再让 Terminal 阻塞 `Code / Studio` 主线。
- 是否把 Terminal authority 明确留在外部工程。
- 是否保证发布、审计、证据链仍然闭环。

## 6. 实施建议

- 车道 D1：冻结集成协议、字段、版本矩阵。
- 车道 D2：实现宿主侧启动桥接、上下文映射、状态摘要消费。
- 车道 D3：打通审计摘要、release evidence、回滚接口。

## 7. 完成定义

- BirdCoder 可通过统一请求启动外部 Terminal。
- `Code / Studio` 可共享同一套外部 Terminal 启动语义。
- Release / 审计 / 文档可消费外部 Terminal 摘要与证据引用。
- Step `09/17` 不再依赖本仓 Terminal Runtime 落地。

## 8. 检查点

- `CP08-1` 外部 Terminal 接入 contract 冻结。
- `CP08-2` `Code / Studio` 启动映射冻结。
- `CP08-3` 外部证据、审计、发布回写接口冻结。
- `CP08-4` 本仓 Terminal 本体实现目标明确删除，不再继续扩张。

## 9. 风险与回滚

- 风险：外部工程版本漂移导致 BirdCoder 集成失真。
- 风险：本仓误把外部 session/output 拉回本地重建 authority。
- 回滚：只回退集成 adapter 与版本绑定，不回退 `Code / Studio` 主线架构。

## 10. 下一步

1. 先完成 `Code / Studio / coding-server` 主线。
2. 在外部 Terminal 工程版本冻结后，再进入接入实现。
3. 接入完成后回写架构、Step、Prompt、Release。
