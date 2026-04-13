# Step 16 - Prompt、SkillHub、AppTemplate、项目模板体系

## 1. 目标

把 `/docs/架构/13` 与 `/docs/架构/19` 落成可执行 step，冻结 Prompt、SkillHub、AppTemplate 的统一对象模型、统一注入顺序、统一作用域、统一模板档位与统一持久化边界。

## 2. 范围

- 会话主骨架仍使用 `workspace -> project -> coding_session -> turn`。
- Step 16 只处理 Prompt、SkillHub、AppTemplate 标准，不重开 Step 06 页面边界。
- Terminal 仅保留外部集成协议，不进入本 step 实现主线。

## 3. 串并行规则

- 串行：
  - 共享类型定义
  - storage binding 命名
  - Prompt 注入顺序
  - release 编号与回写
- 可并行：
  - 文档回写
  - 契约测试补齐
  - 仅消费共享类型的 UI 或服务接线

## 4. 子检查点

### CP16-1 标准冻结

- 设计：
  - 固定 Prompt 注入层：`platform_rule -> organization_rule -> template_preset -> skill_binding -> project_context -> turn_prompt`
  - 固定 Skill 绑定作用域：`workspace / project / coding_session / turn`
  - 固定 Template 目标档位：`web / desktop / server / fullstack / plugin / agent-tooling`
  - 固定 `prompt_* / skill_* / app_template_*` storage bindings
- 实施：
  - 在 `@sdkwork/birdcoder-types` 暴露统一常量和类型。
  - 把根治理命令接入 `lint`、`check:release-flow`、`check:governance-regression`。
  - 回写架构、step、prompt、release 文档。
- 测试：
  - `pnpm.cmd run test:skill-binding-contract`
  - `pnpm.cmd run test:template-instantiation-contract`
- 结果验证：
  - 类型导出存在。
  - storage binding 覆盖完整。
  - 文档与提示词出现同一组 machine ids。

### CP16-2 运行时装配

- 设计：
  - Prompt runtime 负责组装六层注入。
  - Skill runtime 负责安装、绑定、配置三段式装配。
  - Template runtime 负责 preset、profile、instantiation 三段式装配。
- 实施：
  - 先做 kernel 组合器，再接 UI 或服务。
  - 不在页面层硬编码 Prompt/Skill/Template 组合。
  - `@sdkwork/birdcoder-core` 负责 `assembleBirdCoderPromptRuntime()`、`assembleBirdCoderSkillRuntime()`、`instantiateBirdCoderAppTemplateRuntime()`。
  - `@sdkwork/birdcoder-types` 暴露 runtime assembler 所需的共享输入、输出与来源链类型。
- 测试：
  - 增加 runtime assembler 合同测试。
  - `pnpm.cmd run test:prompt-skill-template-runtime-assembly-contract`
- 结果验证：
  - 切换 engine 后组合顺序不漂移。
  - Skill 解析只接受 `installation -> binding -> runtime_config` 来源链。
  - Template 解析只接受 `preset -> target_profile -> instantiation` 来源链。

### CP16-3 运行证据与评测

- 设计：
  - `prompt_run` 记录每次真实运行。
  - `prompt_evaluation` 记录跨版本、跨引擎评测。
  - `app_template_instantiation` 记录模板落地产物。
- 实施：
  - 统一走 `coding-server` 与 data-kernel 持久化。
- 测试：
  - 增加 run/evaluation/instantiation 合同测试。
- 结果验证：
  - 运行结果可回放、可比较、可审计。

## 5. 完成定义

- `CP16-1` 完成后，BirdCoder 具备统一 Prompt/SkillHub/AppTemplate 基础标准。
- `CP16-2` 完成后，BirdCoder 具备统一装配能力。
- `CP16-3` 完成后，BirdCoder 具备运行证据、评测与模板落地闭环。

## 6. 当前状态

- `CP16-1`：已关闭。
- `CP16-2`：已关闭。
- `CP16-3`：已关闭。
`CP16-3` status update (2026-04-12): fully closed after the coding-server consumer slice.
### CP16-3 addendum - 2026-04-12

- `packages/sdkwork-birdcoder-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts` now closes the first shared repository boundary for `prompt_run`, `prompt_evaluation`, and `app_template_instantiation`.
- `pnpm.cmd run test:prompt-skill-template-evidence-repository-contract` proves provider-backed commit and rollback visibility through the shared `StorageProvider` / `UnitOfWork` path.
- this addendum closes the first repository slice; later consumer slices are tracked below.

### CP16-3 addendum - 2026-04-12 (consumer slice)

- `packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts` now injects the shared prompt/skill/template evidence repositories on the same provider boundary used by console repositories.
- `packages/sdkwork-birdcoder-infrastructure/src/services/impl/ProviderBackedProjectService.ts` now persists `app_template_instantiation` on project creation plus `prompt_run` and `prompt_evaluation` on coding-session message writes.
- `pnpm.cmd run test:prompt-skill-template-evidence-consumer-contract` proves the default IDE project flow no longer keeps this evidence only in sidecar state.
- this addendum closes the second service-consumer slice; the coding-server-side consumer slice is tracked below.

### CP16-3 addendum - 2026-04-12 (coding-server consumer slice)

- `packages/sdkwork-birdcoder-server/src/projectionRepository.ts` now writes `prompt_run` and `prompt_evaluation` through `createBirdCoderPromptSkillTemplateEvidenceRepositories()` on the same provider/UoW transaction used by projection persistence.
- `scripts/coding-server-prompt-skill-template-evidence-consumer-contract.test.ts` proves coding-server projection consumers persist evidence through the shared path instead of bypassing it.
- `pnpm.cmd run test:coding-server-prompt-skill-template-evidence-consumer-contract` is promoted into `lint`, `check:release-flow`, and governance regression.
- Step 16 `CP16-3` is now fully closed.
