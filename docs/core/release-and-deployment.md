# Release And Deployment

## Overview

SDKWork BirdCoder follows the same multi-family release shape as Claw Studio while keeping BirdCoder business behavior unchanged.

The release flow produces:

- `desktop` archives for desktop packaging and installer smoke verification
- `server` native bundles with embedded web assets
- `container` Docker-oriented deployment bundles
- `kubernetes` Helm-compatible deployment bundles
- `web` static web and docs archives

### Identity deployment and packaging standard

Release packaging follows the same identity standard as development. BirdCoder keeps one frontend-facing auth facade while release artifacts are produced for different deployment and provider bindings:

| Identity lane | Standard build commands | Standard package commands | Authority |
| --- | --- | --- | --- |
| `desktop-local` | `pnpm tauri:build`, `pnpm desktop:build:local` | `pnpm package:desktop:local` | Embedded local sqlite user center |
| `server-private` + `builtin-local` | `pnpm build`, `pnpm desktop:build:private`, `pnpm web:build:private`, `pnpm server:build`, `pnpm server:build:private` | `pnpm package:web:private`, `pnpm package:server:private`, `pnpm package:desktop:private` | Private BirdCoder server with builtin local authority |
| `server-private` + `external-user-center` | `pnpm build:external`, `pnpm desktop:build:external`, `pnpm web:build:external`, `pnpm server:build:external` | `pnpm package:web:external`, `pnpm package:server:external`, `pnpm package:desktop:external` | Private BirdCoder server with external identity bridge |
| `cloud-saas` + `sdkwork-cloud-app-api` | `pnpm build:cloud`, `pnpm desktop:build:cloud`, `pnpm web:build:cloud`, `pnpm server:build:cloud` | `pnpm package:web:cloud`, `pnpm package:server:cloud`, `pnpm package:desktop:cloud` | BirdCoder server delegates identity to `sdkwork-cloud-app-api` |

The release standard is not “different API per deployment.” It is “different server binding behind the same BirdCoder facade.” Packaged desktop and web clients still consume the same canonical `/api/app/v1/auth/*`, `/api/app/v1/user/profile`, and `/api/app/v1/vip/info` routes after packaging.

For remote desktop packaging lanes such as `private`, `external`, and `cloud`, `BIRDCODER_API_BASE_URL` or `VITE_BIRDCODER_API_BASE_URL` must be set explicitly so packaged artifacts never fall back to localhost by accident.

## Local Verification And Packaging

Run the highest-signal local gate from the workspace root when a change touches desktop, server, docker, kubernetes, or release automation behavior:

```bash
pnpm check:multi-mode
```

When a change is isolated to the desktop delivery surface, run:

```bash
pnpm check:desktop
```

This keeps desktop-target packaging assumptions, host bindings, and desktop-facing runtime integrations aligned before you widen verification back out to the multi-family release stack.

When a change is isolated to the server delivery surface, run:

```bash
pnpm check:server
```

This keeps server bootstrap assumptions, runtime wiring, and server-facing packaging expectations aligned before you widen verification back out to the multi-family release stack.

When a change is primarily about reusable release automation, release notes rendering, release asset assembly, or release contract shape, run:

```bash
pnpm check:release-flow
```

This keeps release-facing verification aligned with the same executable release contract that packages, smoke checks, manifest finalization, rendered notes, and docs-backed publication already share.

When a change touches reusable CI bindings, release workflow topology, or local-to-GitHub release handoff contracts, run:

```bash
pnpm check:ci-flow
```

This keeps release-facing verification aligned with the same executable CI contract that already freezes workflow tier binding, release verification order, and reusable release entrypoints.

When a change touches Step 10 governance, run:

```bash
pnpm check:governance-regression
pnpm check:live-docs-governance-baseline
```

