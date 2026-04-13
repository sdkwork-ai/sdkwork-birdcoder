# Step 13 - 发布就绪、GitHub Flow 与灰度回滚闭环

## 1. 目标与范围

完成 BirdCoder 的正式发布、灰度发布、热修复、回滚四类闭环，统一 GitHub Flow、Release Note、制品清单、观察窗口、回滚入口与发布后回写。

## 2. 执行输入

- `/docs/架构/09`、`10`、`11`、`14`
- Step `10-12` 的治理、交付、质量门禁
- Step `17` 的统一 `core/app/admin` API 与控制台

## 3. 本步非目标

- 不重做打包与部署体系
- 不新增产品功能
- 不用人工口头流程替代发布规则

## 4. 最小输出

- GitHub Flow 与版本策略
- `releaseControl` 标准
- Release Note 模板
- 灰度/热修复/回滚 Runbook
- 发布后观察与回写清单

## 5. 推荐 review 产物

- 发布状态机图
- `releaseControl` 字段表
- 灰度与回滚 Runbook

## 6. 推荐并行车道

- 执行模式：串行
- 车道 A：脚本与契约
- 车道 F：证据、说明、Runbook 草案

## 7. 架构能力闭环判定

- 发布、灰度、热修复、回滚共享同一语义与证据结构
- 发布后观察、回滚入口、回写目标全部可执行

## 8. 完成后必须回写的架构文档

- `/docs/架构/09-安装-部署-发布标准.md`
- `/docs/架构/10-开发流程-质量门禁-评估标准.md`
- `/docs/架构/11-行业对标与能力矩阵.md`
- `/docs/架构/20-统一Rust-Coding-Server-API-协议标准.md`

## 9. 设计

- 固定发布类型：`formal / canary / hotfix / rollback`
- 固定 `releaseControl` 字段：发布类型、观察窗口、回滚入口、回滚 Runbook、重发路径
- Release Note、GitHub Release、Release Manifest 必须共享同一语义
- latest registry-backed Release Note 必须固定输出 `## Post-release operations`，至少包含 `Observation window`、`Stop-ship signals`、`Rollback entry`、`Re-issue path`、`Writeback targets`

## 10. 实施落地规划

1. 冻结分支、Tag、Release、审批门禁规则。
2. 收敛 `plan -> package -> smoke -> finalize -> notes -> release` 链路。
3. 固化 `rollback plan`、观察窗口、灰度与回写规则。
4. 把发布证据接入 `docs/release`、Release Note 与 GitHub Release。

## 11. 测试计划

- Release Plan/Finalize/Notes 回归
- Rollback Plan/Runbook 回归
- 发布证据与发布说明一致性校验
- `check-release-closure.mjs` 回归，验证 `docs/release/releases.json` 最新登记的 release note 仍满足发布后观察与回写字段要求

## 12. 结果验证

- 任一发布类型都有明确观察窗口与回滚入口
- 发布失败可直接定位到计划、制品、Smoke、归档或宿主前置

## 13. 检查点

- `CP13-1`：`releaseControl` 字段与默认值冻结
- `CP13-2`：`plan / rollback / finalize / notes` 语义一致
- `CP13-3`：灰度、回滚、发布后回写形成闭环

## 14. 风险与回滚

- 风险：脚本、文档、GitHub Release 各写一套语义会导致伪发布闭环
- 回滚：保持统一 `releaseControl` 主标准，只回退局部脚本或文案实现

## 15. 完成定义

- 当前迭代具备可商业化交付的正式发布与回滚能力

## 16. 快速并行执行建议

- A 车道先冻结脚本、字段、契约测试
- F 车道并行完善 Runbook、Release Note、观察与回写模板
- 最终发布动作只允许总控执行

## 17. 下一步准入条件

- 无后续主 Step；仅在发布后观察与回写完成后，当前迭代才算真正结束

## 18. Current Loop Addendum - Release Quality Loop Scoreboard

- The release quality-evidence lane now closes the loop-scoreboard standard inside packaged release evidence:
  - `scripts/release/quality-gate-release-evidence.mjs` materializes `qualityEvidence.loopScoreboard` with four dimensions plus `lowest_score_item` and `next_focus`.
  - `scripts/release/finalize-release-assets.test.mjs` and `scripts/release/smoke-finalized-release-assets.test.mjs` freeze that summary as finalized-manifest truth.
  - `scripts/release/render-release-notes.mjs` and `scripts/release/render-release-notes.test.mjs` render the same loop-scoreboard fields into release notes.
