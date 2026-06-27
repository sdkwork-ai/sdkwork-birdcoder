# BIRDCODER Database Module

Canonical lifecycle assets for `sdkwork-birdcoder` per `DATABASE_FRAMEWORK_SPEC.md`.

- moduleId: `birdcoder`
- serviceCode: `BIRDCODER`
- tablePrefixes: `ai_`, `commerce_`, `ops_`, `runtime_`, `studio_` (authoritative source: `contract/prefix-registry.json`)

## Commands

```bash
pnpm run db:validate
pnpm run db:plan
pnpm run db:init
pnpm run db:migrate
pnpm run db:seed
pnpm run db:status
pnpm run db:drift:check
```

## Migration status

| Migration | Engine | Purpose |
| --- | --- | --- |
| 0001_birdcoder_legacy_baseline | both | Initial baseline schema with tenant isolation |
| 0003_commerce_extension | both | Commerce tables (api_keys, usage, notifications, membership) |
| 0004_indexes | postgres | Critical query indexes across ai_/studio_/ops_ domains |
| 0005_foreign_keys | both | Foreign key constraints for data integrity |
| 0006_subject_id_not_null | both | Enforce NOT NULL on user_id columns per SUBJECT_ID_SPEC |
| 0007_foreign_key_indexes | both | Foreign key column indexes for runtime_id, turn_id joins |

Runtime services MUST create pools through `sdkwork-database-sqlx` and register `DefaultDatabaseModule` at bootstrap.
