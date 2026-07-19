# ADR-20260719: Birdcoder Repository Pool Driver Migration

- Status: temporary exception
- Owner: sdkwork-birdcoder repository maintainers
- Removal milestone: before public launch
- Canonical standard: `../../../sdkwork-specs/DATABASE_SPEC_PROCESS_SHARED_POOL.md`

Birdcoder installs one canonical `DatabasePool::Postgres` for lifecycle, IAM, readiness, and shutdown. Existing repository crates accept `sqlx::AnyPool`; while they migrate to `sqlx::PgPool`, the public database framework permits one identity-checked compatibility pool only when `SDKWORK_DATABASE_TEMPORARY_ANY_POOL_EXCEPTION=true` is present.

All repository consumers clone that one compatibility handle. The configured 15-connection process
budget is divided by the database framework: at most 8 connections for the canonical pool and 7 for
the temporary repository pool. The exception cannot enlarge the process budget. This exception is
not single-pool compliance.

The exception is removed when production repositories accept the canonical PostgreSQL pool, the compatibility flag and contract metadata are deleted, and live startup/shutdown evidence shows one process pool.
