# BirdCoder Operator Guide

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-16
Specs: DEPLOYMENT_SPEC.md, RUNTIME_DIRECTORY_SPEC.md, SECURITY_SPEC.md, PRIVACY_SPEC.md, OBSERVABILITY_SPEC.md, RELEASE_SPEC.md

This directory is the active operations entrypoint for the BirdCoder control
plane. It documents deployed behavior, safeguards, recovery, and evidence. It
does not promote historical release notes, route counts, or static catalogs
into proof that a remote execution capability is enabled.

## Current Operating Boundary

- Browser and Tauri clients use the same remote Project API through the
  composed app SDK.
- ProjectRuntimeLocation records persist complete target-specific root
  information. Absolute paths are encrypted, write-only at the public API
  edge, and never appear in ordinary API responses, logs, or telemetry.
- A Browser directory handle remains a browser-local capability and never
  becomes a server path or executable target.
- A Tauri local binding is current-device capability material. It can resolve
  a local terminal root but cannot grant another target access to that path.
- A future server/container/runner target may use only its own authenticated,
  verified location through an internal canonical-root resolver. The current
  server workspace has no enrollment aggregate and remains unavailable.
- Current remote server, container, and cloud profiles do not enable arbitrary
  remote code execution merely because a location exists. Unverified or
  unsupported capabilities remain unavailable until isolated-runner evidence
  exists.

## Active Guides

- [Project runtime locations](project-runtime-locations.md)
- [Deployment operations](deployment-operations.md)
- [Windows Server control plane](windows-server-control-plane.md)
- [Backup and restore](backup-restore.md)
- [Monitoring and alerting](monitoring.md)
- [Incident response](incident-response.md)
- [First governed release checklist](first-governed-release.md)

## Minimum Release Evidence

Route and OpenAPI counts prove catalog alignment only. They do not prove that
every target can execute project operations. Before promotion, run checks that
match the modified surface:

    pnpm check:server
    pnpm check:desktop
    pnpm check:multi-mode
    pnpm db:validate
    pnpm release:smoke:server
    pnpm release:smoke:postgresql-live
    pnpm docs:build

For PostgreSQL-backed deployment, run the live smoke against the target
database only in an authorized environment. Preserve safe verification and
trace evidence with the deployment record. Do not add credentials, plaintext
paths, or encrypted path payloads to evidence.

## Support Escalation

1. Collect health, readiness, metrics, redacted server logs, and request trace
   identifiers.
2. Establish the affected tenant, organization, user, project, locationId,
   target identity, capability, and verification state without collecting a
   plaintext path.
3. Use the release manifest rollback reference when the approved error budget
   is exceeded, then open an incident record with redacted evidence.
