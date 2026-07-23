# MIG-2026-0002 Domain Ownership Cutover

Status: completed
Owner: SDKWork maintainers
Requirement: [REQ-2026-0002](../product/requirements/REQ-2026-0002-domain-ownership-convergence.md)
Decision: [ADR-20260722](../architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
Type: mixed
Specs: `MIGRATION_SPEC.md`, `DOMAIN_SPEC.md`, `DATABASE_SPEC.md`, `SCHEMA_REGISTRY_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `SECURITY_SPEC.md`, `DOCUMENTATION_SPEC.md`

```yaml
id: MIG-2026-0002
owner: SDKWork maintainers
status: completed
completed_at: 2026-07-22
requirement: REQ-2026-0002
type: mixed
scope:
  producers:
    - sdkwork-agents
    - sdkwork-skills
    - sdkwork-im
    - sdkwork-birdcoder
  consumers:
    - sdkwork-birdcoder-pc
    - sdkwork-birdcoder-h5
    - sdkwork-birdcoder-flutter-mobile
compatibility_window:
  starts_at: 2026-07-22
  ends_at: 2026-07-22
strategy: no-compatibility-approved
approval: customer-authorized pre-launch direct cleanup on 2026-07-22
rollback:
  supported: true
  steps:
    - Stop release promotion while any ownership or parity gate is red.
    - Apply a forward fix to the owning schema, API, SDK, service, or consumer contract.
    - Reinitialize only disposable pre-launch databases from the corrected owner baselines.
    - Do not restore duplicate tables, compatibility routes, projections, or dual-write.
verification:
  - pnpm check:domain-ownership
  - pnpm db:validate
  - pnpm check:arch
  - pnpm check:api-response-envelope
  - node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .
  - node ../sdkwork-specs/tools/check-route-path-collisions.mjs --workspace .
  - node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root . --strict
  - node ../sdkwork-specs/tools/check-application-layering.mjs --root .
  - node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
  - pnpm docs:build
```

## Executed Cutover

1. The machine ownership contract and canonical terminology were frozen before
   implementation changes.
2. Agents became the sole authority for Project, Session, Turn, Session Item,
   Interaction, runtime binding, artifact, checkpoint, and provider execution
   facts.
3. Skills became the sole authority for skill packages, artifacts,
   capabilities, and installations.
4. Human Conversation, Message, Member, and ReadCursor facts remained in IM;
   AI transcript items remained Agents Session Items. No shared persistence or
   projection was introduced between the domains.
5. BirdCoder PC, H5, Flutter, Rust hosts, and services were switched to owner
   SDK or approved service-port contracts. BirdCoder persists only the stable
   default Agents Project id required by the workbench.
6. Duplicate BirdCoder routes, services, repositories, contracts, transports,
   generated operations, workspace members, and runtime wiring were removed.
7. SQLite and PostgreSQL initialization were rematerialized from the canonical
   10-table BirdCoder contract.
8. The BirdCoder App API and generated SDK were rematerialized with 39 owned
   operations; the zero-operation Backend API and Open API families were
   removed.
9. Migration-only code, stale generated artifacts, positive tests for retired
   ownership, and obsolete active documentation were removed.
10. Repository and cross-repository ownership, database, API, SDK, layering,
    security, pagination, documentation, and release-governance gates were run
    until the direct cutover passed without an allowlist.

## Data Handling

The application is pre-launch, so its checked-in database is an initialization
authority, not a production history to preserve. Test fixtures may be converted
deterministically to owner import inputs when they prove behavior parity. No
runtime dual-write or projection backfill is introduced. Disposable local
databases are recreated only after the corrected baselines and repository tests
pass. Any non-disposable development data must be exported through the owning
domain contract before the old table is removed.

Cross-domain links are stable ids without database foreign keys. BirdCoder
keeps only the Agents Project id, Documents document id, and Sandbox sandbox id
declared in the ownership contract. Owners validate referenced resources through
their public service or SDK boundary when a workflow requires it.

## Completion Evidence

The migration is complete. Forbidden table, route, component, OpenAPI, SDK,
source, and active-document scans are zero; SQLite and PostgreSQL contracts pass;
enabled client surfaces consume owner SDKs; and the BirdCoder App API passes the
SDKWork request context, input/output envelope, pagination, idempotency, and
concurrency rules. No migration exception, compatibility route, projection,
shadow table, or dual-write remains.

Production promotion is a separate release lifecycle. Its only current blocker
is `signed-production-artifact-evidence-missing`; it does not reopen this
completed ownership migration.
