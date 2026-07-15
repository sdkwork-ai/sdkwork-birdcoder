# Architecture Decisions

Status: active
Owner: SDKWork maintainers
Specs: `ARCHITECTURE_DECISION_SPEC.md`, `DOCUMENTATION_SPEC.md`

Point-in-time decisions that change the BirdCoder baseline are recorded here.
The current baseline remains in
[TECH_ARCHITECTURE.md](../tech/TECH_ARCHITECTURE.md). Decisions explain durable
boundaries; they do not duplicate generated contracts or global standards.

- [ADR-20260713: Unified project/runtime boundary](ADR-20260713-unified-project-runtime-boundary.md)

## Verification

```bash
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
```
