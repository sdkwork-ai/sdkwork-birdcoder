# Release And Deployment

Status: active pre-launch release contract
Owner: SDKWork maintainers
Updated: 2026-07-14
Specs: `RELEASE_SPEC.md`, `DEPLOYMENT_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`,
`SUPPLY_CHAIN_SECURITY_SPEC.md`

This document is the canonical release and deployment contract for SDKWork
BirdCoder. It covers the Browser IDE, the Tauri Windows local IDE, and the
server or container control plane without treating them as separate products.
It is intentionally limited to currently implemented capabilities:

- BirdCoder is pre-launch. Application install packages remain disabled until
  a governed release is built from real artifacts and passes readiness checks.
- A `desktop` artifact provides the local Tauri host. Its selected folder and
  all native mount paths remain device-private.
- `server`, `container`, and Kubernetes artifacts deploy the authenticated
  BirdCoder control plane. They do not enable a remote terminal, remote file
  browser, arbitrary-code runner, or shared user filesystem.
- Remote project metadata and server-owned storage are authorization-bound.
  A future remote runner needs independent scheduler, process, secret,
  quota, audit, cleanup, and cross-tenant isolation evidence before it can be
  released as a capability.

The deployment profile is `standalone` or `cloud`; `browser`, `desktop`,
`server`, and `container` are runtime targets. Use the
[technical architecture](../architecture/tech/TECH_ARCHITECTURE.md) for the
Browser/Tauri boundary, [deployment operations](../guides/operator/deployment-operations.md)
for control-plane operation, and the
[Windows Server control-plane guide](../guides/operator/windows-server-control-plane.md)
for service-account and ACL requirements.

## Release Notes Source

Release notes are repository-owned records, not ad-hoc GitHub text and not
evidence that an unavailable capability has been released.

- `docs/release/releases.json` is the machine-readable registry.
- `docs/release/<tag>.md` contains the per-tag release note referenced by the
  registry.
- `scripts/release/render-release-notes.mjs` renders the note into the active
  release asset directory from the registry and finalized release metadata.

The latest registry-backed note must state the release kind, rollout stage,
formal-or-GA status, and machine stop-ship signals that match the finalized
manifest. Historical notes remain an audit record; current product capability
is defined by the architecture and operator documentation above.

For the first non-fixture publication, follow
[First Governed Release](../guides/operator/first-governed-release.md). Its
pre-launch gates must run against real artifacts, never against the rehearsal
fixture directories.

## Release Metadata Contract

Finalization writes these governance surfaces under the active release asset
directory, normally `artifacts/release/` locally and `release-assets/` in the
shared workflow:

- `release-manifest.json` is the machine-readable inventory, release control,
  coverage, and evidence summary.
- `release-manifest.json.sha256.txt` is the checksum sidecar for that manifest.
- `SHA256SUMS.txt` records the publishable artifact checksums.
- `release-attestations.json` records verified artifact-attestation evidence
  when attestations are enabled.

Every publishable entry in `release-manifest.json.artifacts` has a safe
relative path, size, SHA-256 value, family, platform, and architecture. It
must appear once in `SHA256SUMS.txt`; when attestation is required, it must
also have matching evidence in `release-attestations.json`. Evidence files may
be retained beside artifacts without becoming publishable checksum entries.

`releaseCoverage` is the publication completeness gate. It records the active
profile's required targets, the target artifacts found, and any missing
targets. `pnpm.cmd release:assert-ready` rejects incomplete coverage,
`releaseCoverage.allowPartialRelease = true`, checksum/size drift, missing
attestation evidence, and unresolved formal or general-availability
stop-ship signals.

The manifest also freezes `releaseControl` (`releaseKind`, `rolloutStage`,
`monitoringWindowMinutes`, `rollbackRunbookRef`, and an optional
`rollbackCommand`) so planning, finalization, release notes, and rollback use
one release decision.

When present, Studio evidence is retained as both raw archive and normalized
manifest summary:

- `previewEvidence` from `studio/preview/studio-preview-evidence.json`
- `buildEvidence` from `studio/build/studio-build-evidence.json`
- `simulatorEvidence` from `studio/simulator/studio-simulator-evidence.json`
- `testEvidence` from `studio/test/studio-test-evidence.json`

These evidence fields prove the recorded build or test activity; they do not
turn a Browser directory handle, a Tauri local path, or server storage into a
remote execution capability.

## GitHub Workflow

`.github/workflows/package.yml` delegates package publication to the pinned
SDKWork shared workflow. `sdkwork.workflow.json` declares the BirdCoder target
matrix and aggregate release behavior, while
`scripts/release/sdkwork-workflow-lifecycle.mjs` maps each target to the
repository-owned package, smoke, finalization, and attestation commands.

The common release gate verifies cross-mode behavior before a package can be
considered ready:

```powershell
pnpm.cmd check:multi-mode
pnpm.cmd check:release-flow
```

