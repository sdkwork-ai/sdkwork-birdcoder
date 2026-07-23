# Architecture Decisions

Status: active
Owner: SDKWork maintainers
Specs: `ARCHITECTURE_DECISION_SPEC.md`, `DOCUMENTATION_SPEC.md`

The current baseline remains in
[TECH_ARCHITECTURE.md](../tech/TECH_ARCHITECTURE.md). Decisions record durable
boundaries without copying generated contracts or global standards.

- [ADR-20260722: Domain ownership and single-write authority](ADR-20260722-domain-ownership-and-single-write-authority.md)
- [ADR-20260716: Distributed project runtime locations](ADR-20260716-distributed-project-runtime-locations.md)
- [ADR-20260719: Repository pool driver closure](ADR-20260719-birdcoder-repository-pool-driver-migration.md)

Superseded pre-launch decisions are removed after their valid constraints are
incorporated into the active Canon.

## Verification

```bash
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
```
