# 13-规则-技能-MCP-知识系统标准

## 1. 目标

BirdCoder 的规则、Prompt、SkillHub、AppTemplate、MCP、知识资产必须进入统一 kernel，禁止停留在页面本地状态。标准目标是三件事：跨 `web / desktop / server` 一致、跨 `codex / claude-code / gemini / opencode` 一致、跨 `sqlite / postgresql` 一致。

## 2. 边界

- Prompt：定义某次 `turn` 如何执行，不负责安装能力，不负责定义项目骨架。
- SkillHub：定义“可安装、可绑定、可配置”的工程能力，不负责替代 Prompt，不负责决定模板目录。
- AppTemplate：定义项目从哪里起步，负责目录骨架、默认 preset、默认 workflow、默认规范注入。
- MCP：定义外部工具和资源访问协议，必须纳入统一权限、审计、回放。
- Knowledge：定义规则、文档、示例、索引、评测样本，作为 Prompt 和 Skill 的上游输入。

## 3. Prompt 标准

- 核心对象：`prompt_asset`、`prompt_asset_version`、`prompt_bundle`、`prompt_bundle_item`、`prompt_run`、`prompt_evaluation`。
- 固定注入层顺序：
  - `platform_rule`
  - `organization_rule`
  - `template_preset`
  - `skill_binding`
  - `project_context`
  - `turn_prompt`
- 设计约束：
  - `platform_rule` 只承载产品、安全、宿主不变量。
  - `organization_rule` 承载团队、仓库、交付规范。
  - `template_preset` 只提供模板默认上下文，不越权覆盖引擎绑定。
  - `skill_binding` 只注入能力，不替代用户当前任务。
  - `project_context` 只注入工作区、项目、文件、文档、证据上下文。
  - `turn_prompt` 只表达当前轮任务意图。
  - Prompt runtime 只能由 shared kernel 组装，不允许页面本地硬编码顺序。
- 评估标准：
  - 是否可回放：`prompt_run` 能复现注入顺序、变量与结果。
  - 是否可比较：`prompt_evaluation` 能比较不同版本、不同引擎、不同配置。
  - 是否防漂移：引擎切换后层级顺序不变。

## 4. SkillHub 标准

- 核心对象：`skill_package`、`skill_version`、`skill_capability`、`skill_installation`、`skill_binding`、`skill_runtime_config`。
- 固定绑定作用域：
  - `workspace`
  - `project`
  - `coding_session`
  - `turn`
- 设计约束：
  - 先安装，再绑定，再注入；三者不可混写。
  - `workspace` 只承载跨项目共享能力。
  - `project` 承载工程级规范、workflow、命令、脚手架。
  - `coding_session` 承载一次任务周期内的能力组合。
  - `turn` 承载单次执行的临时能力。
  - Skill runtime 只允许 `installation -> binding -> runtime_config` 三段式来源链。
- 评估标准：
  - 是否可解释：绑定来源、作用域、版本可审计。
  - 是否可裁剪：项目或会话卸载后无脏能力残留。
  - 是否可迁移：同一 skill 在不同 engine 下语义不漂移。

## 5. AppTemplate 标准

- 核心对象：`app_template`、`app_template_version`、`app_template_target_profile`、`app_template_preset`、`app_template_instantiation`。
- 固定目标档位：
  - `web`
  - `desktop`
  - `server`
  - `fullstack`
  - `plugin`
  - `agent-tooling`
- 设计约束：
  - Template 决定起点，不直接替代引擎选择。
  - 引擎与模型由 `engine_binding + model_catalog` 决定。
  - 模板 preset 只能组合默认 Prompt、Skill、workflow、命令、规范。
  - `app_template_instantiation` 必须记录模板版本、preset、输出目录与状态。
  - Template runtime 只允许 `preset -> target_profile -> instantiation` 三段式来源链。
- 评估标准：
  - 是否可实例化：模板能稳定生成项目骨架。
  - 是否可扩展：新增 profile 不要求重写 `coding_session` 主骨架。
  - 是否可发布：模板目标档位与 release family 一致。

## 6. 存储与数据库标准

- 统一逻辑实体族：`prompt_*`、`skill_*`、`app_template_*`。
- 统一存储形态：Step 16 `CP16-1` 只允许 `table` 模式，不允许临时 `localStorage` 真值。
- provider 优先级：
  - Prompt 资产与 Skill/Template 主数据：默认 `sqlite`，支持离线开发。
  - `prompt_run`、`prompt_evaluation`：优先 `postgresql`，支持治理与评测聚合。
- 评估标准：
  - `sqlite / postgresql` 使用同一逻辑 schema。
  - provider 切换不改变对象语义和命名。

## 7. 当前冻结点

- Step 16 `CP16-1` 已冻结：
  - 注入层顺序。
  - Skill 绑定作用域。
  - Template 目标档位。
  - `prompt_* / skill_* / app_template_*` storage bindings。
- Step 16 `CP16-2` 已冻结：
  - shared kernel prompt runtime 装配边界。
  - shared kernel skill runtime 三段式来源链。
  - shared kernel template runtime 三段式来源链。
- 可执行验证：
  - `pnpm.cmd run test:skill-binding-contract`
  - `pnpm.cmd run test:template-instantiation-contract`
  - `pnpm.cmd run test:prompt-skill-template-runtime-assembly-contract`
- Step 16 `CP16-3` first persistence slice is now closed:
  - Prompt evidence must persist through the shared provider/UoW repository path, not through page-local or sidecar state.
  - `prompt_run`, `prompt_evaluation`, and `app_template_instantiation` now share one executable repository boundary in infrastructure.
  - `pnpm.cmd run test:prompt-skill-template-evidence-repository-contract` is the active governance command for this slice while consumer adoption remains open.
- Step 16 `CP16-3` second consumer slice is now closed:
  - `createDefaultBirdCoderIdeServices()` and `ProviderBackedProjectService` now consume that same shared repository boundary instead of keeping project-flow evidence only in sidecar state.
  - project creation writes `app_template_instantiation`; coding-session message writes emit `prompt_run` and `prompt_evaluation`.
  - `pnpm.cmd run test:prompt-skill-template-evidence-consumer-contract` is now the active governance command for this service-consumer slice.
- Step 16 `CP16-3` third coding-server consumer slice is now closed:
  - `packages/sdkwork-birdcoder-server/src/projectionRepository.ts` now persists `prompt_run` and `prompt_evaluation` on the same provider/UoW transaction used by coding-session projection persistence.
  - `pnpm.cmd run test:coding-server-prompt-skill-template-evidence-consumer-contract` is now the executable governance command for coding-server-side consumer adoption.
  - Step 16 `CP16-3` is now fully closed.
