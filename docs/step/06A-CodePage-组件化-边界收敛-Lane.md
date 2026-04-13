# Step 06A - CodePage 组件化边界收敛

## 1. 目标

把 `CodePage` 从超大页面收敛为组合壳，冻结搜索浮层、编辑工作区、运行弹窗、外部 terminal 集成的独立组件边界。

## 2. 输入

- `docs/架构/03-模块规划与边界.md`
- `docs/step/06-code视图-编辑器-文件系统重构.md`
- `packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx`

## 3. 设计

- `CodeWorkspaceOverlays`：承接 find-in-files 与 quick-open。
- `CodeEditorWorkspacePanel`：承接 `FileExplorer`、`CodeEditor`、`DiffEditor` 与 editor 模式侧边聊天。
- `CodePageDialogs`：承接 run/debug/task/delete 弹窗。
- `CodeTerminalIntegrationPanel`：承接外部 terminal 工程接入边界。

## 4. 落地规划

1. 从 `CodePage` 剥离大块 JSX 与局部 UI 状态。
2. 保持项目、线程、文件、发送消息、运行配置主语义不变。
3. 用契约测试冻结导入边界、文件体积和禁止回流的内联 UI。

## 5. 测试

- `pnpm.cmd run check:code-page-componentization`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run check:ui-bundle-segmentation`
- `pnpm.cmd run check:release-flow`

## 6. 验证标准

- `CodePage` 只负责状态编排与业务回调。
- find-in-files / quick-open 不再在 `CodePage` 内联渲染。
- editor / diff / editor 模式侧边聊天不再在 `CodePage` 内联渲染。
- run/debug/task/delete 弹窗不再在 `CodePage` 内联渲染。
- terminal 仅通过独立集成面板接入外部工程。

## 7. 并行与串行

- 可并行：子组件拆分、契约测试补齐、文档回写。
- 必须串行：`CodePage.tsx` 最终裁剪、`ui-bundle-segmentation` 真相调整、`package.json` release-flow 门禁接入、release 编号回写。

## 8. 完成定义

- `CodePage` 文件规模显著下降，且组件化边界已进入 release-flow 与 bundle 治理。
