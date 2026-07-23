# BirdCoder Operator Guide

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-23
Specs: DEPLOYMENT_SPEC.md, SOURCE_CONFIG_SPEC.md, SECURITY_SPEC.md, OBSERVABILITY_SPEC.md, RELEASE_SPEC.md

This directory is the operations entrypoint for the stateless BirdCoder
gateway and PC/Tauri host boundary.

## Current Operating Boundary

- Browser and Tauri clients consume canonical Project and Session capabilities
  from the generated Agents App SDK.
- BirdCoder server/container deployments own no business database, migrations,
  backup jobs, project paths, or runtime-location aggregate.
- PC/Tauri owns local directory mounts, Git processes, worktrees, terminals,
  and the allowlisted device-state store.
- Agents owns Project, composition, Session, Turn, Session Item, checkpoint,
  interaction, and Session runtime-binding facts.
- Skills owns skill packages and installations; IM owns human communication.
- A local mount or opaque runtime location id does not enable remote execution.

## Active Guides

- [Agents runtime bindings and PC device mounts](runtime-bindings-and-device-mounts.md)
- [Deployment operations](deployment-operations.md)
- [Windows Server control plane](windows-server-control-plane.md)
- [Recovery and backup ownership](backup-restore.md)
- [Monitoring and alerting](monitoring.md)
- [Incident response](incident-response.md)
- [First governed release checklist](first-governed-release.md)

## Minimum Release Evidence

Route and OpenAPI counts prove catalog alignment only. They do not prove local
filesystem or remote execution capability. Before promotion, run checks that
match the Rust server and PC surfaces:

```bash
pnpm check:server
pnpm check:desktop
pnpm check:multi-mode
node scripts/pc-local-business-storage-boundary-contract.test.mjs
pnpm release:smoke:server
pnpm docs:build
```

Preserve safe verification and trace evidence with the deployment record. Do
not add credentials, native paths, device-state values, or dependency business
payloads to evidence.

## Support Escalation

1. Collect health, readiness, metrics, redacted server logs, and request trace
   identifiers.
2. Identify the owning domain and the safe project, Session, or release
   identifiers without collecting a native path.
3. Use the release manifest rollback reference when the approved error budget
   is exceeded, then open an incident record with redacted evidence.