This emits `artifacts/governance/governance-regression-report.json` and currently aggregates 111 existing checks across package and governance baseline, web budget, host runtime and host-studio lanes, Studio execution and evidence lanes, run-configuration and workbench runtime governance, chat and local-store governance, the official-SDK-first engine lane, i18n, desktop Tauri and Vite host governance, UI dependency and bundle governance, shared SDK and source-parse governance, architecture and structure governance, release and CI flow governance, prompt and template governance, PostgreSQL live-smoke governance, release packaging, desktop signing environment preflight, desktop installer trust verification, smoke governance, release checksum publication-view governance, release readiness assertion, release readiness complete-matrix governance, release readiness fixture generator governance, release candidate dry-run evidence governance, release rehearsal verification governance, release notes governance, BirdCoder architecture, appbase parity, unified user-center standard governance, and release closure. When a command-backed slice reaches the governed Vite or esbuild path and the host stops at `[vite:define] spawn EPERM`, the same report now records `blockedCheckIds`, `blockingDiagnosticIds`, and `environmentDiagnostics` such as `vite-host-build-preflight` instead of classifying that host limitation as a failed repository regression. `pnpm check:live-docs-governance-baseline` complements that machine-readable report by freezing active architecture, Step, and release docs against the same governance vocabulary.

When a change touches Step 12 quality tiers, run:

```bash
pnpm check:quality-matrix
pnpm check:quality:fast
pnpm check:quality:standard
pnpm check:quality:release
pnpm quality:report
pnpm quality:execution-report
```

This freezes the CI and release preflight tiers and emits `artifacts/quality/quality-gate-matrix-report.json`. `pnpm check:quality-matrix` verifies that the declared quality tiers, workflow bindings, and root `package.json` `check:quality:*` bindings still match the repository standard before the reports are treated as release evidence, and it now also rejects a stale workspace `artifacts/quality/quality-gate-matrix-report.json` when that file no longer matches the current generated tier, workflow, or manifest truth. That freshness comparison now ignores host-specific `environmentDiagnostics` drift when the stable tier/workflow/manifest truth is unchanged.
The report now also freezes per-tier manifest binding state plus `environmentDiagnostics` and `blockingDiagnosticIds`, so host-level `toolchain-platform` blockers are archived with the same asset as tier ownership and workflow/root-manifest binding truth.
If the workspace artifact becomes stale after a quality-tier command or workflow change, rerun `pnpm quality:report` before treating that file as active release evidence.
Blocked diagnostics now also preserve `requiredCapabilities` and `rerunCommands`, so the same quality artifact can say what the host is missing and which gate sequence must be rerun after the environment is fixed.
The release tier now also freezes `governanceCheckIds` for the full official-SDK-first engine governance set, covering official SDK presence, runtime selection, canonical runtime and kernel projection, provider SDK governance, browser safety, bridge error propagation, provider bridge contracts, engine conformance, tool protocol, and resume or recovery closure. That keeps engine-governance risk visible inside the quality score surface instead of living only in raw release-flow output.
`pnpm quality:execution-report` complements that matrix with `artifacts/quality/quality-gate-execution-report.json`, recording the real `fast -> standard -> release` cascade, the last executed tier, and downstream skipped tiers after a blocker.
When the workspace host reaches an affected Vite-backed quality gate and the build preflight hits `[vite:define] spawn EPERM`, the execution report now records the dedicated `vite-host-build-preflight` blocker so that fast-tier stop is preserved as a host or toolchain block instead of being misreported as ordinary contract failure.
The Step 12 desktop startup-graph lane is now also port-resilient: an unrelated listener on the legacy `127.0.0.1:1537` port no longer fabricates a fast-tier failure because the startup-graph contract now selects a free loopback port and `check:desktop-startup-graph` freezes that regression.
Release finalization regenerates the same report shape under `quality/quality-gate-matrix-report.json` inside the active release asset directory and, when the runtime artifact already exists, archives it as `quality/quality-gate-execution-report.json` so published assets, finalized smoke, and release notes consume one runtime verdict.
When `scripts/release/render-release-notes.mjs` writes `release-notes.md` inside that same release asset directory and `SHA256SUMS.txt` already exists, it now refreshes the checksum inventory from `release-manifest.json.artifacts` when a finalized manifest is present, so rendered notes cannot pollute the publishable artifact digest surface.
Rendered post-release `Stop-ship signals` now also absorb runtime blocked tiers, runtime failed tiers, and runtime blocking diagnostics from packaged `qualityEvidence`, so operator release notes cannot under-report a publish-blocking execution verdict that is already present in finalized assets.
The finalized `qualityEvidence` summary now also preserves manifest-bound tier counts beside workflow-bound counts and the release-tier engine governance set as `releaseGovernanceCheckIds`, so the official-SDK-first engine-governance closure survives packaging instead of disappearing after the quality report stage and the packaged loop scoreboard cannot stay at `100` when root quality-tier topology drifts.
On the current Windows host, the runtime execution report now preserves a blocked Vite-host preflight state instead of fabricating a contract failure: `status=blocked`, `passedCount=0`, `blockedCount=1`, `failedCount=0`, `lastExecutedTierId=fast`, and `blockingDiagnosticIds=["vite-host-build-preflight"]` in `artifacts/quality/quality-gate-execution-report.json`.
That host result keeps the declared `fast -> standard -> release` topology intact while making the downstream `standard` and `release` skips explicit until the governed Vite or esbuild execution path is stable again.
Fresh outer-shell reruns on `2026-04-15` now confirm a narrower split truth on this host: direct `pnpm.cmd run build` passes under the bundle budget, but direct `pnpm.cmd check:quality:fast` fails at `check:web-vite-build` with `[vite:define] spawn EPERM`, and direct `pnpm.cmd check:quality:release` exits non-zero for the same reason because `fast` stops first. Treat both `pnpm quality:execution-report` and the governed release-flow evidence as the active blocker truth until the Vite-host execution-path divergence is eliminated on Windows.
DSN-backed `pnpm release:smoke:postgresql-live` remains a separate environment gate. If the host lacks a real PostgreSQL DSN or driver, keep that lane explicitly blocked rather than weakening the quality-tier truth.
If a DSN is configured but the PostgreSQL backend is unreachable, the same command must return a structured `failed` report instead of crashing during provider cleanup.
On this Windows host, that gate has now also been closed with a real `passed` report against a temporary Docker-backed `postgres:16-alpine` instance published on `127.0.0.1:55432`.

