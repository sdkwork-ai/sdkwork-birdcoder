# Step 06 - Code 视图、编辑器与文件系统重构

## 1. 目标与范围

把 Code 视图建设为稳定的工程主工作台，统一文件树、编辑器、Diff、运行入口、线程关联和宿主切换行为。

## 2. 执行输入

- `/docs/架构/03`、`05`、`06`
- Step `05` 的 Engine/Session 标准
- 当前 Code 页面、编辑器组件、文件系统服务现状

## 3. 本步非目标

- 不实现 Preview/Simulator/Build/Test 体系
- 不实现 Terminal Provider 与数据库迁移
- 不重定义 Session 模型

## 4. 最小输出

- 文件系统服务边界
- 编辑器/Diff 组件边界
- Code 运行入口标准
- 宿主一致性回归项

## 5. 推荐 review 产物

- Code 页面模块拆分图
- 文件系统 API 边界表
- 编辑器与会话联动图

## 6. 推荐并行车道

- 执行模式：条件并行
- 车道 B1：文件树与文件服务
- 车道 B2：编辑器与 Diff
- 车道 B3：运行入口与会话联动

## 7. 架构能力闭环判定

- 打开、保存、重命名、Diff、运行都走统一服务边界
- 切换宿主后 Code 行为不再分叉

## 8. 完成后必须回写的架构文档

- `/docs/架构/03-模块规划与边界.md`
- `/docs/架构/06-编译环境-预览-模拟器-测试体系.md`

## 9. 设计

- 文件系统服务只暴露标准读写、挂载、目录切换、事件通知
- 编辑器层只消费标准会话、文件和 Diff 投影
- 运行入口必须共享统一 `coding_session` 与 `run_configuration`

## 10. 实施落地规划

1. 拆分 File Explorer、Editor、Diff、Run Entry 边界。
2. 收敛文件读写、挂载、重命名、打开目录逻辑。
3. 收敛线程、运行入口、编辑器事件到统一 Session 语义。
4. 清理大文件与重复 Hook/组件。

## 11. 测试计划

- 文件流回归：创建、删除、重命名、保存、挂载
- 编辑器/Diff 联动回归
- Code 运行入口与 Session 联动回归

## 12. 结果验证

- Code 视图已成为稳定主工作台
- 后续 `09/12/13` 可直接复用 Code 行为标准

## 13. 检查点

- `CP06-1`：页面边界拆分完成
- `CP06-2`：文件系统服务统一完成，已收敛到 `LocalFolderMountSource`、`useFileSystem().mountFolder(projectId, folderInfo)` 与 `page-file-system-boundary` 契约
- `CP06-3`：编辑器、Diff、运行入口回归通过

## 14. 风险与回滚

- 风险：文件服务与编辑器同时改动容易形成共享 Hook 冲突
- 回滚：保持文件服务契约不变，局部回退页面层实现，不回退统一服务边界

## 15. 完成定义

- Code 视图不再夹带宿主私货和局部状态分叉

## 16. 快速并行执行建议

- B1 只动文件树与文件服务
- B2 只动编辑器与 Diff
- B3 只动运行入口和 Session 联动
- 合并前先锁定共享 Hook 与 Contract Test

## 17. 下一步准入条件

- Code 视图已切到统一 Session 与 RunConfig 语义，可进入统一服务与质量门禁集成

## 18. 当前冻结真相

- `CodePage` 只保留项目/会话/文件/运行状态、事件总线响应、发送消息与服务编排。
- `CodeWorkspaceOverlays` 承接 find-in-files 与 quick-open。
- `CodeEditorWorkspacePanel` 承接 `FileExplorer`、`CodeEditorSurface` 与 editor 模式侧边聊天。
- `CodeEditorSurface` 承接 `CodeEditor`、`DiffEditor`、Diff 操作条与 editor empty state。
- `CodePageDialogs` 承接 run configuration、debug configuration、run task、delete confirmation。
- `CodeTerminalIntegrationPanel` 只承接外部 terminal 集成边界，不在本仓重开 terminal runtime 实现。
- 本地目录打开与挂载已统一收敛到共享类型 `LocalFolderMountSource` 与 `useFileSystem().mountFolder(projectId, folderInfo)`；Code/Studio 页面层不再直接调用 `fileSystemService.mountFolder`。

