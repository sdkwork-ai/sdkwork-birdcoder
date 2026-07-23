# PLAN-2026-0001 Domain Boundary Cutover

Status: complete
Completed: 2026-07-22
Owner: SDKWork maintainers
Requirement: [REQ-2026-0002](../../product/requirements/REQ-2026-0002-domain-ownership-convergence.md)
Decision: [ADR-20260722](../../architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
Migration: [MIG-2026-0002](../../migrations/MIG-2026-0002-domain-ownership-cutover.md)

## Closed Tracks

| Track | Owner repository | Closure evidence |
| --- | --- | --- |
| Agents authority | `sdkwork-agents` | Session/Turn/SessionItem/Interaction persistence, runtime binding, OpenAPI, generated SDK, SQLite/PostgreSQL and behavior parity gates pass. |
| Skills authority | `sdkwork-skills` | Normalized package/artifact/capability/installation schema, dual-engine repository, API, SDK, and parity gates pass. |
| IM normalization | `sdkwork-im` | Canonical communication tables, no projection authority, one-way Agents dependency, transactional consistency, and API/database gates pass. |
| BirdCoder cutover | `sdkwork-birdcoder` | Dependency SDK/facade consumers replace local authorities; duplicate code and data contracts are deleted; ten-table database and owner-only App API pass. |
| Release closure | all affected repositories | Architecture ownership is closed. Formal production promotion remains independently blocked until signed immutable artifact evidence is present. |

## Sustained Guardrails

- Any future ownership change requires owner behavior parity before the
  consuming capability is removed, and it must not leave a local fallback.
- Do not preserve a local route, DTO, SDK alias, table, or UI service as a
  fallback after its consumer has cut over.
- Do not hand-edit generated SDK output. Change OpenAPI or owner source and
  regenerate.
- Do not introduce projection, dual-write, copied DDL/OpenAPI, raw HTTP,
  manual auth headers, private-source imports, or cross-domain foreign keys.
- Keep active Canon and working documents on the final architecture. Historical
  sequencing belongs only in the migration evidence.
- Run the narrowest owner check after every change, then broaden verification
  only when the changed boundary is stable.

## Completion Review

The final review compares the filesystem, native dependency graphs, database
registries and DDL, route manifests, OpenAPI authorities, generated SDK
manifests, client imports, component specs, Canon docs, migration evidence, and
release gates against `specs/domain-ownership.spec.json`. Any mismatch reopens
the owning track; there is no accepted residual-debt list.
