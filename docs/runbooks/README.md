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
