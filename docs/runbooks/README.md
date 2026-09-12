# BirdCoder Runbooks

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-22
Specs: `DOCUMENTATION_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `RELEASE_SPEC.md`

This directory is the evidence index for BirdCoder operational procedures.
The executable procedures have one human authority under
[`docs/guides/operator/`](../guides/operator/README.md); this index does not
copy their steps or create a second runbook system.

## Operations

- [Deployment operations](../guides/operator/deployment-operations.md)
- [Windows Server control plane](../guides/operator/windows-server-control-plane.md)
- [Agents runtime bindings and PC device mounts](../guides/operator/runtime-bindings-and-device-mounts.md)
- [Backup and restore](../guides/operator/backup-restore.md)
- [Monitoring and alerting](../guides/operator/monitoring.md)
- [Incident response](../guides/operator/incident-response.md)
- [First governed release](../guides/operator/first-governed-release.md)

Release-specific immutable evidence belongs in [`docs/releases/`](../releases/README.md).
Pre-launch release automation state belongs in [`docs/release/`](../release/).
Database, API, topology, and component machine contracts remain in their owning
manifests and are linked from the procedures instead of being duplicated here.


<!-- scaffold-module-runbooks:index -->
## Docker 运维四件套（bin/ 标准，OPERATIONS_SPEC.md §7）

| Runbook | 内容 |
| --- | --- |
| [deploy.md](deploy.md) / [deploy.en.md](deploy.en.md) | 安装 / 升级 / 回滚 / 下线（bin/docker-deploy.sh + bin/docker-image.sh） |
| [troubleshooting.md](troubleshooting.md) / [troubleshooting.en.md](troubleshooting.en.md) | 症状 → doctor 检查 → 处置 |
| [backup-restore.md](backup-restore.md) / [backup-restore.en.md](backup-restore.en.md) | 备份 / 校验 / 恢复 / 演练（bin/backup.sh） |
| [log-reference.md](log-reference.md) / [log-reference.en.md](log-reference.en.md) | 健康日志特征与失败签名（bin/docker-deploy.sh logs） |