When a change touches the unified `auth`, `user`, or `vip` boundary, run:

```bash
pnpm check:identity-standard
```

This keeps release-facing verification aligned with the same `sdkwork-birdcoder-auth` and `sdkwork-birdcoder-user` split identity contract already frozen by architecture docs, Step docs, prompt governance, and `check:release-flow`.

When a change touches the unified user-center bridge or the independent validation plugin boundary, run:

```bash
pnpm test:user-center-standard
```

This keeps release-facing verification aligned with the same root-owned user-center standard lane that freezes appbase parity, the independent validation plugin contract, and the Rust host handoff under one canonical command.

When a change touches workspace package ownership, package naming, or root-managed dependency governance, run:

```bash
pnpm check:package-governance
```

This keeps release-facing verification aligned with the same workspace package contract already frozen by the command reference, development guide, prompt governance, and the release-flow/governance regression lanes.

Use the family packagers and smoke commands when you need a focused release slice:

```bash
pnpm release:plan
pnpm release:candidate:dry-run
pnpm release:rehearsal:verify
pnpm release:preflight:desktop-signing
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
pnpm release:rollback:plan
pnpm release:verify-trust:desktop
pnpm release:smoke:desktop
pnpm release:smoke:desktop-packaged-launch
pnpm release:smoke:desktop-startup
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
pnpm release:smoke:web
pnpm release:finalize
pnpm release:smoke:finalized
pnpm release:assert-ready
```

When you need BirdCoder-mode packaging rather than family-only release bundles, prefer the explicit mode matrix first and then move into the release family commands:

```bash
pnpm package:desktop:local
pnpm package:desktop:private
pnpm package:desktop:external
pnpm package:desktop:cloud
pnpm package:web:private
pnpm package:web:external
pnpm package:web:cloud
pnpm package:server:private
pnpm package:server:external
pnpm package:server:cloud
```

Packaged families land under `artifacts/release/<family>/...` with family manifests and finalization metadata. Desktop and server bundles are split by operating system and CPU architecture. Container and kubernetes bundles are also split by accelerator profile.

