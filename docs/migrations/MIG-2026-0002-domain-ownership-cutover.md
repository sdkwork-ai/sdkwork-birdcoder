# MIG-2026-0002 Direct Domain Ownership Cutover

Status: in-progress
Owner: SDKWork maintainers
Updated: 2026-07-23
Requirement: [REQ-2026-0002](../product/requirements/REQ-2026-0002-domain-ownership-convergence.md)
Decision: [ADR-20260722](../architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
Type: pre-launch contract and code replacement
Specs: MIGRATION_SPEC.md, DOMAIN_SPEC.md, API_SPEC.md, SDK_SPEC.md, DATABASE_SPEC.md, DOCUMENTATION_SPEC.md

## Scope

This cutover covers the BirdCoder Rust backend and PC browser/Tauri
application. H5 and Flutter are explicitly outside the current implementation
and verification scope.

The repository is pre-launch. There is no production data to backfill and no
compatibility window. The migration replaces obsolete authorities directly
and deletes their contracts and code.

## Final State

- BirdCoder server business tables: 0
- BirdCoder App API operations: 4 System reads
- BirdCoder Backend API operations: 0
- BirdCoder Open API operations: 0
- BirdCoder IAM permissions: 4 System reads
- Project, composition, Session, Turn, Session Item, Interaction, Runtime
  Binding, Artifact, and Checkpoint: Agents
- Skill lifecycle: Skills
- Human communication: IM
- PC local directory and execution capabilities: PC/Tauri

## Cutover Sequence

1. Freeze machine ownership and dependency contracts.
2. Delete BirdCoder server DDL, migration, repository, Project/Workspace
   services, routes, and database host.
3. Reduce the BirdCoder OpenAPI, SDK metadata, and IAM catalog to the four
   System reads; regenerate derived sources.
4. Replace PC Project and Session integration with canonical Agents SDK
   resources and one `projectId`.
5. Bind local Session execution context through Agents
   `sessionRuntimeBindings`.
6. Keep device mounts and native execution inside PC/Tauri; constrain local
   SQLite to the device-state allowlist.
7. Use Agents `drive/drive` for sandbox composition and fail closed for
   documents until `document/documents` exists upstream.
8. Remove obsolete tests, scripts, documentation, and generated artifacts.
9. Run Rust, PC, API, SDK, IAM, architecture, security, docs, and reverse-scan
   gates.

## Data Handling

No BirdCoder business data migration or projection is performed. Disposable
pre-launch local databases from the retired server design are not an input to
the new architecture.

Tauri device state is retained only when it passes the current scope/key
allowlist. Project mounts are re-keyed to the canonical Agents `projectId`.
Missing or ambiguous device state is discarded or re-established through
explicit user folder selection; it is never uploaded as server data.

## Rollback

Rollback means stopping promotion and applying a forward fix to the owning
contract or consumer. It does not restore retired tables, routes, aliases,
facades, id mappings, or dual writes. Because no production release exists,
reverting to the obsolete architecture is not supported.

## Completion Criteria

The record moves to `completed` only after:

- all Rust and PC implementation gates pass;
- API assembly and SDK regeneration are reproducible;
- owner counts and permissions match every machine contract;
- authored runtime and documentation scans contain no active obsolete
  authority;
- release and operations docs describe the stateless gateway and local PC
  capability boundary;
- no unresolved technical-debt allowlist remains.

Production publication is a separate release decision and cannot be inferred
from migration completion.
