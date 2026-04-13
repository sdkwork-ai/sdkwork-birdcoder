# Step 07 - Studio 视图、预览、模拟器与编译环境体系

## 1. 目标与范围

把 Studio 收敛为 BirdCoder 的统一可视化编排层，统一预览、模拟器、编译、测试执行、证据沉淀和项目模板接入，形成所见即所得闭环。

## 2. 执行输入

- `/docs/架构/06`、`19`
- Step `05` 的 Session/Engine 标准
- Step `16` 的 Prompt/Template 标准

## 3. 本步非目标

- 不重写 Code 主工作台
- 不实现统一 `coding-server` API
- 不实现发布闭环与 Release 治理

## 4. 最小输出

- Preview/Build/Simulator/Test 统一执行模型
- Studio 子组件边界
- Evidence Store 与 Viewer 标准
- 项目模板到 Studio Profile 的映射

## 5. 推荐 review 产物

- Studio 页面拆分图
- 执行模型与 Evidence 流图
- Preview/Build/Simulator/Test Profile 表

## 6. 推荐并行车道

- 执行模式：条件并行
- 车道 C1：Preview/Build
- 车道 C2：Simulator/Test
- 车道 C3：Evidence/Template/Profile

## 7. 架构能力闭环判定

- 单个项目可统一完成预览、模拟、构建、测试
- 证据可回放、可导出、可进入后续发布链

## 8. 完成后必须回写的架构文档

- `/docs/架构/06-编译环境-预览-模拟器-测试体系.md`
- `/docs/架构/19-统一会话运行时-Prompt-SkillHub-AppTemplate标准.md`

## 9. 设计

- Studio 只负责编排，不直接拼装宿主命令与路径
- `Preview / Build / Simulator / Test` 共享统一 RunConfig、Evidence、Profile 语义
- 模拟器必须是独立子组件，不再依附超大单文件页面
- `StudioPage` 只允许作为组合壳；侧栏聊天/项目切换、工作区搜索浮层、外部 terminal 集成必须拆为独立子组件

## 10. 实施落地规划

1. 拆分 `StudioPage`，抽出 Preview、Build、Simulator、Evidence 等子组件。
2. 继续把 `StudioPage` 收敛为 `StudioChatSidebar`、`StudioWorkspaceOverlays`、`StudioTerminalIntegrationPanel` 等明确边界。
3. 冻结 `Studio*ExecutionRequest / Evidence` 标准。
4. 收敛 Profile Registry、Host Studio Session、Evidence Store 与 Viewer。
5. 建立项目模板到预览/编译/模拟 Profile 的映射。

## 11. 测试计划

- Preview/Build/Simulator/Test 执行回归
- Evidence Replay/Export/Diagnostics 回归
- Studio 子组件边界与渲染回归
- `StudioPage` 组件化契约回归：文件体积、导入边界、内联 UI 残留

## 12. 结果验证

- Studio 已具备所见即所得执行闭环
- Evidence 可被 `11-13` 直接消费
- `StudioPage` 不再内联 project/chat 侧栏、搜索浮层与外部 terminal 边界

## 13. 检查点

- `CP07-1`：Studio 子组件边界冻结
- `CP07-2`：四类执行模型与 Evidence 冻结
- `CP07-3`：Template/Profile 映射稳定

## 14. 风险与回滚

- 风险：页面拆分与执行模型重构同时进行，易造成状态漂移
- 回滚：优先保留统一 Evidence 与 Profile 标准，局部回退 UI 展示层

## 15. 完成定义

- Studio 不再是页面拼装层，而是统一编排与证据中心

## 16. 快速并行执行建议

- C1 先收敛 Preview/Build
- C2 并行收敛 Simulator/Test
- C3 同步推进 Evidence Viewer 与 Template/Profile
- 最终统一冻结 RunConfig、Evidence、Profile 主标准

## 17. 下一步准入条件

- `09/11/12/13` 可直接复用 Studio Evidence 与统一执行标准
