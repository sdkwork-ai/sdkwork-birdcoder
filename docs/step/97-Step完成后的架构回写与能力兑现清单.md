# 97 - Step 完成后的架构回写与能力兑现清单

## 1. 目标与范围

用于明确每个 Step 完成后必须回写哪些架构文档、必须兑现哪些能力、必须留下哪些证据，防止“Step 做完了，但架构承诺没有真正兑现”。

## 2. 架构对齐

对齐 `/docs/架构/01-21` 与本目录 `00-18`。任一 Step 若未通过本清单，不得标记为完成。

## 3. Step 兑现清单

| Step | 必须兑现的架构能力 | 重点回写文档 | 必要证据 |
| --- | --- | --- | --- |
| `00` | 统一执行门禁、证据规则、升级规则 | `10` `14` | 门禁文本、模板、规则清单 |
| `01` | 基线事实、差距矩阵、风险目录 | `01` `11` `14` | 审计表、差距矩阵、风险清单 |
| `02` | 共核宿主骨架、目录边界、依赖方向 | `02` `03` | 骨架图、职责表、依赖检查 |
| `03` | 统一模型、DTO、Repository、协议基线 | `05` `07` | 模型表、DTO 表、Schema 说明 |
| `04` | Workspace/Project/Auth/Settings 语义 | `03` `07` `15` | 边界图、恢复验证、设置语义 |
| `05` | 多 Engine SPI、统一会话内核 | `04` `05` `12` `13` | Capability Matrix、Session 标准、错误语义 |
| `06` | Code 工作台、文件系统、编辑器标准 | `03` `06` `14` | 文件流测试、编辑器回归、宿主一致性 |
| `07` | Studio 编排、预览、模拟、编译闭环 | `06` `19` | Preview/Build 闭环、Profile 清单、Smoke |
| `08` | 外部 Terminal 集成 contract、启动映射、证据回写标准 | `12` `15` `16` | 接入 contract、launch mapping、audit/evidence bridge |
| `09` | 统一 `coding-server`、双模访问、OpenAPI 主链 | `02` `09` `20` | 双模矩阵、OpenAPI、SSE/Operation Contract |
| `10` | 性能预算、安全边界、观测审计门禁 | `08` `10` `12` | 基准结果、审计日志、阻断记录 |
| `11` | 多平台交付矩阵、Docker/K8s、Release 产物链 | `06` `09` `10` | 产物索引、Smoke、校验和 |
| `12` | 测试矩阵、CI 门禁、回归自动化 | `06` `08` `10` | 矩阵表、门禁结果、失败归档 |
| `13` | GitHub Flow、灰度、回滚、发布后回写 | `09` `10` `11` `14` | 发布演练、灰度记录、回滚记录 |
| `14` | Appbase Auth/User/VIP 主边界统一 | `17` | Bridge 清单、Route Intent、Parity Contract |
| `15` | 多数据库 Provider、Dialect、Migration、BlobStore | `07` `18` | Provider Contract、迁移回放、authority 模式结果 |
| `16` | Prompt/SkillHub/AppTemplate/项目模板注入链 | `13` `19` | 注入顺序、绑定表、模板实例化验证 |
| `17` | `core/app/admin` API、App/Admin Console、统一生命周期资源 | `09` `20` | 路由矩阵、OpenAPI、Console Contract、权限矩阵 |
| `18` | 多 Engine Adapter、统一工具协议、Conformance | `05` `12` `21` | Adapter Matrix、Canonical Event 映射、Conformance 结果 |
| `20` | `20A team_member` 与 `20B deployment_target` 均已从 schema-only 定义提升到真实 authority，Step 20 已完成 | `07` `18` `20` | 共享仓储、真实路由、Facade、Consumer、release 写回证据 |

## 4. 回写规则

- 只要 Step 改变了能力边界、字段、流程、命名、产物结构，就必须回写 `/docs/架构/`。
- 回写必须与代码、测试、证据在同一轮完成，不允许拖到下一 Step。
- 回写内容必须说明“旧事实被什么替换、证据在哪里”。

## 5. 检查点

- `CP97-1`：每个 Step 都有对应的架构回写项。
- `CP97-2`：每个 Step 都能举证其能力已兑现。
- `CP97-3`：`14-20` 的专项能力不再停留在 README 或 Prompt 中。

## 6. 执行方式

| 项 | 说明 |
| --- | --- |
| 使用时机 | 每个 Step 收尾时 |
| 是否可并行 | 可并行整理草稿，最终回写文本必须统一收口 |
| 输出要求 | 回写文档列表、能力兑现清单、证据索引 |
