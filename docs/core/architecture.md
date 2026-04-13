# Architecture

SDKWork BirdCoder follows the Claw Studio architecture standard at the workspace, host, release, and deployment layers while keeping BirdCoder as a super AI IDE product.

## Layering

- Foundation: `sdkwork-birdcoder-core`, `sdkwork-birdcoder-types`, `sdkwork-birdcoder-i18n`, `sdkwork-birdcoder-infrastructure`, `sdkwork-birdcoder-ui`, `sdkwork-birdcoder-commons`
- Shell and host boundaries: `sdkwork-birdcoder-shell`, `sdkwork-birdcoder-host-core`, `sdkwork-birdcoder-host-studio`
- Delivery hosts: `sdkwork-birdcoder-web`, `sdkwork-birdcoder-desktop`, `sdkwork-birdcoder-server`
- Delivery and deployment: `sdkwork-birdcoder-distribution`, `deploy/docker`, `deploy/kubernetes`, `scripts/release`, `.github/workflows`

## Product boundary

BirdCoder keeps its AI IDE business modules such as `code`, `studio`, `terminal`, `settings`, `skills`, and `templates`, but identity and membership now converge through `sdkwork-birdcoder-appbase`. The shell consumes one appbase-aligned bridge for `auth`, `user`, and `vip`, and that bridge must remain package-oriented: `catalog`, `registry`, appbase manifest, per-capability workspace manifest, package meta, route intent, and storage contracts stay aligned with the upstream `sdkwork-appbase` shape. Active release governance now treats that alignment as executable policy through `check:appbase-parity`, rather than a docs-only convention.

## Quality gates

- Step 12 now freezes explicit `fast`, `standard`, and `release` quality gates at the workspace root through `check:quality:fast`, `check:quality:standard`, and `check:quality:release`.
- `scripts/quality-gate-matrix-report.mjs` emits `artifacts/quality/quality-gate-matrix-report.json`, so CI and release tier drift becomes machine-verifiable alongside governance and appbase parity.
- The same quality report now carries `environmentDiagnostics` and `blockingDiagnosticIds`, which turns host-specific `toolchain-platform` blockers into structured evidence instead of release-note-only narrative.
- `scripts/quality-gate-execution-report.mjs` adds the runtime side of Step 12 by recording the real `fast -> standard -> release` cascade into `artifacts/quality/quality-gate-execution-report.json`.
- Release finalization now republishes the matrix evidence into `quality/quality-gate-matrix-report.json`, optionally archives the runtime report as `quality/quality-gate-execution-report.json`, freezes a normalized `qualityEvidence` summary in `release-manifest.json`, preserves Step 18 `releaseGovernanceCheckIds`, and lets rendered release notes reuse the same blocker data.

## Canonical docs

- Package topology: [Packages](./packages.md)
- Desktop runtime shape: [Desktop Runtime](./desktop.md)
- Release and deployment: [Release And Deployment](./release-and-deployment.md)
- Full Chinese architecture standards: [架构文档总览](../架构/README.md)
