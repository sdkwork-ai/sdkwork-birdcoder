# BirdCoder Operator Guide

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-14
Specs: `DEPLOYMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`, `RELEASE_SPEC.md`

This directory is the active operations entrypoint for the BirdCoder control
plane. It documents deployed behavior, required safeguards, and recovery
steps. It does not promote historical release notes, route counts, or static
catalogs into proof that a remote execution capability is enabled.

## Current Operating Boundary

- Browser and Tauri clients use the same remote Project API through the
  composed app SDK.
- A Browser folder handle or Tauri path is device-private and never becomes a
  server project root, API field, or log value.
- The server derives any server-owned workspace storage from authenticated
  tenant, organization, user/membership, workspace, and project context.
- Current remote `server`, `container`, and `cloud` profiles do not enable
  remote code execution merely because server workspace storage is configured.
  They must report a typed unavailable capability until isolated-runner evidence
  exists.

## Active Guides

- [Deployment operations](deployment-operations.md)
- [Windows Server control plane](windows-server-control-plane.md)
- [Backup and restore](backup-restore.md)
- [Monitoring and alerting](monitoring.md)
- [Incident response](incident-response.md)
- [First governed release checklist](first-governed-release.md)

## Minimum Release Evidence

HTTP OpenAPI 161 operations and route catalog 162 entries are aligned. These
numbers prove catalog alignment, not successful execution against every
deployment dependency. Four surfaces gated by
`surface-manifest-parity` remain pre-launch: root, PC, H5, and Flutter Mobile.

Run the checks that match the modified surface before promotion:

```bash
pnpm.cmd check:server
pnpm.cmd check:desktop
pnpm.cmd check:multi-mode
pnpm.cmd release:smoke:server
pnpm.cmd release:smoke:postgresql-live
pnpm.cmd docs:build
```

For PostgreSQL-backed deployment, run the live smoke against the target
database only in an authorized environment. Preserve the resulting evidence
with the deployment record; do not add credentials or filesystem paths to the
record.

## Support Escalation

1. Collect `/healthz`, `/readyz`, `/metrics`, redacted server logs, and request
   trace identifiers.
2. Establish the affected tenant, organization, user, project, deployment
   profile, and runtime target without collecting a user-local mount path.
3. Use the release manifest rollback reference when the approved error budget
   is exceeded, then open an incident record with the redacted evidence.
