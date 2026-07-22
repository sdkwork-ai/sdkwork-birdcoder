# MIG-2026-0002 Domain Ownership Cutover

Status: active
Owner: SDKWork maintainers
Requirement: [REQ-2026-0002](../product/requirements/REQ-2026-0002-domain-ownership-convergence.md)
Decision: [ADR-20260722](../architecture/decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
Type: mixed
Specs: `MIGRATION_SPEC.md`, `DOMAIN_SPEC.md`, `DATABASE_SPEC.md`, `SCHEMA_REGISTRY_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `SECURITY_SPEC.md`, `DOCUMENTATION_SPEC.md`

```yaml
id: MIG-2026-0002
owner: SDKWork maintainers
status: active
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

## Cutover Order

1. Freeze the machine ownership contract and canonical terminology. Mark all
   duplicate BirdCoder tables, routes, crates, SDK operations, and active docs
   as release blockers rather than compatibility surfaces.
2. Complete Agents Session/Turn/SessionItem/Interaction behavior parity,
   including runtime-location binding, native provider identity, fork lineage,
   durable idempotent turns, leases, artifacts, checkpoints, approvals,
   questions, replayable outcomes, SQLite/PostgreSQL persistence, OpenAPI, and
   generated SDKs.
3. Complete Skills package/artifact/capability/installation normalization and
   SQLite/PostgreSQL runtime parity. Remove JSON capability/category authority.
4. Normalize IM canonical conversation/message/member/read-cursor persistence,
   remove projection/projector authorities, and prove the one-way IM-to-Agents
   dependency.
5. Change BirdCoder PC, H5, Flutter, Rust hosts, and services to consume the
   owner SDK/facade contracts. Store only the default Agents Project id on a
   BirdCoder project.
6. Remove BirdCoder duplicate route, service, repository, contract, and UI
   transport packages. Remove their Cargo/pnpm members and runtime wiring.
7. Rebuild the BirdCoder database initialization baseline with only the ten
   owned tables. Materialize registries and generated DDL from that authority.
8. Materialize owner-only BirdCoder App API and SDK. Delete BirdCoder Backend
   and Open API families when their owned operation count is zero.
9. Remove stale generated artifacts, tests that enforce retired ownership,
   migration-only code, and current documentation. Preserve only governed
   historical evidence in the archive when it remains useful.
10. Run all owner repositories' narrow gates, then cross-repository architecture,
    security, performance, migration, documentation, and release gates. Repeat
    repair and verification until all gates pass.

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

## Completion Criteria

The migration is complete only when all forbidden table, route, component,
OpenAPI, SDK, source, and active-document scans are zero; both database engines
and all enabled client surfaces pass; owner APIs use SDKWork input/output,
security, pagination, idempotency, and concurrency contracts; and release
promotion needs no debt allowlist or migration exception.

