# Architecture Decisions

Status: active
Owner: SDKWork maintainers
Specs: `ARCHITECTURE_DECISION_SPEC.md`, `DOCUMENTATION_SPEC.md`

The current baseline remains in
[TECH_ARCHITECTURE.md](../tech/TECH_ARCHITECTURE.md). Decisions record durable
boundaries without copying generated contracts or global standards.

- [ADR-20260722: Owner-composed stateless workbench](ADR-20260722-domain-ownership-and-single-write-authority.md)

Superseded pre-launch decisions are removed after their valid constraints are
incorporated into the active Canon. Git history remains the audit source.

## Verification

```bash
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
```
