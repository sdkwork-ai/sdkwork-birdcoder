# Backup and Restore

Updated: 2026-06-24  
Specs: `DATABASE_FRAMEWORK_SPEC.md`, `DEPLOYMENT_SPEC.md`

## SQLite (default K8s profile)

### Backup

```bash
kubectl exec -n <namespace> deploy/sdkwork-birdcoder -- \
  cp /var/lib/sdkwork-birdcoder/data.sqlite3 /tmp/birdcoder-backup.sqlite3
kubectl cp <namespace>/<pod>:/tmp/birdcoder-backup.sqlite3 ./birdcoder-backup-$(date +%Y%m%d).sqlite3
```

Prefer volume snapshots when your storage class supports consistent PVC snapshots.

### Restore

1. Scale deployment to 0 replicas.
2. Replace PVC data or restore snapshot into `/var/lib/sdkwork-birdcoder/data.sqlite3`.
3. Scale back to 1 replica.
4. Verify `GET /health` returns `"status":"healthy"`.

## PostgreSQL (HA profile)

### Backup (manual)

```bash
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" \
  > birdcoder-$(date +%Y%m%d).dump
```

### Backup (Helm CronJob)

When `backup.enabled: true` and `database.engine: postgresql`, the chart renders `templates/backup-cronjob.yaml`. Configure:

```yaml
backup:
  enabled: true
  schedule: "0 3 * * *"
  retentionDays: 14
database:
  engine: postgresql
  url: postgres://birdcoder:SECRET@postgresql:5432/birdcoder
```

Dump files land in the configured PVC or object storage hook (operator must mount writable storage at `/backup`).

### Restore

1. Put API deployment in maintenance (scale to 0 or ingress drain).
2. Drop and recreate database schema from `database/ddl/baseline/postgres/` if corruption is suspected.
3. Restore dump:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" birdcoder-YYYYMMDD.dump
```

4. Run database lifecycle bootstrap/migrations if schema version drifted.
5. Run `pnpm release:smoke:postgresql-live` before traffic restore.

## Redis (realtime HA)

Redis holds ephemeral workspace fan-out state only. Rebuild empty on loss; clients reconnect with exponential backoff. No backup required for correctness of persisted product data.

## Release artifact backup

Retain finalized release bundles (`release-manifest.json`, OpenAPI sidecar, SHA256SUMS) per `RELEASE_SPEC.md` for rollback correlation.
