# Backup And Restore

Updated: 2026-07-22
Specs: `DATABASE_FRAMEWORK_SPEC.md`, `DEPLOYMENT_SPEC.md`, `SECURITY_SPEC.md`

## Ownership Boundary

BirdCoder backup owns only the ten `studio_*` workbench tables declared in
`database/contract/table-registry.json`. AI sessions and Session Items are
restored by `sdkwork-agents`; Skills and human IM data are restored by
`sdkwork-skills` and `sdkwork-im`. BirdCoder never restores dependency-owned
tables from a local mirror.

Cross-domain identifiers such as `default_agent_project_id`, `document_id`, and
`sandbox_id` have no cross-domain foreign keys. A coordinated restore must
therefore restore each owner to a mutually compatible recovery point and run
explicit reference-integrity probes before reopening writes.

## SQLite Standalone Profile

1. Stop the standalone gateway so the SQLite file has no writers.
2. Snapshot the configured database file and its encryption-key metadata using
   the platform secret backup procedure.
3. Restore the file to the configured location with owner-only filesystem
   permissions.
4. Start one gateway replica and run `pnpm db:validate` and
   `pnpm db:pool:validate`.
5. Verify a known workspace, project, runtime location, preference, document
   binding, and sandbox binding through authenticated App SDK operations.
6. Verify each stable dependency reference against its owner SDK before
   restoring normal traffic.

Do not copy a live SQLite file with active writers. Use a consistent volume
snapshot or stop the gateway first.

## PostgreSQL Profile

Create an encrypted custom-format dump from an authorized maintenance identity:

```bash
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" \
  > birdcoder-$(date +%Y%m%d).dump
```

Store verified dumps in immutable storage in another failure domain. Retention,
RPO, RTO, and restore-test cadence are deployment policy and must have measured
evidence before production promotion.

Restore procedure:

1. Put the application ingress in maintenance mode and stop all writers.
2. Restore into an isolated database first; never test a dump against the live
   production database.
3. Run the canonical database bootstrap/migration flow for the restored schema
   version.
4. Run `pnpm db:validate`, `pnpm db:pool:validate`, and the authorized live
   PostgreSQL smoke check.
5. Verify the ten-table registry exactly and run owner-SDK reference probes.
6. Restore traffic gradually while monitoring database errors, authorization
   failures, and dependency health.

## Cache And Event Infrastructure

Redis, in-memory caches, and UI state are not BirdCoder systems of record and
must be rebuildable from canonical owner APIs. Durable Agents turn/session-item
recovery follows the Agents runbook; IM delivery recovery follows the IM
runbook. Do not describe either as a BirdCoder database replay.

## Release Evidence

Retain the immutable release manifest, checksums, attestations, schema contract,
SDK manifests, and rollback plan together. A restore is incomplete until the
running binary, database contract, and SDK/API versions match that evidence.
