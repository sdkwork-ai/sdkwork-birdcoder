# Backup and Restore

Updated: 2026-07-16
Specs: `DATABASE_FRAMEWORK_SPEC.md`, `DEPLOYMENT_SPEC.md`

## SQLite (standalone single-node profile)

### Backup

```bash
kubectl exec -n <namespace> deploy/sdkwork-birdcoder -- \
  cp /var/lib/sdkwork-birdcoder/data.sqlite3 /tmp/birdcoder-backup.sqlite3
kubectl cp <namespace>/<pod>:/tmp/birdcoder-backup.sqlite3 ./birdcoder-backup-$(date +%Y%m%d).sqlite3
```

Prefer consistent volume snapshots when the storage class supports them.

### Restore

1. Scale the deployment to 0 replicas.
2. Replace PVC data or restore the snapshot into `/var/lib/sdkwork-birdcoder/data.sqlite3`.
3. Scale back to 1 replica.
4. Verify `GET /readyz` returns `"status":"ready"`.
5. Verify a known coding session has monotonic event sequences and a terminal event.

## PostgreSQL (HA profile)

### Backup

```bash
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" \
  > birdcoder-$(date +%Y%m%d).dump
```

When `backup.enabled: true`, `database.engine: postgresql`, and either an
existing runtime Secret or an explicit non-production database URL is present,
the Helm chart renders `templates/backup-cronjob.yaml`. Production config sets
`backup.verifyDatabaseUrlSecretKey` to a key in `auth.existingSecret`; every
dump must restore successfully into that isolated database or the job fails.

The chart PVC is a staging location, not a complete disaster-recovery system.
Copy verified dumps to encrypted, immutable object storage in another failure
domain, enforce retention there, monitor copy failures, and periodically restore
from the off-cluster copy. Public promotion requires measured RPO/RTO evidence.

### Restore

1. Put the API deployment in maintenance mode.
2. Recreate the schema from `database/ddl/baseline/postgres/` only when corruption requires it.
3. Run `pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" <dump>`.
4. Run database bootstrap/migrations when the schema version changed.
5. Run `pnpm release:smoke:postgresql-live` before restoring traffic.
6. Verify coding-session replay from a cursor on both SSE and WebSocket.

## Redis (realtime HA)

Redis holds ephemeral workspace fan-out state only. Canonical coding-session events live in the
application database, so Redis can be rebuilt empty. Session-scoped clients reconnect with
`codingSessionId` and their last applied database sequence, replay the missing range, and then
return to live fan-out. Redis backup is not required for coding-session event correctness.

After rebuilding Redis, verify a session with known traffic over both transports. JSON
`eventId`, `codingSessionEventSequence`, event kind, and payload must match the database and be
identical across SSE and WebSocket. Workspace lifecycle notifications are live-only; reconcile
workspace/project inventory from authenticated list APIs after an outage.

## Release artifact backup

Retain finalized release bundles (`release-manifest.json`, OpenAPI sidecar, and `SHA256SUMS`) per
`RELEASE_SPEC.md` for rollback correlation.
