# First Governed Rust And PC Release

Status: active pre-launch checklist
Owner: SDKWork maintainers
Updated: 2026-07-23
Specs: RELEASE_SPEC.md, SUPPLY_CHAIN_SECURITY_SPEC.md

This checklist covers the Rust gateway, PC web artifact, and Tauri desktop
artifact. H5 and Flutter are outside this release evidence.

## Architecture Preconditions

- BirdCoder ownership is 0 server business tables, 4 System App operations,
  0 Backend/Open operations, and 4 permissions.
- PC uses canonical Agents Projects, Sessions, and Runtime Bindings.
- Tauri device state passes its allowlist and local mount isolation tests.
- No active compatibility, projection, copied SDK, raw HTTP, or remote
  project-path authority remains.

## Rehearsal

```bash
pnpm check:arch
pnpm check:desktop
pnpm check:server
pnpm check:multi-mode
pnpm check:release-flow
pnpm release:fixture:ready
pnpm release:candidate:dry-run
pnpm release:rehearsal:verify
```

Rehearsal output cannot be promoted as a real release artifact.

## Real Artifacts

```bash
pnpm release:plan
pnpm release:preflight:desktop-signing
pnpm release:package:desktop
pnpm release:package:web
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:verify-trust:desktop
pnpm release:smoke:desktop
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
pnpm release:smoke:web
pnpm release:finalize
pnpm release:smoke:finalized
pnpm release:assert-ready
```

Enable publication only after immutable checksums, signatures, SBOM,
attestations, rollback evidence, and every stop-ship gate are verified.
