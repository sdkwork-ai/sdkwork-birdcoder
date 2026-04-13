# 22-多Code-Engine源码镜像真相补充标准

## 1. 目标

把多引擎源码镜像状态从“文档描述”升级为“可执行真相”。只要仓库中已经存在真实 `external/` 镜像，BirdCoder 就不允许继续把该引擎标记成 placeholder、fragment 或 `sdk-only` 真相。

## 2. 适用范围

- `codex`
- `claude-code`
- `gemini`
- `opencode`

## 3. 冻结规则

- 若 `external/<engine>` 存在：
  - `sourceStatus` 必须为 `mirrored`
  - `sourceKind` 必须为 `repository`
  - `externalPath` 必须是仓库相对路径
- 已镜像引擎不允许回退成：
  - `sdk-only`
  - `extension`
  - fragment-only source truth
- `notes` 可以描述补充 SDK、桥接方式、生成代码来源，但不能否认本地镜像已存在。

## 4. 执行标准

- 共享主源：`packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts`
- 必跑合同：
  - `scripts/engine-kernel-contract.test.ts`
  - `scripts/engine-source-mirror-contract.test.ts`
- 质量门禁：
  - `check:release-flow`

## 5. 设计约束

- 镜像真相只负责“源码与协议抽取基线”。
- 运行时成熟度、可用性、授权方式、桥接方式，仍由 engine descriptor、capability matrix、runtime adapter、server contract 单独约束。
- 不允许让页面、终端或 host-runtime 自己猜测镜像真相。

## 6. 当前闭环

- `codex / claude-code / gemini / opencode` 已全部在共享 kernel 元数据中冻结为 mirrored repository truth。
- `claude-code` 不再保留 `sdk-only` 占位语义。
- `opencode` 不再保留 `extension` 或 fragment-only 占位语义。

## 7. 下一步

共享 engine descriptor / model-catalog 向 `coding-server` 的真相下沉已在后续 Step 18B 闭环；当前镜像标准只在源码镜像真相本身出现 fresh failing evidence 时重开。