Before the first real package build, record rehearsal evidence with
`pnpm.cmd release:fixture:ready`, `pnpm.cmd release:candidate:dry-run`, and
`pnpm.cmd release:rehearsal:verify`. The rehearsal verification is expected to
remain blocked until `artifacts/release/` contains real, finalized artifacts;
fixture output must never be promoted as release evidence.

For real release assets, the workflow and the release owner use the following
sequence. `pnpm.cmd` is the Windows form; use `pnpm` on Unix runners.

```powershell
pnpm.cmd release:plan
pnpm.cmd release:preflight:desktop-signing
pnpm.cmd release:package:desktop
pnpm.cmd release:package:server
pnpm.cmd release:package:container
pnpm.cmd release:package:kubernetes
pnpm.cmd release:package:web
pnpm.cmd release:verify-trust:desktop
pnpm.cmd release:smoke:desktop
pnpm.cmd release:smoke:desktop-packaged-launch
pnpm.cmd release:smoke:server
pnpm.cmd release:smoke:container
pnpm.cmd release:smoke:kubernetes
pnpm.cmd release:smoke:web
pnpm.cmd release:finalize
pnpm.cmd release:smoke:finalized
pnpm.cmd release:write-attestation-evidence -- --repository <owner/repo> --release-tag <tag>
pnpm.cmd release:assert-ready
```

`pnpm.cmd release:smoke:desktop-startup` is deliberately a local/manual
launched-session evidence gate. It is required before a desktop promotion but
is not injected into the reusable package lifecycle because that lifecycle
proves packaged launch rather than a human-operated desktop session.

The workflow renders release notes, finalizes the full asset set, runs
finalized smoke, writes attestation evidence, and then runs the readiness
assertion. Publication must stop if the final directory differs from the
checksum inventory, artifact attestation is absent when required, or the
manifest reports an incomplete release.

## Artifact Families

All artifact families are governed by the same manifest and evidence model.
The current application manifest marks pre-launch install entries disabled;
the following descriptions define a future governed artifact, not an enabled
download today.

### Desktop

The `desktop` family packages the Tauri local IDE. Installer artifacts retain
their platform, architecture, bundle type, target, and signing evidence.
`release:verify-trust:desktop` is the only standard command that promotes
installer trust evidence after platform verification. A formal or
general-availability desktop release requires completed signing/trust
evidence. The local folder stays on the user device and is not part of a
server archive.

### Server

The `server` family packages the native BirdCoder control-plane host and its
required web assets for a service-style deployment, including Windows Server.
It must use protected configuration, authenticated API access, and
server-derived workspace boundaries. It does not package or enable a shared
remote runner.

### Container

The `container` family packages control-plane deployment inputs and published
OCI image metadata. It is not a promise of a multi-user remote execution
container. Published releases use immutable image tags for operator selection
and retain the immutable image digest as the release identity.

### Kubernetes

The `kubernetes` family packages the chart plus release-specific values and
metadata. The deployment can use a digest-pinned image and supports an
explicit tag fallback. Production deployment uses immutable image tags and a
published digest, protected secrets, PostgreSQL where required, explicit
origins, readiness/liveness checks, and a separately authorized server
workspace root.

### Web

The `web` family packages the Browser IDE and generated documentation site.
It consumes public endpoint configuration only. Browser File System Access
handles, user paths, tokens, and server workspace roots are never web release
configuration or artifact metadata.

## Finalization And Operations

`pnpm.cmd release:finalize` aggregates family outputs and generates the
release manifest. `pnpm.cmd release:smoke:finalized` then verifies that the
finalized evidence summaries, coverage, and artifact inventory still match
their raw evidence. The final `pnpm.cmd release:assert-ready` gate is required
before publishing, mirroring, enabling an install package, or promoting a
release manifest.

Post-release operations and writeback:

- Observe the active `releaseControl` rollout stage for its configured
  monitoring window and use the manifest's stop-ship signals as the operator
  decision source.
- Stop promotion for topology drift, incomplete `releaseCoverage`, failed
  finalized smoke, absent required attestation, or incomplete desktop trust
  evidence.
- Keep product deployment status honest: neither a control-plane package nor a
  configured server workspace root enables remote file, terminal, run, or
  deployment operations.
- Rollback entry: use the rendered manifest rollback command when supplied;
  otherwise run `pnpm.cmd release:rollback:plan -- --release-tag <tag>
  --release-assets-dir artifacts/release` and deploy the previous compatible
  artifact/configuration pair.
- Writeback targets: update only the selected entry in
  `docs/release/releases.json` and its referenced per-tag markdown release
  note after verified release evidence is available. Preserve unrelated
  historical registry entries and top-level metadata.

The full server rollout, backup, and recovery procedure remains in
[deployment operations](../guides/operator/deployment-operations.md). The
Windows service-account, directory, and ACL procedure remains in the
[Windows Server control-plane guide](../guides/operator/windows-server-control-plane.md).
Neither guide authorizes release asset-manifest edits outside the governed
packaging and finalization flow.