`pnpm release:candidate:dry-run` is the standard offline commercial release-candidate rehearsal. It writes a complete synthetic finalized release under `artifacts/release-candidate-dry-run`, runs the same release readiness assertion used by publication, and writes `release-candidate-dry-run-report.json` with schema `birdcoder.releaseCandidateDryRun.v2`. The report keeps artifact counts, required target counts, readiness evidence, stop-ship signals, and the recommended real release command sequence, and it now also embeds `rehearsalPlan` with schema `birdcoder.releaseRehearsalPlan.v1`. That structured rehearsal plan groups the real commands into plan, environment preflight, package, trust, smoke, finalize, attestation, and publish-readiness phases, names the expected audit evidence paths, and marks the external gates that require signing, platform trust, or GitHub attestation inputs.
`pnpm release:rehearsal:verify` is the standard real-asset rehearsal evidence gate. It reads the v2 dry-run report, verifies the real `artifacts/release` directory has every concrete evidence path required by `rehearsalPlan`, and writes `artifacts/release-rehearsal/release-rehearsal-execution-report.json` with schema `birdcoder.releaseRehearsalExecution.v1`. Missing evidence is reported as `blocked` with the affected phase ids, while dry-run schema or command-plan drift is reported as `failed`; the command does not execute signing, publishing, or any other release-producing command.
CI also runs this dry-run after the release readiness fixture and uploads `artifacts/release-candidate-dry-run` as `release-candidate-dry-run-evidence`, so every main or pull-request verification has a machine-readable release-candidate audit artifact instead of relying only on console logs.

`pnpm release:preflight:desktop-signing` is the standard build-before-bundle desktop signing environment gate. It verifies the current desktop target has the required signing tools and non-empty credential environment for the selected bundle set without running signing or printing secret values: Windows requires `signtool`, a matching CurrentUser code-signing certificate from `BIRDCODER_WINDOWS_SIGNING_CERT_SHA1`, and `BIRDCODER_WINDOWS_SIGNING_TIMESTAMP_URL`; macOS requires `codesign`, `spctl`, `stapler`, `notarytool`, a keychain identity named by `BIRDCODER_MACOS_CODESIGN_IDENTITY`, and either the Apple ID notarization trio or the App Store Connect API-key trio; Linux checks package metadata tools only for the requested bundles.

Desktop release packaging is profile-governed before any archive or manifest is written. `pnpm release:package:desktop` rejects platform, architecture, or Rust target triples that are not present in the active release profile, then verifies that every required Tauri installer bundle for that target exists under the matching bundle output directory. For example, the Windows x64 profile target must provide both `nsis` and `msi`; Linux x64 must provide `deb`, `rpm`, and `appimage`; macOS targets must provide `app` and `dmg`.

`pnpm release:verify-trust:desktop` is the standard desktop installer trust gate between packaging and smoke. It verifies real platform trust for the current desktop target, rewrites installer `signatureEvidence` from `pending` to `passed` only after every installer passes, and writes `desktop/<platform>/<arch>/desktop-installer-trust-report.json` for finalization and audit replay.

The local wrapper defaults `pnpm release:plan`, `pnpm release:package:*`, `pnpm release:verify-trust:desktop`, `pnpm release:finalize`, and `pnpm release:assert-ready` to `artifacts/release`. `pnpm release:preflight:desktop-signing` is intentionally independent because it checks the runner environment before desktop bundle creation, while GitHub Actions aggregates the packaged release families under `release-assets/`.

To make release intent explicit, pass release-control flags through the local wrapper:

```bash
pnpm release:plan -- --release-kind canary --rollout-stage ring-1 --monitoring-window-minutes 45 --rollback-runbook-ref docs/step/13-发布就绪-github-flow-灰度回滚闭环.md
pnpm release:rollback:plan -- --release-tag release-2026-04-09-105 --release-assets-dir artifacts/release --rollback-command "gh workflow run rollback.yml --ref main"
pnpm release:finalize -- --release-assets-dir artifacts/release --release-kind canary --rollout-stage ring-1 --monitoring-window-minutes 45 --rollback-runbook-ref docs/step/13-发布就绪-github-flow-灰度回滚闭环.md --repository Sdkwork-Cloud/sdkwork-birdcoder
```

## Kubernetes Image Contract

BirdCoder release bundles keep immutable image tags and will prefer `image.digest` when final release metadata records a published OCI digest.

