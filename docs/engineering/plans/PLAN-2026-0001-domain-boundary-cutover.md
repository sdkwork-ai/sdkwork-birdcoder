# PLAN-2026-0001 Domain Boundary Cutover

Status: completed
Owner: SDKWork maintainers
Updated: 2026-07-23
Requirement: [REQ-2026-0002](../../product/requirements/REQ-2026-0002-domain-ownership-convergence.md)
Decision: [ADR-20260722](../../architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
Migration: [MIG-2026-0002](../../migrations/MIG-2026-0002-domain-ownership-cutover.md)

## Work Tracks

| Track | Required closure |
| --- | --- |
| Rust ownership | Stateless System assembly; no BirdCoder business database, Project/Workspace service, or business route |
| API, SDK, IAM | 4 App operations, 0 Backend/Open operations, 4 permissions, reproducible generation |
| PC Project and Session | Agents SDK, one `projectId`, Agents runtime bindings, no Workspace authority |
| PC local capability | Allowlisted device state; mount, filesystem, Git, worktree, and terminal remain local |
| Composition | `drive/drive` sandbox; `document/documents` references resolved through the Documents App SDK without a local projection |
| Documentation | Canon, guides, evidence, API/SDK indexes, and PC docs describe only the final boundary |
| Final verification | Rust, PC, API, SDK, IAM, architecture, security, docs, and reverse scans pass |

## Guardrails

- Do not reintroduce a wrapper type or compatibility field to make a consumer
  compile.
- Do not hand-edit generated assembly or SDK output.
- Do not preserve a local route, DTO, service, or store after the owner SDK
  consumer is available.
- Do not use another composition type for documents.
- Do not broaden this plan into H5 or Flutter work.
- Treat a red gate as unfinished work, not as accepted debt.

## Review

Completion is based on current filesystem and test evidence, not task
checklists. Every in-scope track is verified and the final reverse-scan output
is classified.

## Completion Evidence

All tracks were verified on 2026-07-23 for the Rust backend and PC scope. The
canonical state is a stateless BirdCoder server, one allowlisted PC
`device_state_entry` table, a 4/0/0 API split, Agents-owned Project and Session
facts, Skills-owned skill lifecycle, conditional IM consumption for human
messaging only, and owner-SDK composition without projections or compatibility
facades.

The final evidence set includes architecture/server/desktop/API gates,
SDKWORK composition and contract tools, idempotent SDK regeneration, PC UI and
performance contracts, documentation build/governance, technical-debt checks,
and scope-aware reverse scans. H5 and Flutter remain explicitly outside this
plan. Production promotion remains a separate blocked release decision.
