# Step 05 - Code Engine SPI 与统一会话内核

## 1. 目标与范围

建立 BirdCoder 的统一 Code Engine SPI，让 `Claude Code / Codex / Gemini / OpenCode` 在会话、能力声明、错误语义、审批和 UI 交互上共享同一内核标准。

## 2. 执行输入

- `/docs/架构/04`、`05`、`19`、`21`
- Step `03-04` 冻结的模型、DTO、上下文语义
- `external/` 中四类 Engine 源码快照与 SDK/协议资料

## 3. 本步非目标

- 不落地完整 `coding-server` API
- 不完成所有 Engine 运行时接线
- 不实现发布与部署链

## 4. 最小输出

- Engine Descriptor
- Model Catalog
- Capability Matrix
- Session Policy
- Canonical Event Kinds
- Approval Policy 基线

## 5. 推荐 review 产物

- Engine 能力矩阵
- Session/Runtime 语义表
- Canonical Event 映射草案

## 6. 推荐并行车道

- 执行模式：串行收口
- 车道 A：Registry/Capability
- 车道 B：Session/Runtime
- 车道 C：Adapter 契约只读审校

## 7. 架构能力闭环判定

- `Code / Studio / Server` 与外部 Terminal 集成入口都能消费同一 Engine 与 Session 标准
- 引擎切换不再需要页面层分叉

## 8. 完成后必须回写的架构文档

- `/docs/架构/04-技术选型与可插拔策略.md`
- `/docs/架构/05-统一Kernel与Code Engine标准.md`
- `/docs/架构/19-统一会话运行时-Prompt-SkillHub-AppTemplate标准.md`
- `/docs/架构/21-多Code-Engine协议-SDK-适配标准.md`

## 9. 设计

- Engine 与 Model 分离
- `coding_session` 是稳定业务容器，provider-native `thread/session/code-session` 只进入 runtime 元数据
- Event、Artifact、Approval、Operation 用统一语义建模

## 10. 实施落地规划

1. 冻结 `EngineDescriptor`、`EngineCapabilityMatrix`、`ModelCatalogEntry`、`SessionPolicy`。
2. 冻结 Canonical Event、Approval Policy、Transport Kind。
3. 冻结 Engine Registry、默认模型、阻断规则。
4. 为 `06/07/16/18` 输出统一消费面，并为 Step `08` 保留统一接入契约。

## 11. 测试计划

- Capability/Registry Contract Test
- Session/Runtime 类型校验
- Canonical Event 不漂移校验

## 12. 结果验证

- 多 Engine 从“各自接入”变为“统一标准接入”
- `Code / Studio` 与外部 Terminal 集成入口能共享同一 Session 与 Capability 语义

## 13. 检查点

- `CP05-1`：SPI 与 Capability 模型冻结
- `CP05-2`：Registry/Model Catalog/Transport Kind 冻结
- `CP05-3`：Canonical Event 与 Approval Policy 冻结

## 14. 风险与回滚

- 风险：在 SPI 未冻结前并行做适配，会导致 UI 和协议双漂移
- 回滚：若语义冲突，先回退到 Descriptor、Capability、Event 主标准

## 15. 完成定义

- BirdCoder 已拥有统一 Engine SPI 与统一会话内核

## 16. 快速并行执行建议

- A 车道先冻结 Registry 与 Capability Matrix
- B 车道并行冻结 Session Runtime 语义
- C 车道只读抽取四类 Engine 差异，供 Step `18` 落地
- 最终由总控统一冻结字段、错误语义、默认阻断策略

## 17. 下一步准入条件

- `06/07/16/18` 可在统一 Engine/Session 标准上并行推进；Step `08` 仅在外部窗口开启后接入