- `deploy/kubernetes/values.yaml` must not ship `tag: latest`
- `values.release.yaml` and `release-metadata.json` are emitted for packaged kubernetes bundles
- the deployment template supports both digest-pinned and explicit tag fallback image references

## Release Notes Source

BirdCoder release notes are repository-owned artifacts rather than ad-hoc GitHub text.

- release metadata lives in `docs/release/releases.json`
- per-tag notes live under `docs/release/`
- the reusable workflow renders notes through `scripts/release/render-release-notes.mjs`

When a release candidate remains unpublished, the next candidate can carry forward those earlier notes through `carryForward` entries in `docs/release/releases.json`.
When note rendering falls back to `release-manifest.json`, the rendered markdown must still preserve the same `releaseControl` summary used by the release plan and finalized manifest.
Docs-backed note rendering now also appends finalized evidence from `release-manifest.json` when a finalized asset directory is available, so GitHub release text can surface the same quality and governance blockers as the packaged assets.

## Release Metadata Contract

Each finalized release produces four top-level release-governance files under the active release asset directory:

- `release-manifest.json`
- `release-manifest.json.sha256.txt`
- `SHA256SUMS.txt`
- `release-attestations.json`

`release-manifest.json` is the machine-readable inventory surface for download and deployment tooling. `release-manifest.json.sha256.txt` is the checksum sidecar for that finalized manifest itself, and `pnpm release:assert-ready` validates it before trusting any manifest fields. `SHA256SUMS.txt` is the portable checksum surface for the publishable artifact set, not a digest index for every evidence file in the release directory. `release-attestations.json` is written after GitHub artifact attestation and records the verified `gh attestation verify` evidence for every finalized artifact. The finalized manifest keeps the existing `assets` evidence view for release notes and finalized smoke, and it also emits a checksum-backed `artifacts` publication view. Every `artifacts[]` entry must name a safe relative path, record `sha256` and `size`, appear exactly once in `SHA256SUMS.txt`, and have a matching verified entry in `release-attestations.json` when artifact attestations are enabled. Desktop installer entries also carry `kind: installer`, `bundle`, `installerFormat`, `target`, and structured `signatureEvidence`; finalized `releaseCoverage` uses explicit bundle metadata before falling back to legacy extension inference, while formal/GA promotion gates read `signatureEvidence` as packaged trust evidence. Evidence files such as `release-notes.md` and `finalized-release-smoke-report.json` may be published beside the artifacts, but they must not be inserted into `SHA256SUMS.txt` unless they are explicitly promoted into `release-manifest.json.artifacts`.

The manifest `releaseCoverage` object is the publication-readiness gate. It records every target required by the active release profile, every target present in the aggregated artifact set, every missing target, and whether the manifest was generated for an explicit partial local/debug aggregation. `pnpm release:assert-ready` independently re-reads `release-manifest.json` and `SHA256SUMS.txt`, rejects `releaseCoverage.status != complete`, rejects `releaseCoverage.allowPartialRelease = true`, rejects any missing target, and verifies every artifact checksum and size before a release is publishable.

Finalization also freezes `releaseControl` into the top-level manifest so `pnpm release:plan`, `pnpm release:finalize`, manifest fallback notes, and GitHub release publication share the same release semantics:

- `releaseKind`
- `rolloutStage`
- `monitoringWindowMinutes`
- `rollbackRunbookRef`
- `rollbackCommand` (optional)

`pnpm release:rollback:plan` reuses the same `releaseControl` surface plus the finalized manifest to emit a deterministic rollback summary with:

- finalized asset families
- evidence file location
- preflight checks
- rollback runbook reference
- rollback command fallback

`scripts/release/rollback-plan-command.test.mjs` is the release-flow and governance-regression contract that freezes this output shape. New release entrypoints must follow the same pattern instead of living only in local ad-hoc tests.

Post-release operations and writeback:
Rendered release notes must also freeze a deterministic post-release operations section so Step 13 observation and writeback are not left to ad-hoc operator memory.

