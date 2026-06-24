> Migrated from `docs/core/architecture.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Architecture

SDKWork BirdCoder follows the SDKWork application architecture standard at the workspace, host, release, and deployment layers while keeping BirdCoder as an AI IDE product.

## Layering

- Foundation: `sdkwork-birdcoder-core`, `sdkwork-birdcoder-types`, `sdkwork-birdcoder-i18n`, `sdkwork-birdcoder-codeengine`, `sdkwork-birdcoder-infrastructure`, `sdkwork-birdcoder-ui`, `sdkwork-birdcoder-commons`
- Shell and host boundaries: `sdkwork-birdcoder-shell`, `sdkwork-birdcoder-host-core`, `sdkwork-birdcoder-host-studio`
- Delivery hosts: `sdkwork-birdcoder-web`, `sdkwork-birdcoder-desktop`, `sdkwork-birdcoder-server`
- Delivery and deployment: `sdkwork-birdcoder-distribution`, `deploy/docker`, `deploy/kubernetes`, `scripts/release`, `.github/workflows`

## Product Boundary

BirdCoder keeps AI IDE business modules such as `code`, `studio`, `terminal`, `settings`, `skills`, and `templates` outside the shared IAM boundary. `@sdkwork/birdcoder-auth` owns login-facing route contracts and shared auth UI entrypoints. `@sdkwork/birdcoder-user` owns user-facing profile and VIP membership pages. Both packages consume SDKWork IAM through the generated app SDK and shared runtime boundary; they do not define a second identity system.

Active release governance treats this as executable policy through `check:iam-standard`: source APIs, OpenAPI snapshots, generated SDKs, runtime services, and user-facing packages must stay aligned with SDKWork IAM naming and behavior.

## IAM Standard

BirdCoder treats IAM as a deployment standard, not an app-local customization:

- Delivery mode: `web`, `desktop`, `server`, `container`, `kubernetes`
- IAM deployment mode: `desktop-local`, `server-private`, `cloud-saas`
- Shared app API contract: generated SDK clients over `/app/v3/api`

The important boundary is that deployment selection may change, but the frontend service contract does not. BirdCoder keeps the same facade routes across all IAM modes:

- `/app/v3/api/auth/*`
- `/app/v3/api/iam/users/current`
- `/app/v3/api/memberships/current`
- `/app/v3/api/memberships/package_groups`

That route invariance is the sample-app standard. The shell and BirdCoder service layer stay branch-free while the server binding resolves SDKWork IAM from local, private, or cloud authority according to deployment mode.

## Quality Gates

- Step 12 freezes explicit `fast`, `standard`, and `release` quality gates at the workspace root through `check:quality:fast`, `check:quality:standard`, and `check:quality:release`.
- `scripts/quality-gate-matrix-report.mjs` emits `artifacts/quality/quality-gate-matrix-report.json`, so CI and release tier drift becomes machine-verifiable alongside governance and SDKWork IAM parity across both workflow bindings and root `package.json` quality-tier bindings.
- The same quality report carries `environmentDiagnostics` and `blockingDiagnosticIds`, which turns host-specific `toolchain-platform` blockers into structured evidence instead of release-note-only narrative.
- `scripts/quality-gate-execution-report.mjs` records the real `fast -> standard -> release` cascade into `artifacts/quality/quality-gate-execution-report.json`.
- Release finalization republishes the matrix evidence into `quality/quality-gate-matrix-report.json`, optionally archives the runtime report as `quality/quality-gate-execution-report.json`, freezes a normalized `qualityEvidence` summary in `release-manifest.json`, preserves Step 18 `releaseGovernanceCheckIds`, keeps manifest-bound counts beside workflow-bound counts, and lets rendered release notes reuse the same blocker and topology data.

## Canonical Docs

- Package topology: [Packages](./packages.md)
- Desktop runtime shape: [Desktop Runtime](./desktop.md)
- Release and deployment: [Release And Deployment](./release-and-deployment.md)
- Full Chinese architecture standards: [Architecture Standards](../架构/README.md)

