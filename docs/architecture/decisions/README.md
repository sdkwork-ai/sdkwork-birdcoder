# Architecture Decisions

Status: active
Owner: SDKWork maintainers
Specs: `ARCHITECTURE_DECISION_SPEC.md`, `DOCUMENTATION_SPEC.md`

Point-in-time decisions that change the BirdCoder baseline are recorded here.
The current baseline remains in
[TECH_ARCHITECTURE.md](../tech/TECH_ARCHITECTURE.md). Decisions explain durable
boundaries; they do not duplicate generated contracts or global standards.

- [ADR-20260722: Domain ownership and single-write authority](ADR-20260722-domain-ownership-and-single-write-authority.md)
- [ADR-20260716: Distributed project runtime locations](ADR-20260716-distributed-project-runtime-locations.md)
- [ADR-20260713: Unified project/runtime boundary (superseded)](ADR-20260713-unified-project-runtime-boundary.md)

The 2026-07-22 decision is the active cross-domain ownership authority. The
2026-07-16 decision remains the active project-root authority within the
BirdCoder-owned workbench context. The 2026-07-13 decision is superseded
historical context and must not override either active decision.

## Verification

```bash
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
```
