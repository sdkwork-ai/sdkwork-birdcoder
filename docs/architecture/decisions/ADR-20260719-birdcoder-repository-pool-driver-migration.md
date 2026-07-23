# ADR-20260719: BirdCoder Repository Pool Driver Closure

- Status: accepted
- Owner: sdkwork-birdcoder repository maintainers
- Closed: 2026-07-22
- Canonical standard: `../../../sdkwork-specs/DATABASE_SPEC_PROCESS_SHARED_POOL.md`

## Decision

BirdCoder installs one canonical `DatabasePool` for lifecycle, readiness,
repositories, and shutdown. Repository constructors consume that framework
pool and dispatch to type-safe `PgPool` or `SqlitePool` implementations without
creating a second process pool.

No `AnyPool` compatibility handle, temporary exception flag, split connection
budget, or parallel repository pool is part of the application architecture.
All repository consumers clone the canonical engine-specific pool handle, so
the configured process connection budget remains the single budget.

## Verification

- `pnpm db:pool:validate`
- `rg -n "AnyPool|SDKWORK_DATABASE_TEMPORARY_ANY_POOL_EXCEPTION" crates specs etc`
- Repository driver-parity tests exercise the typed PostgreSQL and SQLite
  implementations.