- Observation goal: derived from `releaseKind`
- Observation window: `monitoringWindowMinutes` + `rolloutStage`
- Stop-ship signals: finalized `qualityEvidence` blockers, topology drift, and packaged desktop startup readiness gaps
- Rollback entry: explicit `rollbackCommand` when present, otherwise the fallback `pnpm release:rollback:plan -- --release-tag <tag> --release-assets-dir <dir>`
- Rollback runbook: `rollbackRunbookRef`
- Re-issue path: `pnpm release:plan` -> package/smoke -> `pnpm release:finalize`
- Writeback targets: `docs/release/releases.json` plus the per-tag markdown note when one exists

This keeps docs-backed notes, manifest-fallback notes, and GitHub release text aligned on one post-release checklist instead of maintaining separate human-only runbooks.
When promotion metadata is written back into `docs/release/releases.json`, the renderer must update only the targeted release entry. Unrelated historical release entries and any top-level registry metadata such as schema or generation timestamps must be preserved verbatim.

When Studio evidence archives are exported into the release asset directory, finalization also emits optional top-level summaries in `release-manifest.json` and preserves the raw archives:

- `previewEvidence` with `studio/preview/studio-preview-evidence.json`
- `buildEvidence` with `studio/build/studio-build-evidence.json`
- `simulatorEvidence` with `studio/simulator/studio-simulator-evidence.json`
- `testEvidence` with `studio/test/studio-test-evidence.json`
- `qualityEvidence` with `quality/quality-gate-matrix-report.json`
- optional runtime execution evidence with `quality/quality-gate-execution-report.json`

Each artifact entry records the core delivery dimensions:

- `family`
- `platform`
- `arch`
- `accelerator`
- `relativePath`
- `sha256`
- `size`

BirdCoder keeps the same multi-family metadata model across:

- `desktop`
- `server`
- `container`
- `kubernetes`
- `web`

## GitHub Workflow

`.github/workflows/release.yml` delegates to `.github/workflows/release-reusable.yml`.

GitHub Actions follows the same release shape as Claw Studio:

- prepare the release plan
- verify workspace, desktop, server, web, and docs inputs
- prove the synthetic release readiness fixture and uploadable release-candidate dry-run evidence in CI
- package desktop, server, container, kubernetes, and web artifacts
- smoke packaged artifacts before upload
- publish OCI metadata for the server container family
- finalize checksums and `release-manifest.json`
- run finalized smoke so `qualityEvidence` and other attached evidence summaries are verified before note rendering and publication
- render release notes before the final readiness assertion so the last script gate observes the final release directory shape
- assert release readiness against `release-manifest.json.artifacts` and `SHA256SUMS.txt` immediately before attestation and publication
- publish GitHub release assets

The desktop release job first runs `scripts/release/preflight-desktop-signing-environment.mjs --bundles ...`, then passes the same `matrix.bundles` into `scripts/run-desktop-release-build.mjs --bundles ...` for both Windows and Unix runners. That keeps the signing environment, build request, collected installer artifacts, smoke evidence, and `releaseCoverage` target matrix aligned instead of relying on implicit Tauri defaults.

## Artifact Families

### Desktop

Desktop artifacts package the BirdCoder desktop host and keep installer plus packaged-launch smoke contracts in the reusable release workflow. Startup evidence remains a BirdCoder local/manual release check.

