# Release And Deployment

Status: active pre-launch contract
Owner: SDKWork maintainers
Updated: 2026-07-23
Specs: RELEASE_SPEC.md, DEPLOYMENT_SPEC.md, SUPPLY_CHAIN_SECURITY_SPEC.md

The current governed scope is the Rust gateway, PC browser artifact, and Tauri
desktop artifact. Mobile manifests are not migration evidence for this scope.

## Artifact Families

| Family | Content | Persistent BirdCoder state |
| --- | --- | --- |
| Desktop | Tauri host, PC renderer, installer | Local allowlisted device state |
| Web | PC browser assets | Browser-local capability storage only |
| Server | Stateless Rust gateway and required assets | None |
| Container/Kubernetes | Stateless gateway packaging and topology | None |

Server, container, and Kubernetes packages contain no BirdCoder database,
migration job, backup job, persistent volume, project directory, or desktop
device-state file.

## Release Evidence

Finalization must produce an immutable release manifest, SHA-256 inventory,
required signatures, SBOM, attestations, target smoke evidence, and rollback
reference. Fixtures and dry-run outputs prove only the orchestration shape.

## Release Notes Source

`docs/release/releases.json` is the machine release registry. Its latest entry
selects the matching note under `docs/release/`; the note must echo release
kind, rollout stage, formal/GA status, and machine stop-ship signals. Neither
artifact overrides the product or architecture Canon.

## Release Metadata Contract

Finalization produces the following immutable evidence surfaces:

- `release-manifest.json`, including `releaseCoverage` and the approved artifact inventory;
- `SHA256SUMS.txt` and `release-manifest.json.sha256.txt`;
- `release-attestations.json` and required signatures/SBOM references;
- `previewEvidence`, `buildEvidence`, `simulatorEvidence`, and `testEvidence` summaries;
- `studio/preview/studio-preview-evidence.json`;
- `studio/build/studio-build-evidence.json`;
- `studio/simulator/studio-simulator-evidence.json`;
- `studio/test/studio-test-evidence.json`.

Partial release coverage, checksum drift, missing attestations, or mutable
container image references are stop-ship conditions. Server, container, and
Kubernetes publication uses immutable image tags or digests.

## GitHub Workflow

The thin GitHub packaging workflow invokes the repository release lifecycle;
it does not reproduce release logic. Uploaded evidence must be traceable to the
same commit, manifest, checksums, and approved release plan.

## Required Sequence

```powershell
pnpm.cmd check:multi-mode
pnpm.cmd check:release-flow
pnpm release:rehearsal:verify

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
pnpm.cmd release:smoke:desktop-startup
pnpm.cmd release:smoke:server
pnpm.cmd release:smoke:container
pnpm.cmd release:smoke:kubernetes
pnpm.cmd release:smoke:web
pnpm.cmd release:finalize
pnpm.cmd release:smoke:finalized
pnpm.cmd release:assert-ready
```

The exact package set comes from the application manifest and release plan.
Publication stops on incomplete ownership, generated-contract drift, missing
artifact trust, or any unresolved architecture gate.

Post-release operations and writeback:

- Rollback entry: record the immutable prior artifact and compatible configuration.
- Writeback targets: update the release registry, release note, artifact index, and approved deployment record from verified evidence only.

## Rollback And Recovery

Rollback redeploys the previous immutable artifact and compatible configuration
or stops promotion. There is no BirdCoder server data restore. Agents, Skills,
IAM, IM, and other owner-domain recovery follows their own release and backup
procedures. Lost PC mounts require explicit local reselection.

See [deployment operations](../guides/operator/deployment-operations.md) and
[the pre-launch release checklist](../guides/operator/first-governed-release.md).