- This slice closes non-environmental scoring determinism only; PostgreSQL live smoke now has a recorded DSN-backed `passed` report on this host; future missing-DSN or driver regressions must stay `blocked`, and future DSN-backed runtime-connectivity regressions must stay structured `failed`.

## 19. Current Loop Addendum - Runtime Quality Execution Truth

- `scripts/quality-gate-execution-report.mjs` now treats the Windows `pnpm.cmd` child exit code as the only valid runtime verdict when tiers are executed through the PowerShell wrapper.
- `scripts/quality-gate-execution-report.test.mjs` now freezes the regression where a non-zero fake `pnpm.cmd` exit must surface as `failed`, not `passed`.
- Root `lint` now executes the workspace and `@sdkwork/birdcoder-web` TypeScript gates through direct `pnpm exec tsc --noEmit` entrypoints instead of reopening nested package-script wrappers for those two slices.
- This loop closes release-evidence truthfulness only; at that checkpoint, the next non-environmental runtime blocker was the remaining nested `pnpm run` lane inside `check:release-flow`, and the later closure is recorded in `docs/release/release-2026-04-13-02.md`.

## 20. Current Loop Addendum - Windows Quality Runtime Delivery Closed

- The remaining Windows nested-wrapper blocker is now closed in the real quality pipeline rather than being papered over in tests.
- `check:desktop` and `check:server` now run their concrete TypeScript and Rust verification commands directly, which removes the last Windows-fragile wrapper layer from the isolated delivery targets.
- `check:quality:standard` now executes direct desktop, server, shared-SDK, web-build, bundle-budget, server-build, and docs-build commands, so the standard tier is no longer blocked by nested wrappers.
- `check:release-flow` now executes its representative contract lanes directly, so `check:quality:fast` can reach and pass the real release-governance surface on this host.
- `check:quality:release` intentionally keeps the same release topology (`fast -> standard -> matrix -> release-flow -> ci-flow -> governance`) while the nested implementations underneath are flattened.
- `scripts/quality-gate-execution-report.mjs` now records a fully passed `fast -> standard -> release` cascade in `artifacts/quality/quality-gate-execution-report.json`, and that same runtime truth is available for finalized release evidence and release notes.
- Future reruns of `pnpm release:smoke:postgresql-live` must stay executable release truth: keep `commercial_readiness` `blocked` for missing DSN or driver regressions, and keep it `failed` for DSN-backed runtime-connectivity regressions instead of reopening the already-closed Step 12 runtime slice.
- If a DSN-backed run returns `failed`, treat that as executable smoke truth that must be fixed or backwritten explicitly; do not let cleanup exceptions collapse the release gate into an unauditable crash.

## 21. Current Loop Addendum - PostgreSQL Live Smoke Gate Closed

- The current Windows host now has real DSN-backed PostgreSQL closure evidence instead of a documentation-only environment assumption.
- `Start-Service com.docker.service` plus Docker Desktop startup now make the local Docker engine available for the smoke lane.
- A temporary `postgres:16-alpine` container published on `127.0.0.1:55432` produced a real `pnpm.cmd run release:smoke:postgresql-live` result of:
  - `status: passed`
  - checks `migrations / preflight-clean / transaction-write-visible / transaction-isolation / rollback-clean`
- The PostgreSQL commercial-readiness gate is therefore closed on this host; future loops should move back to the next unresolved non-environmental Step instead of reopening this lane without a failing rerun.

## 22. Current Loop Addendum - Latest Registry-backed Release Note Closure

- `scripts/check-release-closure.mjs` is the release-blocking truth for the latest registry-backed release note listed in `docs/release/releases.json`.
- `docs/prompts/反复执行Step指令.md`、Step `13` 与新的 release note must all require `## Post-release operations` with `Observation window`、`Stop-ship signals`、`Rollback entry`、`Re-issue path`、`Writeback targets`.
- When a loop changes release governance or closes a release-blocking regression, it must mint a new incrementing release note instead of only retrofitting the previous note in place.
- This slice closes release-note governance drift only; the next autonomous loop must choose the next lowest-score item from fresh evidence.
