# 19-统一会话运行时-Prompt-SkillHub-AppTemplate标准

## 1. 目标

本标准冻结 BirdCoder 的统一命名、统一会话骨架、统一 Prompt/SkillHub/AppTemplate 运行时，以及多引擎、多数据库、多宿主的一致落地规则。

## 2. 统一骨架

- `workspace`：工作区容器。
- `project`：工作区下项目容器。
- `coding_session`：稳定业务会话。
- `coding_session_runtime`：引擎原生运行时实例，保存 `native_session_id` 等桥接元数据。
- `coding_session_turn`：一次输入触发的一次执行闭环。
- `coding_session_message`：面向 UI 的标准消息投影。
- `coding_session_event`：面向回放和排障的原始事件。
- `coding_session_artifact`：Diff、补丁、构建、测试、预览、发布证据。
- `coding_session_checkpoint`：恢复点、审批挂起点、断点续跑点。

## 3. 多引擎映射

- Codex：`thread -> turn -> item/event` 映射到 `coding_session -> coding_session_turn -> coding_session_event`。
- Gemini：`session -> event stream` 映射到 `coding_session_runtime -> coding_session_event`。
- OpenCode：`session -> message/part + diff/todo/question` 映射到 `coding_session_message + coding_session_event + coding_session_artifact`。
- Claude Code：`session_id -> sdk messages -> stream_event/result` 映射到 `coding_session_runtime + coding_session_event + coding_session_artifact`。

统一规则：

- 业务真相永远是 `coding_session`，不是 vendor 自带 session 命名。
- vendor 原生对象只存在于 `coding_session_runtime`。
- UI 投影与原始事件必须分离。

## 4. Prompt / SkillHub / AppTemplate 运行时标准

### 4.1 Prompt 注入层

固定顺序：

1. `platform_rule`
2. `organization_rule`
3. `template_preset`
4. `skill_binding`
5. `project_context`
6. `turn_prompt`

解释：

- 前三层决定约束与起点。
- `skill_binding` 决定本轮可用能力。
- `project_context` 决定当前工程事实。
- `turn_prompt` 决定当前任务意图。

### 4.2 Skill 绑定作用域

- `workspace`
- `project`
- `coding_session`
- `turn`

规则：

- 高层作用域可被低层覆盖，但必须保留来源链。
- `turn` 绑定是一次性注入，不能写回长期配置。

### 4.3 AppTemplate 目标档位

- `web`
- `desktop`
- `server`
- `fullstack`
- `plugin`
- `agent-tooling`

规则：

- 档位决定 release family、目录骨架、默认 preset。
- 不决定 engine；engine 仍由 `engine_binding + model_catalog` 负责。

### 4.4 Kernel 装配边界

- `@sdkwork/birdcoder-core` 是 Prompt / Skill / Template 运行时装配的唯一 kernel 边界。
- Prompt runtime 只允许按 `platform_rule -> organization_rule -> template_preset -> skill_binding -> project_context -> turn_prompt` 顺序组装，并且切换 engine 后顺序不漂移。
- Skill runtime 只允许 `installation -> binding -> runtime_config` 三段式来源链。
- Template runtime 只允许 `preset -> target_profile -> instantiation` 三段式来源链。

## 5. 存储标准

- Prompt：
  - `prompt_asset`
  - `prompt_asset_version`
  - `prompt_bundle`
  - `prompt_bundle_item`
  - `prompt_run`
  - `prompt_evaluation`
- Skill：
  - `skill_package`
  - `skill_version`
  - `skill_capability`
  - `skill_installation`
  - `skill_binding`
  - `skill_runtime_config`
- Template：
  - `app_template`
  - `app_template_version`
  - `app_template_target_profile`
  - `app_template_preset`
  - `app_template_instantiation`

统一规则：

- 当前主标准只允许 `table` authority。
- `sqlite / postgresql` 共享同一逻辑 schema。
- `prompt_run`、`prompt_evaluation` 优先 `postgresql`；其余主数据默认 `sqlite`。

## 6. 宿主与界面边界

- `Code` 消费 `coding_session_message + coding_session_artifact`。
- `Studio` 消费 `coding_session_artifact + build/preview/simulator/test evidence`。
- `Terminal` 在本仓只保留外部集成协议，不再承担本地实现主线。
- `web / desktop / server` 必须统一通过 `coding-server -> core / app / admin` API 访问同一语义。

## 7. 评估标准

- 命名一致：所有层只使用 `coding_session` 主命名。
- 语义一致：不同 engine 切换后 Prompt、Skill、Template 语义不漂移。
- 存储一致：不同 provider 不改变实体含义和字段职责。
- 审计一致：能追溯模板、Skill、Prompt 的版本、来源、作用域和运行结果。

## 8. 当前冻结点

- Step 16 `CP16-1` 已关闭：
  - `platform_rule -> organization_rule -> template_preset -> skill_binding -> project_context -> turn_prompt`
  - `workspace / project / coding_session / turn`
  - `web / desktop / server / fullstack / plugin / agent-tooling`
  - `prompt_* / skill_* / app_template_*` storage bindings
- Step 16 `CP16-2` 已关闭：
  - `assembleBirdCoderPromptRuntime()` 收敛六层 Prompt 注入顺序。
  - `assembleBirdCoderSkillRuntime()` 收敛 Skill 安装、绑定、配置三段式装配。
  - `instantiateBirdCoderAppTemplateRuntime()` 收敛 preset、profile、instantiation 三段式装配。
- 验证命令：
  - `pnpm.cmd run test:skill-binding-contract`
  - `pnpm.cmd run test:template-instantiation-contract`
  - `pnpm.cmd run test:prompt-skill-template-runtime-assembly-contract`
- Step 16 `CP16-3` first persistence slice is now closed:
  - shared infrastructure repositories persist `prompt_run`, `prompt_evaluation`, and `app_template_instantiation` through the same provider/UoW table contract used elsewhere in the mainline.
  - `pnpm.cmd run test:prompt-skill-template-evidence-repository-contract` is the executable gate for commit and rollback visibility on that shared path.
  - follow-on Step 16 persistence consumers were closed later on the same lane; this repository slice is no longer an active next gap.
- Step 16 `CP16-3` second consumer slice is now closed:
  - default IDE service composition and provider-backed project flows now consume the same shared evidence repositories for `app_template_instantiation`, `prompt_run`, and `prompt_evaluation`.
  - `pnpm.cmd run test:prompt-skill-template-evidence-consumer-contract` is the executable gate for this service-consumer adoption.
- Step 16 `CP16-3` third coding-server consumer slice is now closed:
  - `packages/sdkwork-birdcoder-server/src/projectionRepository.ts` now persists `prompt_run` and `prompt_evaluation` through the same provider/UoW transaction used by coding-server projection persistence.
  - `pnpm.cmd run test:coding-server-prompt-skill-template-evidence-consumer-contract` is the executable gate for coding-server-side evidence adoption.
  - Step 16 `CP16-3` is now fully closed.
