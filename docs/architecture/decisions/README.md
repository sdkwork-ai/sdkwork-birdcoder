# Architecture Decisions

Status: active
Owner: SDKWork maintainers
Specs: `ARCHITECTURE_DECISION_SPEC.md`, `DOCUMENTATION_SPEC.md`

The current baseline remains in
[TECH_ARCHITECTURE.md](../tech/TECH_ARCHITECTURE.md). Decisions record durable
boundaries without copying generated contracts or global standards.

- [ADR-20260722: Owner-composed stateless workbench](ADR-20260722-domain-ownership-and-single-write-authority.md)
- [ADR-20260727: Owner-composed cross-application Session Activity Inbox](ADR-20260727-cross-application-session-activity-inbox.md)
- [ADR-20260728: Provider-neutral Session transcript](ADR-20260728-provider-neutral-session-transcript.md)
- [ADR-20260730: Hybrid execution ownership and placement boundaries](ADR-20260730-hybrid-execution-boundaries.md) - proposed.

Superseded pre-launch decisions are removed after their valid constraints are
incorporated into the active Canon. Git history remains the audit source.

## Verification

```bash
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
```