Desktop native installers are published under `desktop/<platform>/<arch>/installers/<bundle>/...` instead of being flattened into the platform directory. The extra bundle segment preserves the Tauri output type (`nsis`, `msi`, `deb`, `rpm`, `appimage`, `app`, or `dmg`) so same-name installer files cannot overwrite each other and release audit trails can map every installer back to the matrix bundle that produced it. Each installer artifact in the family manifest must explicitly declare `kind: installer`, `bundle`, `installerFormat`, the Rust `target`, and `signatureEvidence`; desktop installer smoke rejects manifests that require downstream path inference, extension inference, or implicit trust inference.
Packaging initializes installer `signatureEvidence` as `status: pending` so local and canary batches can preserve an auditable signing gap without faking platform verification. The scheme is derived from the installer family: Windows `nsis`, `msi`, and `squirrel` use `windows-authenticode`; macOS `app` and `dmg` use `macos-codesign-notarization`; Linux `deb`, `rpm`, and `appimage` use `linux-package-metadata`; unknown native bundles use `native-installer-attestation`.
`pnpm release:preflight:desktop-signing` must run before the desktop bundle phase in formal release automation. It proves the runner has the target-specific signing and package metadata toolchain before expensive bundle work starts, but it does not promote installer `signatureEvidence` because no packaged installer has been inspected yet.
`pnpm release:verify-trust:desktop` is the only standard path that promotes this evidence to `passed`. It runs the platform verifier, updates the desktop family manifest atomically after all installers pass, and emits `desktop-installer-trust-report.json` beside the desktop family manifest. Finalization folds that report into `release-manifest.json.assets[].desktopInstallerTrust`, and finalized smoke replays the report to prove the manifest summary did not drift from the verifier output.
Formal releases and any `general-availability` rollout-stage require `signatureEvidence.status: passed`. Windows evidence must include `verifiedAt`, `subject`, `issuer`, and `timestamped: true`; macOS evidence must include `verifiedAt`, `subject`, `issuer`, `notarized: true`, and `stapled: true`; Linux and generic native package evidence must include `verifiedAt` and `packageMetadataVerified: true`.
Desktop packaging fails before creating the packaged archive, family manifest, or copied installer artifacts when any profile-required bundle is absent or when the requested target is outside the release profile. This keeps incomplete desktop installers from reaching smoke, finalization, or GitHub upload as partial commercial release assets.

### Server

Server artifacts package the native BirdCoder server host together with the built web assets so one archive can boot independently in server mode.

### Container

Container artifacts package Docker-oriented deployment inputs and image metadata for Linux targets and accelerator-aware deployment variants.

### Kubernetes

Kubernetes artifacts package Helm-compatible chart assets plus `values.release.yaml` and `release-metadata.json` so published image references can be pinned by tag or digest.

### Web

Web artifacts package the BirdCoder web build together with the generated docs site so browser-hosted delivery stays aligned with the same release tag and finalized manifest.

## Finalization Step

The packaging flow is intentionally split into:

1. family-specific package collection
2. desktop signing environment preflight before the desktop bundle phase
3. desktop installer trust verification for desktop targets after packaging
4. desktop installer and packaged-launch smoke verification for desktop targets
4. packaged server and deployment smoke verification for server, container, and kubernetes targets
5. global release finalization

Run the final aggregation step with:

```bash
pnpm release:finalize
pnpm release:smoke:finalized
node scripts/release/render-release-notes.mjs --release-tag <tag> --release-assets-dir artifacts/release --output artifacts/release/release-notes.md
pnpm release:write-attestation-evidence -- --repository <owner/repo> --release-tag <tag>
pnpm release:assert-ready
pnpm release:rehearsal:verify
```

Locally the finalizer reads from `artifacts/release`; in GitHub workflows the same step runs against `release-assets/`. BirdCoder keeps launched-session desktop startup evidence as a local/manual release gate, while the reusable GitHub workflow stops at packaged-launch smoke to stay aligned with the Claw release shape. The GitHub publish job runs `render release notes -> finalize -> smoke-finalized -> attest -> write attestation evidence -> assert-ready -> publish`, so publication cannot proceed from a partial manifest, a checksum-drifted artifact, a mismatched `release-manifest.json.sha256.txt`, missing `release-attestations.json`, or a final release directory that changed after attestation evidence was written. Run `pnpm release:rehearsal:verify` after readiness assertion when you need a machine-readable final rehearsal execution report for the real local `artifacts/release` evidence set without executing signing, packaging, smoke, attestation, or publishing commands again.

If `studio/preview/studio-preview-evidence.json` is present, the finalizer normalizes it into `release-manifest.json.previewEvidence` so preview replay evidence can flow into later smoke and diagnostics stages without coupling the release layer to browser-local storage details.

If `studio/build/studio-build-evidence.json` is present, the finalizer also emits `release-manifest.json.buildEvidence` with normalized build targets, output kinds, project scope, and latest launch time.

If `studio/simulator/studio-simulator-evidence.json` is present, the finalizer also emits `release-manifest.json.simulatorEvidence` with normalized simulator channels, runtimes, project scope, and latest launch time.

If `studio/test/studio-test-evidence.json` is present, the finalizer also emits `release-manifest.json.testEvidence` with normalized test commands, project scope, and latest launch time.

