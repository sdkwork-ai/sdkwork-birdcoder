# Incident Response

Updated: 2026-06-24  
Specs: `RELEASE_SPEC.md`, `SECURITY_SPEC.md`

## Severity classes

| Class | Example | Response time |
| --- | --- | --- |
| S1 | API down, data loss risk | Immediate |
| S2 | Auth loop, elevated 5xx | < 30 min |
| S3 | Degraded realtime, single feature | < 4 h |
| S4 | Doc/contract drift | Next release train |

## Triage checklist

1. **Health**: `curl -fsS https://<host>/health`
2. **Metrics**: scrape `/metrics` for error rate and health gauge
3. **Auth**: confirm IAM app API reachable; check for mass 401 without refresh
4. **Database**: SQLite file permissions or PostgreSQL connectivity
5. **HA realtime**: Redis availability when `SDKWORK_BIRDCODER_REALTIME_BACKEND=redis`

## Common scenarios

### Mass 401 / users forced to re-login

- Verify IAM `sessions.refresh` endpoint health.
- Confirm PC client deployed with session refresh loop (`startBirdCoderAppSessionRefreshLoop`).
- Check clock skew on clients and servers (>30s breaks expiry skew).

### WebSocket disconnect storms

- Clients auto-reconnect with backoff (8 attempts default).
- If Redis HA backend fails, bootstrap fails fast — restore Redis before scaling API replicas.

### PostgreSQL failover

1. Drain traffic (scale to 0 or ingress maintenance page).
2. Restore database from latest dump (see [backup-restore.md](backup-restore.md)).
3. Run `pnpm release:smoke:postgresql-live`.
4. Restore traffic gradually; watch 5xx and auth metrics.

### Bad release rollback

```bash
pnpm release:rollback:plan --manifest artifacts/release/<version>/release-manifest.json
```

Execute documented `rollbackCommand` or redeploy previous immutable image digest from release manifest.

## Post-incident

- Update `docs/architecture/tech/TECH-2026-06-24-commercial-readiness-alignment.md` only when readiness truth changes.
- Add contract test if regression was preventable.
- Attach verification commands run during recovery to the incident record.
