# Step 07A - StudioPage 组件化边界收敛

## 1. 目标

把 `StudioPage` 从超大页面收敛为组合壳，冻结 Studio 侧栏、搜索浮层、外部 terminal 集成的独立组件边界。

## 2. 输入

- `docs/架构/06-编译环境-预览-模拟器-测试体系.md`
- `docs/step/07-studio视图-预览-模拟器-编译环境体系.md`
- `packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx`

## 3. 设计

- `StudioChatSidebar`：承接项目/会话切换与 sidebar chat。
- `StudioWorkspaceOverlays`：承接 find-in-files 与 quick-open。
- `StudioTerminalIntegrationPanel`：承接外部 terminal 工程接入边界。
- `StudioSimulatorPanel` 继续保持独立子组件，不回流到页面内联。

## 4. 落地规划

1. 从 `StudioPage` 剥离大块 JSX 与局部状态。
2. 保持 Preview / Simulator / Code / Dialog / execution handler 主语义不变。
3. 用契约测试冻结导入边界、文件体积和禁止回流的内联 UI。

## 5. 测试

- `pnpm.cmd run check:studio-page-componentization`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run check:release-flow`

## 6. 验证标准

- `StudioPage` 只负责状态编排与执行调度。
- sidebar chat 不再在 `StudioPage` 内联渲染。
- find-in-files / quick-open 不再在 `StudioPage` 内联渲染。
- terminal 仅通过独立集成面板接入外部工程。

## 7. 并行与串行

- 可并行：子组件拆分、契约测试补齐、文档回写。
- 必须串行：`StudioPage.tsx` 最终裁剪、`package.json` release-flow 门禁接入、release 编号回写。

## 8. 完成定义

- `StudioPage` 文件规模显著下降，且组件化边界已进入 release-flow 治理。
