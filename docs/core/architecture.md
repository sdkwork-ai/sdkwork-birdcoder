# Architecture

SDKWork BirdCoder follows the Claw Studio architecture standard at the workspace, host, release, and deployment layers while keeping BirdCoder as a super AI IDE product.

## Layering

- Foundation: `sdkwork-birdcoder-core`, `sdkwork-birdcoder-types`, `sdkwork-birdcoder-i18n`, `sdkwork-birdcoder-codeengine`, `sdkwork-birdcoder-infrastructure`, `sdkwork-birdcoder-ui`, `sdkwork-birdcoder-commons`
- Shell and host boundaries: `sdkwork-birdcoder-shell`, `sdkwork-birdcoder-host-core`, `sdkwork-birdcoder-host-studio`
- Delivery hosts: `sdkwork-birdcoder-web`, `sdkwork-birdcoder-desktop`, `sdkwork-birdcoder-server`
- Delivery and deployment: `sdkwork-birdcoder-distribution`, `deploy/docker`, `deploy/kubernetes`, `scripts/release`, `.github/workflows`

## Product boundary

BirdCoder keeps its AI IDE business modules such as `code`, `studio`, `terminal`, `settings`, `skills`, and `templates`, while identity and membership converge through the split `sdkwork-birdcoder-auth` and `sdkwork-birdcoder-user` packages. The shell consumes those two packages as the only identity surface, and the user package keeps the runtime user-center, validation, storage, and membership contracts aligned with the upstream `sdkwork-appbase` shape. Active release governance now treats that alignment as executable policy through `check:identity-standard`, rather than a docs-only convention.

## Identity standard

BirdCoder treats identity as a three-layer standard instead of a per-app customization:

- Delivery mode: `web`, `desktop`, `server`, `container`, `kubernetes`
- Identity deployment mode: `desktop-local`, `server-private`, `cloud-saas`
- User-center provider mode: `builtin-local`, `external-user-center`, `sdkwork-cloud-app-api`

The important boundary is that deployment and provider selection are allowed to change, but the frontend service contract does not. BirdCoder keeps the same facade routes across all identity modes:

- `/api/app/v1/auth/*`
- `/api/app/v1/user/profile`
- `/api/app/v1/vip/info`

That route invariance is the sample-app standard. The shell and BirdCoder service layer stay branch-free while the server binding decides whether identity is resolved locally, bridged to a third-party external user center, or delegated to `sdkwork-cloud-app-api`.

## Quality gates

- Step 12 now freezes explicit `fast`, `standard`, and `release` quality gates at the workspace root through `check:quality:fast`, `check:quality:standard`, and `check:quality:release`.
- `scripts/quality-gate-matrix-report.mjs` emits `artifacts/quality/quality-gate-matrix-report.json`, so CI and release tier drift becomes machine-verifiable alongside governance and appbase parity across both workflow bindings and root `package.json` quality-tier bindings.
- The same quality report now carries `environmentDiagnostics` and `blockingDiagnosticIds`, which turns host-specific `toolchain-platform` blockers into structured evidence instead of release-note-only narrative.
- `scripts/quality-gate-execution-report.mjs` adds the runtime side of Step 12 by recording the real `fast -> standard -> release` cascade into `artifacts/quality/quality-gate-execution-report.json`.
- Release finalization now republishes the matrix evidence into `quality/quality-gate-matrix-report.json`, optionally archives the runtime report as `quality/quality-gate-execution-report.json`, freezes a normalized `qualityEvidence` summary in `release-manifest.json`, preserves Step 18 `releaseGovernanceCheckIds`, keeps manifest-bound counts beside workflow-bound counts, and lets rendered release notes reuse the same blocker and topology data.

## Canonical docs

- Package topology: [Packages](./packages.md)
- Desktop runtime shape: [Desktop Runtime](./desktop.md)
- Release and deployment: [Release And Deployment](./release-and-deployment.md)
- Full Chinese architecture standards: [架构文档总览](../架构/README.md)
