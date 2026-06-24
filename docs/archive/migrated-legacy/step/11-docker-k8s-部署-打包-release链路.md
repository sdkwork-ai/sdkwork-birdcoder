# Step 11 - Docker、K8s、部署、打包与 Release 链路

## 1. 目标与范围

建立 BirdCoder 从本地构建到 Desktop、Server、Docker、Kubernetes 的统一交付链，保证命名、矩阵、Smoke、证据和发布说明完全一致。

## 2. 执行输入

- `/docs/架构/06`、`09`、`10`
- Step `09` 统一服务基线
- Step `10` 治理门禁
- Step `15` 多数据库 Provider 标准

## 3. 本步非目标

- 不替代 Step `13` 的发布与回滚演练
- 不重定义 DTO 或 API
- 不新增业务能力

## 4. 最小输出

- 多 OS/CPU 产物矩阵
- Release Profile
- Docker/K8s 模板
- Smoke 脚本与证据目录
- 制品命名标准

## 5. 推荐 review 产物

- 产物矩阵表
- Docker/K8s 环境变量表
- 打包与 Smoke 流程图

## 6. 推荐并行车道

- 执行模式：串行为主
- 车道 F1：打包脚本与 Release Profile
- 车道 F2：Docker/K8s 模板
- 车道 F3：Smoke 与制品证据

## 7. 架构能力闭环判定

- Desktop、Server、Docker、K8s 使用同一命名和发布语义
- 多 OS/CPU 架构制品可被统一 Smoke 和发布链消费

## 8. 完成后必须回写的架构文档

- `/docs/架构/06-编译环境-预览-模拟器-测试体系.md`
- `/docs/架构/09-安装-部署-发布标准.md`
- `/docs/架构/10-开发流程-质量门禁-评估标准.md`

## 9. 设计

- 产物矩阵必须统一到 `sdkwork-birdcoder-*`
- 打包、部署、Smoke、归档必须共享同一 Release Profile 与证据结构
- Docker/K8s 模板只做宿主差异，不重定义业务协议

## 10. 实施落地规划

1. 冻结 OS/CPU/模式矩阵与命名。
2. 收敛 `release:package:*`、`release:smoke:*`、归档与校验脚本。
3. 统一 `deploy/` 下 Docker/K8s 模板与环境变量。
4. 建立多平台 Smoke 汇总与制品证据归档。

## 11. 测试计划

- Package/Smoke/Finalize 回归
- Docker/K8s 渲染与部署 Smoke
- 多平台制品校验和与命名检查

## 12. 结果验证

- `artifacts/release` 可作为 GitHub Release 直接输入
- 多形态交付链已统一命名、统一 Smoke、统一证据

## 13. 检查点

- `CP11-1`：Release Matrix 与命名规则冻结
- `CP11-2`：Desktop/Server/Container/K8s 全进统一交付链
- `CP11-3`：制品证据完整可回溯

## 14. 风险与回滚

- 风险：不同宿主维护平行打包脚本会导致 Release 漂移
- 回滚：保留统一 Profile 与命名主标准，局部回退模板或脚本实现

## 15. 完成定义

- BirdCoder 已具备统一多平台交付链

## 16. 快速并行执行建议

- F1 先冻结矩阵、命名、打包脚本
- F2 并行推进 Docker/K8s 模板
- F3 同步补齐 Smoke 与证据归档
- 最终统一收口命名、版本、制品索引

## 17. 下一步准入条件

- `12` 的质量门禁与 `13` 的正式发布可直接消费标准制品与证据

