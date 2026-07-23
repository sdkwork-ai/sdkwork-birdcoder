# Incident Response

Updated: 2026-07-22
Specs: `RELEASE_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`

## Severity Classes

| Class | Example | Response target |
| --- | --- | --- |
| S1 | Application ingress unavailable, confirmed data loss, tenant-boundary failure, or secret exposure | Immediate |
| S2 | Sustained elevated 5xx, authentication outage, or workbench database unavailable | Less than 30 minutes |
| S3 | One client surface or dependency capability degraded with a safe fallback | Less than 4 hours |
| S4 | Documentation or non-runtime contract drift | Next governed change |

## Triage

1. Check `/healthz` and `/readyz` on the canonical Rust standalone gateway.
2. Correlate `traceId` from the SDKWork response envelope with structured logs.
3. Confirm IAM token refresh and authorization health without logging tokens.
4. Confirm the BirdCoder database pool and the ten-table schema registry.
5. Identify the owning module before inspecting data or applying a mitigation.
6. Preserve logs, metrics, traces, deployment digest, configuration revision,
   and the first failing request as incident evidence.

## Ownership Routing

| Symptom | Owning investigation |
| --- | --- |
| Workspace, project, runtime location, preference, document binding, or sandbox binding | BirdCoder |
| AI Session, Turn, Session Item, interaction, checkpoint, runtime binding, or provider execution | Agents |
| Skill package, artifact, capability, installation, asset, or action | Skills |
| Human conversation, message, member, or read cursor | IM |
| Identity, token, organization, membership, role, or permission | IAM |

Do not query or mutate a BirdCoder shadow table to repair another domain. Use the
owner's authenticated SDK or runbook and keep all tenant and subject scope checks
active during diagnosis.

## Common Scenarios

### Authentication Failures

- Verify IAM health and the configured application identity.
- Check client and server clock skew and the shared global `TokenManager` flow.
- Do not add a temporary manual `Authorization` header or bypass middleware.

### AI Turn Or Transcript Failure

- Correlate the failure with the Agents request and session identifiers.
- Verify the Agents API, outbox/recovery path, and provider binding using the
  Agents runbook.
- Treat BirdCoder as the workbench consumer; it has no local transcript or
  BirdCoder-local AI-session repair store.

### Runtime Location Failure

- Verify workspace/project relation, owner scope, target binding, lifecycle,
  health, and required capability before resolving a target-private path.
- Never accept a renderer-supplied path as execution authority and never emit
  plaintext paths, credentials, or private remote URLs in incident evidence.

### PostgreSQL Failover

1. Enter maintenance mode and stop writes.
2. Restore using [Backup And Restore](backup-restore.md).
3. Run database, API, authorization, and owner-SDK reference probes.
4. Restore traffic gradually while watching 5xx, pool saturation, and dependency
   error rates.

### Bad Release

```bash
pnpm release:rollback:plan --manifest artifacts/release/<version>/release-manifest.json
```

Redeploy only an immutable digest recorded in verified release evidence.

## Post-Incident

- Record timeline, affected tenants, root cause, containment, data impact, and
  exact verification evidence.
- Add the narrowest regression test that would have prevented recurrence.
- Update Canon documentation only when product or architecture truth changed.
