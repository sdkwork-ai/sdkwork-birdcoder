# Incident Response

Updated: 2026-07-16
Specs: `RELEASE_SPEC.md`, `SECURITY_SPEC.md`

## Severity classes

| Class | Example | Response time |
| --- | --- | --- |
| S1 | API down, durable event gap, data-loss risk | Immediate |
| S2 | Auth loop, elevated 5xx, replay unavailable | < 30 min |
| S3 | Degraded realtime fan-out, one transport unavailable | < 4 h |
| S4 | Documentation or contract drift | Next release train |

## Triage checklist

1. **Liveness**: `curl -fsS https://<host>/healthz`
2. **Readiness**: `curl -fsS https://<host>/readyz`
3. **Metrics**: scrape `/metrics` for errors, latency, and health gauges
4. **Auth**: confirm IAM app API health; check for mass 401 without refresh
5. **Database**: verify SQLite permissions or PostgreSQL connectivity
6. **Realtime**: verify Redis when `SDKWORK_BIRDCODER_REALTIME_BACKEND=redis`
7. **Replay**: compare the client cursor with durable coding-session event sequences

## Common scenarios

### Mass 401 or forced re-login

- Verify IAM `sessions.refresh` endpoint health.
- Confirm the PC client deployed with `startBirdCoderAppSessionRefreshLoop`.
- Check client/server clock skew; more than 30 seconds can break expiry handling.

### SSE or WebSocket disconnect storms

- Clients reconnect with exponential backoff (8 attempts by default) and resume the selected
  coding session from its last successfully applied durable sequence.
- Compare SSE and WebSocket failures. A transport-specific spike indicates proxy streaming or
  upgrade configuration; a shared spike indicates gateway, IAM, database, or Redis.
- If Redis HA bootstrap fails, restore Redis before scaling API replicas. Canonical chat events
  remain in the application database.
- After recovery, reconnect an affected session and verify that the first resumed sequence is
  the stored cursor plus one and subsequent sequences are monotonic.
- Treat any durable sequence gap as S1 even if the UI eventually shows a completed response.
- Do not mark a durable turn failed solely because fan-out failed. Restore the hub and replay.

### PostgreSQL failover

1. Drain traffic or enable the ingress maintenance page.
2. Restore the database from the latest dump (see [backup-restore.md](backup-restore.md)).
3. Run `pnpm release:smoke:postgresql-live`.
4. Restore traffic gradually while watching 5xx, auth, fan-out, and replay signals.

### Bad release rollback

```bash
pnpm release:rollback:plan --manifest artifacts/release/<version>/release-manifest.json
```

Execute the documented `rollbackCommand` or redeploy the previous immutable image digest from
the release manifest.

## Post-incident

- Update `docs/architecture/tech/TECH_ARCHITECTURE.md` only when readiness truth changes.
- Add a behavioral regression test when the failure was preventable.
- Attach exact verification commands and important outputs to the incident record.