The finalizer now always emits `quality/quality-gate-matrix-report.json` and `release-manifest.json.qualityEvidence` with:

- tier ids plus workflow-bound and manifest-bound tier counts
- failure classification ids
- environment diagnostic count
- blocking diagnostic ids, normalized blocker summaries, required host capabilities, and rerun command sequence
- when `artifacts/quality/quality-gate-execution-report.json` is present, runtime execution archive path, runtime gate status, last executed tier, blocked/failed/skipped tier ids, and runtime blocking diagnostic ids

For `formal` releases and any explicit `general-availability` rollout-stage, finalization now treats packaged stop-ship evidence as a hard publication gate instead of advisory metadata. That gate is driven by the same packaged signal set used in rendered release notes:

- workflow topology drift
- manifest topology drift
- packaged quality blockers
- runtime blocked tiers
- runtime failed tiers
- runtime blocking diagnostics
- desktop installer trust evidence that is missing, pending, failed, or incomplete for its platform scheme
After finalization, local verification can run:

```bash
pnpm release:smoke:finalized
```

This post-finalize smoke step validates that any attached `previewEvidence`, `buildEvidence`, `simulatorEvidence`, and `testEvidence` summaries still match their raw evidence archives.
It now also validates that `qualityEvidence` still matches the raw `quality/quality-gate-matrix-report.json` artifact and, when present, the archived `quality/quality-gate-execution-report.json` runtime verdict.
When the finalized manifest declares `formal` or `general-availability` release control, this smoke step also fails if any packaged stop-ship evidence remains, so operator signoff cannot succeed against a manifest that still advertises publication blockers.
When the release asset directory already contains `SHA256SUMS.txt`, finalized smoke now refreshes that checksum inventory after writing `finalized-release-smoke-report.json`; for finalized manifests the refresh is driven by `release-manifest.json.artifacts`, so post-finalize evidence replay cannot expand the publishable digest surface accidentally.
After finalized smoke and release-note rendering, `pnpm release:assert-ready` is the final publish gate. It validates the manifest `releaseCoverage` state against the active profile, proves `SHA256SUMS.txt` matches the finalized `artifacts` publication view, and replays the same formal/GA stop-ship gate against desktop installer trust evidence before operators publish or mirror assets.
The finalized smoke report now also publishes a machine-readable promotion summary:

- `stopShipSignals`: the same packaged blocker list rendered into release notes
- `promotionReadiness.currentReleaseKind`
- `promotionReadiness.currentRolloutStage`
- `promotionReadiness.formalOrGaStatus`

This keeps `finalized-release-smoke-report.json` honest about commercial promotion state even when its own top-level `status` is still `passed` because evidence consistency checks succeeded for a canary or other non-GA release shape.

## GPU Variant Model

The native BirdCoder server host is CPU-neutral. GPU-aware delivery stays at the deployment layer instead of pretending there are different server binaries.

Profiles:

- `cpu`
- `nvidia-cuda`
- `amd-rocm`

## Recommended Use

- choose `desktop` for local GUI-first installs
- choose `server` for native service-style deployments on Windows, Linux, or macOS
- choose `container` for Docker-based server environments
- choose `kubernetes` for cluster deployment and ingress-managed environments
- choose `web` when you only need the browser build and docs static bundle

## Release History

- Release entries live under `docs/release/`
- The machine-readable index is `docs/release/releases.json`
- The latest registry entry must also backwrite the packaged promotion summary as `stopShipSignals` plus `promotionReadiness.currentReleaseKind`, `promotionReadiness.currentRolloutStage`, `promotionReadiness.formalOrGaStatus`, and `promotionReadiness.stopShipSignals`
- When `artifacts/release-openapi-canonical` is present, that latest registry entry must stay aligned with the canonical `release-manifest.json` and `finalized-release-smoke-report.json` promotion summary
- The latest registry-backed release note must also echo that same promotion summary explicitly with `Release kind`, `Rollout stage`, `Formal or GA status`, and `Machine stop-ship signals`
- Registry writeback is entry-scoped: rendering one release must not overwrite unrelated release entries or drop top-level registry metadata
- Per-tag release notes are markdown files such as `docs/release/release-2026-04-08-02.md`
