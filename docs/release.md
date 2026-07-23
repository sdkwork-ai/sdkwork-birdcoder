# Release

Status: active canon pointer  
Updated: 2026-07-22

This file is the repository-level release entrypoint required by SDKWork structure checks. Governed release truth lives in the documents below.

## Authoritative documents

| Topic | Path |
| --- | --- |
| Release and deployment guide | [core/release-and-deployment.md](core/release-and-deployment.md) |
| First governed release checklist | [guides/operator/first-governed-release.md](guides/operator/first-governed-release.md) |
| Operator runbooks | [guides/operator/README.md](guides/operator/README.md) |
| Current pre-launch release state | [release/release-2026-07-22-01.md](release/release-2026-07-22-01.md) |
| Release automation registry | [release/releases.json](release/releases.json) |

BirdCoder remains `DRAFT` / `preLaunch` until `pnpm release:assert-ready` passes on real signed artifacts. Formal release evidence starts in `docs/releases/` only after that gate completes; install packages must remain disabled before promotion.
