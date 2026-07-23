# ADR-20260716 Distributed Project Runtime Locations

Status: accepted
Owner: SDKWork maintainers
Date: 2026-07-16
Requirement: [REQ-2026-0001](../../product/requirements/REQ-2026-0001-distributed-project-runtime-locations.md)
Supersedes: the pre-launch single-root and device-mount-only design
Specs: `ARCHITECTURE_DECISION_SPEC.md`, `DATABASE_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `DEPLOYMENT_SPEC.md`

## Context

A BirdCoder project may exist on several trusted execution targets, each with a
different path, capability set, health state, and Git observation. Project
metadata, a desktop cache, a browser handle, or a derived server root cannot
answer where an operation is authorized to run.

AI Session ownership is independent. Agents owns the Session and provider
execution lifecycle, while BirdCoder owns the workbench project and its runtime
locations. Combining these aggregates or duplicating either side would create a
second authority.

## Decision

BirdCoder owns `ProjectRuntimeLocation`: one registered project root on one
trusted target. A location is scoped by tenant, organization, project, target,
lifecycle, health, capabilities, verification, and version. Its absolute path is
a write-only sensitive input, encrypted at rest, and never returned through the
App API or generated SDK.

| Fact | Owner | Rule |
| --- | --- | --- |
| Project identity and lifecycle | BirdCoder | Path-free workbench aggregate. |
| Project Runtime Location | BirdCoder | Target-scoped encrypted root and capability lifecycle. |
| Location preference | BirdCoder | Subject-and-capability UI selection aid, never implicit execution authority. |
| Device mount | Tauri host adapter | Current-device private capability materialization, not a distributed record. |
| Agent Session and Runtime Binding | Agents | Stores a stable BirdCoder `runtimeLocationId`, not a path or copied location row. |

Every terminal, Git, build, worktree, filesystem, or provider execution resolves
an explicit `runtimeLocationId`. The BirdCoder resolver validates tenant and
organization scope, project authority, target ownership, lifecycle, health,
capability, and canonical root before decrypting a path inside the owning target.
A renderer-supplied path is never execution authority.

Agents creates and owns the immutable Session Runtime Binding. At execution time
it calls the authorized BirdCoder resolver port using the stable ID. BirdCoder
does not create another Session identity, and Agents does not copy location
state. There is no cross-domain foreign key, projection, dual write, or shared
repository.

Tauri registration stores the server-issued `runtimeLocationId` in a private
current-device binding only after durable local persistence succeeds. A local
host may canonicalize and use its own mounted path after identity and scope
match. Registration alone does not grant remote execution; a remote target must
complete its own mutually authenticated enrollment and verification.

The canonical capabilities are `terminal`, `git`, `build`, and `file_system`.
Worktree is a Git operation rather than another capability or preference.

## Security Rules

- Generic project and location responses remain path-free.
- Paths, ciphertext, fingerprints, browser handles, credentials, and private Git
  URLs are excluded from errors, logs, traces, metrics, audit payloads, Agents
  records, and IM messages.
- Registration and lifecycle commands use idempotency; mutable state uses
  optimistic concurrency.
- Rebind invalidates prior verification and Git observations.
- Missing or unhealthy bindings fail with a typed unavailable outcome; no
  project, preference, configuration, provider-CWD, or process-CWD fallback is
  permitted.

## Consequences

- One project can safely span multiple targets without a global path.
- Browser handles remain browser capabilities and cannot masquerade as OS paths.
- Agents can bind execution to a workbench location without owning BirdCoder
  persistence.
- Local and remote execution share identity semantics while keeping host-private
  path material inside the owning target.
- New target kinds extend the resolver/adapter ports without changing Project or
  Session ownership.

## Verification

- Database parity and schema-registry tests prove the exact BirdCoder tables,
  constraints, indexes, and path encryption fields.
- API/SDK tests prove authentication, authorization, envelopes, pagination,
  idempotency, concurrency, path redaction, and generated-client-only use.
- Agents tests prove stable-ID Session Runtime Binding and fail-closed resolver
  behavior.
- Tauri/browser tests prove current-device binding, no path leakage, and no CWD
  fallback.
- Architecture scans prove no copied Session/location table, local SQL bridge,
  projection, raw HTTP consumer, or compatibility facade remains.
