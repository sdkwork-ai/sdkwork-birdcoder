# Incident Response

Updated: 2026-07-23
Specs: `RELEASE_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`

## Severity Classes

| Class | Example | Response target |
| --- | --- | --- |
| S1 | Application ingress unavailable, tenant-boundary failure, or secret exposure | Immediate |
| S2 | Sustained elevated 5xx, authentication outage, or required owner API unavailable | Less than 30 minutes |
| S3 | One client surface or optional dependency capability degraded | Less than 4 hours |
| S4 | Documentation or non-runtime contract drift | Next governed change |

## Triage

1. Check `/healthz` and `/readyz` on the canonical Rust gateway.
2. Correlate the response `traceId` with structured logs without recording
   tokens, native paths, or business payloads.
3. Confirm IAM token validation and authorization health.
4. Identify the owning module before inspecting data or applying a mitigation.
5. Preserve logs, metrics, traces, deployment digest, topology revision, and
   the first failing request as redacted incident evidence.

## Ownership Routing

| Symptom | Owning investigation |
| --- | --- |
| Project, composition, Session, Turn, Session Item, checkpoint, or runtime binding | Agents |
| Local directory mount, Git, terminal, or worktree | PC/Tauri host |
| Skill package, capability, installation, asset, or action | Skills |
| Human conversation, message, member, or read cursor | IM |
| Identity, token, organization, membership, role, or permission | IAM |
| BirdCoder descriptor, route catalog, runtime description, or gateway ingress | BirdCoder |

Do not create or query a BirdCoder shadow store to repair another domain. Use
the owner's authenticated SDK or runbook and keep tenant and subject checks
active throughout diagnosis.

## Common Scenarios

### Authentication Failure

- Verify IAM health and the configured application identity.
- Check clock skew and the shared global `TokenManager` flow.
- Do not add manual authentication headers or bypass middleware.

### AI Turn Or Transcript Failure

- Correlate the failure with Agents project and Session identifiers.
- Follow the Agents recovery path for Turn and Session Item facts.
- Treat BirdCoder as a workbench consumer; it has no transcript repair store.

### Local Mount Failure

- Confirm the active IAM subject and canonical Agents `projectId`.
- Reauthorize or reselect the directory on the affected device.
- Never send a native path to the server or use a process working-directory
  fallback.

### Bad Release

```bash
pnpm release:rollback:plan --manifest artifacts/release/<version>/release-manifest.json
```

Redeploy only an immutable digest recorded in verified release evidence. The
gateway rollback restores artifact and configuration only; owner-domain data
recovery remains with the owner.

## Post-Incident

- Record the timeline, affected scope, root cause, containment, impact, and
  exact verification evidence.
- Add the narrowest regression test that would have prevented recurrence.
- Update Canon documentation only when product or architecture truth changed.