## 19. 本轮验证

- `pnpm.cmd run check:code-page-componentization`
- `pnpm.cmd run check:file-system-boundary`
- `pnpm.cmd run typecheck`
- `pnpm.cmd run check:ui-bundle-segmentation`
- `pnpm.cmd run check:release-flow`
- `pnpm.cmd run check:governance-regression`
- `pnpm.cmd run docs:build`

## 20. CP06-3 command-boundary truth

- This loop closes the first `CP06-3` slice only: workbench command orchestration is now a dedicated boundary, not page-inline wiring.
- `CodePage` must not call `globalEventBus.on/off` directly; `useCodeWorkbenchCommands()` is the only command-subscription boundary for diff, run-entry, terminal-open, explorer-reveal, and coding-session navigation commands.
- `scripts/code-workbench-command-boundary-contract.test.mjs` is the executable proof for that boundary.
- `pnpm.cmd run check:code-workbench-command-boundary` is part of both `lint` and `check:release-flow`.
- Remaining `CP06-3` scope after this slice was run-entry boundary closure plus behavior-level editor/diff or run-entry regression proof without reopening the frozen page-shell or file-system boundaries.

## 21. CP06-3 run-entry-boundary truth

- This loop closes the second `CP06-3` slice: run-entry orchestration is now a dedicated boundary, not page-inline launch wiring.
- `CodePage` must not own `useProjectRunConfigurations()`, `resolveRunConfigurationTerminalLaunch()`, or `buildTerminalProfileBlockedMessage()` directly.
- `useCodeRunEntryActions()` is the only valid Code-side boundary for run-configuration persistence, blocked-launch evaluation, debug launch fallback, and task execution dispatch.
- `scripts/code-run-entry-boundary-contract.test.mjs` is the executable proof for that boundary.
- `pnpm.cmd run check:code-run-entry-boundary` is part of both `lint` and `check:release-flow`.
- Legacy governance checks `terminal-cli-registry-contract` and `run-config-request-contract` must now treat `useCodeRunEntryActions()` as the valid Code-side consumer of the shared launch guard and blocked-message helpers.
- Remaining `CP06-3` scope after this second slice was behavior-level editor/diff regression proof on top of the frozen page-shell, file-system, command-boundary, and run-entry-boundary cuts.

## 22. CP06-3 editor-surface truth

- This loop closes the third `CP06-3` slice: editor and diff behavior now live on a dedicated surface boundary, not inline in `CodeEditorWorkspacePanel`.
- `CodeEditorSurface` is the only valid Code-side boundary for `CodeEditor`, `DiffEditor`, diff accept or reject controls, selected-file tab close, and editor empty-state CTA or copy.
- `CodeEditorWorkspacePanel` must not import `CodeEditor` or `DiffEditor` directly, and it must not own diff header buttons or empty-state icon or CTA details after the surface split.
- `scripts/code-editor-surface-boundary-contract.test.mjs` is the executable proof for that boundary.
- `pnpm.cmd run check:code-editor-surface-boundary` is part of both `lint` and `check:release-flow`.
- Step 06 is now fully closed on `CP06-1`, `CP06-2`, and all three `CP06-3` slices; at that checkpoint, the next serial closure had to return to the `09 -> 17` mainline, and the later Step 17, Step 18, and Step `20` follow-on closures are recorded in `docs/release/release-2026-04-13-04.md`, `docs/release/release-2026-04-13-05.md`, and `docs/release/release-2026-04-13-08.md`.
