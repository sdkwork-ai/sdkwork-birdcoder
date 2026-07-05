# Release

Status: active canon pointer  
Updated: 2026-07-04

This file is the repository-level release entrypoint required by SDKWork structure checks. Governed release truth lives in the documents below.

## Authoritative documents

| Topic | Path |
| --- | --- |
| Release and deployment guide | [core/release-and-deployment.md](core/release-and-deployment.md) |
| First governed release checklist | [guides/operator/first-governed-release.md](guides/operator/first-governed-release.md) |
| Operator runbooks | [guides/operator/README.md](guides/operator/README.md) |
| Commercial readiness snapshot | [architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md](architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md) |
| Release history registry | [release/](release/) |

BirdCoder remains `DRAFT` / `preLaunch` until `pnpm release:assert-ready` passes on real signed artifacts. Do not enable install packages before that gate completes.
