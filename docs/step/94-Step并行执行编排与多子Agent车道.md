# 94 - Step 并行执行编排与多子Agent车道

## 1. 目标与范围

定义 BirdCoder 哪些 Step 可以并行、哪些必须串行，并把并行时的写入边界、集成窗口、Owner、阻塞升级路径一次讲清，确保“快”不牺牲统一 Kernel、统一 API、统一数据标准。

## 2. 架构对齐

对齐本目录 `README`、`99` 与 `/docs/架构/03`、`10`、`18`、`19`、`20`、`21`。未冻结契约、未锁定主目录、未指定 Owner 的能力，不得启动并行主实现。

## 3. Step 级编排规则

| Step | 并行建议 | 结论 |
| --- | --- | --- |
| `00-05` | 只允许只读审计、草案并行 | 主实现必须串行 |
| `06/07` | 可主实现并行 | 以前置 `05` 冻结结果为准 |
| `14/15/16/18` | 可专项并行 | 只能在各自硬前置满足后启动 |
| `08` | 只可做外部集成准备 | 必须等待 `09` `17` `18` 与外部版本冻结 |
| `09` | 不可主并行 | 统一 `coding-server` 收口必须串行 |
| `17` | 串行为主、子域并行 | `core/app/admin/console` 可在 DTO 冻结后并行 |
| `10/11/12` | 可专项并行 | 治理、交付、质量三条车道并行 |
| `13` | 不可主并行 | 发布与回滚必须统一执行 |

## 4. 推荐车道

| 车道 | 责任 | 主写目录 |
| --- | --- | --- |
| A 总控车道 | `00-05`、`09`、`17`、`13`、共享契约、最终集成 | `packages/sdkwork-birdcoder-core` `packages/sdkwork-birdcoder-server` `.github` `docs/release` |
| B Code 车道 | `06` | `packages/sdkwork-birdcoder-code` `packages/sdkwork-birdcoder-ui` |
| C Studio 车道 | `07` | `packages/sdkwork-birdcoder-studio` `packages/sdkwork-birdcoder-host-studio` `packages/sdkwork-birdcoder-templates` |
| D External 集成车道 | `08` | `packages/sdkwork-birdcoder-terminal` `packages/sdkwork-birdcoder-desktop` `packages/sdkwork-birdcoder-shell` |
| E 架构补强车道 | `14` `15` `16` `18` | `packages/sdkwork-birdcoder-appbase` `packages/sdkwork-birdcoder-types` `packages/sdkwork-birdcoder-infrastructure` `docs/prompts` |
| F 治理交付车道 | `10` `11` `12` | `deploy` `scripts` `artifacts` `.github/workflows` |

说明：

- 车道 E 内部可再拆 `14-appbase`、`15-data-provider`、`16-prompt-template`、`18-engine-adapter` 四个子 Agent。
- 任何共享 DTO、Canonical Event、Migration、OpenAPI 变更，最终都必须回到 A 总控车道收口。

## 5. 最快并行路径

1. A 串行完成 `00-05`；B/C/D/E/F 只做审计、草案、测试脚手架。
2. `05` 通过后，B/C/E 并行推进 `06/07/14/15/16/18`；D 只维护外部 Terminal 版本矩阵与 contract 草案；A 只维护共享契约与集成门禁。
3. `06/07` 与 `14/15/16/18` 达到准入后，A 串行推进 `09`。
4. `09` 完成后，A 推进 `17`；F 并行准备 `10/11/12` 的脚本、基准、门禁。
5. 仅当 `09`、`17`、`18` 全部稳定且外部 Terminal 版本冻结后，D 才能启动 Step `08` 集成实施。
6. 最终收口顺序固定为 `17 -> 10 -> 11 -> 12 -> 13`；`08` 不阻塞主线。

## 6. 集成与阻塞规则

- 任一车道写共享目录前，必须先声明 Owner。
- 任一共享契约变更，必须由 A 总控车道统一发布。
- 任一车道触发 `B2/B3` 阻塞，相关并行车道必须暂停，先做边界或文档回写。
- 不允许用“先各自实现、最后一次性揉合”的方式替代每日集成窗口。

## 7. 检查点

- `CP94-1`：每个并行 Step 都有车道、Owner、写入边界。
- `CP94-2`：共享 DTO、Canonical Event、Migration、OpenAPI 均有唯一收口人。
- `CP94-3`：每轮并行结束后都有统一集成窗口和主链验证。

## 8. 执行方式

| 项 | 说明 |
| --- | --- |
| 使用时机 | 并行启动前、波次切换前、集成前 |
| 并行限制 | 文档与只读审计可广泛并行，主实现必须按本表执行 |
| 输出要求 | 车道图、Owner、写入边界、集成窗口、升级责任人 |
