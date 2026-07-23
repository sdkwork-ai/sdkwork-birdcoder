# Project Runtime Locations

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-16
Specs: DATABASE_SPEC.md, API_SPEC.md, SECURITY_SPEC.md, PRIVACY_SPEC.md, OBSERVABILITY_SPEC.md, MIGRATION_SPEC.md

This runbook governs server-persisted ProjectRuntimeLocation records. It is
the operating contract for target-specific project roots, verification,
preferences, and Git snapshots.

## Data Boundary

A runtime location stores one project root on one registered target. It
contains complete root information in protected storage, including encrypted
absolute path material, target identity, location kind, path flavor, safe
display metadata, capabilities, lifecycle, health, verification state, Git
snapshot, version, and audit data.

Plaintext paths are not support labels. They must not be placed in ticket
titles, logs, traces, metric labels, shell history, screenshots, or generic API
payloads. Operators diagnose locations using projectId, locationId, target
identity, capability, status, verifiedAt, and traceId.

## Lifecycle

| State | Meaning | Allowed action |
| --- | --- | --- |
| Pending verification | A protected path was registered but has not been proven by the owning target. This is the normal initial state for a current standalone Tauri registration. | Rebind, verify, revoke, or delete. No remote execution or remote capability preference. |
| Verified | The owning target proved identity, canonical root, and declared capabilities. | Use only capabilities that remain healthy and authorized. |
| Unavailable or stale | Target, path, or capability cannot currently be validated. | Rebind or repair; fail actions closed. |
| Revoked or deleted | The location is no longer selectable. | Retain only according to audit/retention policy. |

A rebind is a security-relevant lifecycle action. It creates or replaces the
protected root only through the typed rebind workflow, clears prior health and
Git snapshot state, and requires a new target verification. Operators must not
alter path columns manually.

## Registration And Verification

1. Confirm the caller is authenticated and has the required project-location
   permission in the correct tenant and organization.
2. Register the root through the typed write-only API path or trusted target
   channel. The database stores ciphertext and a non-reversible normalized
   fingerprint, not plaintext.
3. Confirm the record begins pending verification and does not advertise
   terminal, Git (including worktree), build, or file-system capability
   prematurely.
4. Have the owning target authenticate, resolve the locationId internally,
   canonicalize its own root, verify containment and policy, and report safe
   capability/health/Git metadata.
5. Audit registration, verification, rebind, preference, revoke, and delete
   with project/location/target identifiers and traceId only.

Never run a server shell command against a path copied from a request, log, or
support ticket. The target resolver is the only execution path.

### Current Tauri Registration Boundary

The current standalone desktop flow persists encrypted path material and the
safe `runtimeLocationId`/version pair, but it does not establish a mutually
authenticated target-verification channel. Treat a newly registered desktop
location as pending even when the same user can immediately use that folder
locally.

- Do not mark the location healthy, submit capability or Git facts, or write a
  terminal, Git, build, or file-system preference from a renderer or desktop
  user session.
- Do not execute, decrypt, or select that pending desktop record from a
  server, container, runner, or another desktop. A stored encrypted path is
  not execution authority.
- The current device may restore its subject-scoped Tauri mount, canonicalize
  its own local root, and start a local terminal. That host-local action must
  use the mounted root directly and must not ask the app API to reveal a path
  or fall back to the process working directory.
- When a mutually authenticated desktop target adapter is introduced, it must
  verify the location before publishing capability and credential-free Git
  metadata. Only an authorized caller may then set a subject/capability
  preference.
- A timeout, unavailable response, or other non-404 transport failure must
  retain the local create generation and retry the same idempotency command.
  It must not create a duplicate remote location.
- After the desktop confirms a remote `404`, it must persist a new opaque
  create generation before issuing another create command. The prior command
  reservation remains intentionally non-replayable after deletion, so a late
  duplicate cannot resurrect the deleted location. Operators should expect a
  delete audit record followed by a distinct create audit record.

### External Execution Boundary

BirdCoder does not provision server workspaces or derive an execution root from
a project id or application configuration. Agents, Kernel, and Providers own
remote execution, target enrollment, source synchronization, and verification.

- Do not register a server location by copying a configured workspace root,
  a request path, or an old project path field into runtime-location storage.
- Do not advertise server Git, terminal, worktree, build, or file-system
  capability, and do not write a preference that points to a server location.
- Server, container, and cloud code actions must use the canonical external
  execution contract. BirdCoder must not add a local runner, fallback facade,
  or parallel target authority.

## Preferences And Selection

Terminal, Git, build, and file-system preferences are scoped to subject,
project, and capability. Worktree actions use the Git preference; worktree is
not a separate preference. A desktop preference must not become another
subject's default. When a preference is invalid, revoked, unavailable, or
lacks the requested capability, the caller must select/rebind a location or
receive a typed unavailable result. Process cwd fallback is prohibited.

A pending standalone desktop registration is not an eligible preference
target. The current device uses its durable local mount plus the safe location
identifier for local work; it must wait for trusted verification before a
remote preference can be created.

BirdCoder configuration cannot create an eligible remote execution target.
Target selection and verification remain inside the owning Agents, Kernel, and
Providers boundary.

## Backup, Restore, And Key Management

- Back up runtime-location records and their audit/lifecycle state with the
  authoritative database.
- Keep encryption key references and key rotation material in the approved
  secret-management boundary. Database backup alone is insufficient to recover
  encrypted path material.
- Before the first encryption-key rotation, set the fingerprint key to the
  original active master-key material so existing and new duplicate-path
  fingerprints remain compatible. Keep that fingerprint key stable afterward.
- Promote a new active master key and key id for writes, move the previous key
  into the decryption-only JSON keyring, and verify old and new locations before
  removing any historical key. The runtime accepts at most 15 historical keys.
- Remove a historical key only after a bounded, audited re-encryption job has
  migrated every record carrying that key id and recovery evidence is retained.
- Restore into a controlled environment, verify target identity and key access,
  then require target re-verification before enabling a location capability.
- Do not back up Browser handles or the local Tauri binding/cache as server
  records. They are target-local capability material and require local
  rebind/recovery. The encrypted server runtime-location record is separate
  from that local binding and remains pending until target verification.

## Monitoring And Incident Handling

Monitor safe counters and events for registration failure, verification
failure, stale target, capability denial, path decryption failure, rebind,
preference conflict, and cross-scope authorization denial. Correlate with
traceId and safe location identifiers.

For a suspected path disclosure or unauthorized target access:

1. Revoke affected locations and disable their preferences.
2. Preserve redacted audit/trace evidence; do not copy plaintext paths into
   the incident record.
3. Rotate relevant encryption keys or target credentials according to the
   approved secret-management process.
4. Re-verify target identity and canonical roots before restoring capability.
5. Record remediation and release evidence before re-enabling affected flows.

## Verification

    pnpm db:validate
    pnpm test:migration-replay
    pnpm check:web-framework-standard
    node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .
    node ../sdkwork-specs/tools/check-api-response-envelope.mjs --workspace .
    node ../sdkwork-specs/tools/check-pagination.mjs --workspace .
    pnpm check:server
