# ADR-20260716-distributed-project-runtime-locations

Status: accepted
Owner: SDKWork maintainers
Date: 2026-07-16
Requirement: [REQ-2026-0001: Distributed project runtime locations](../../product/requirements/REQ-2026-0001-distributed-project-runtime-locations.md)
Supersedes: [ADR-20260713: Unified project/runtime boundary](ADR-20260713-unified-project-runtime-boundary.md)
Specs: `ARCHITECTURE_DECISION_SPEC.md`, `DATABASE_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `MIGRATION_SPEC.md`, `DEPLOYMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`

## Context

One BirdCoder project can exist on multiple trusted execution targets. A
desktop checkout, an isolated runner worktree, a container volume, and a
server workspace can each have a different absolute path, Git state, and
capability set. The previous model persisted desktop paths only in a local KV
store and derived server roots from identifiers. It could not authoritatively
answer where a project may run, which path a Git operation targets, or which
location a terminal should use.

## Decision

BirdCoder introduces `ProjectRuntimeLocation` as the authoritative record for
one project root on one trusted execution target. A location is distinct from
the project identity and is scoped by tenant, organization, project, and its
registered runtime node or device.

| Concept | Owner | Meaning |
| --- | --- | --- |
| Project | Project service | Shared project identity, workspace, ACL, and lifecycle. |
| ProjectRuntimeLocation | Project service | A registered project root on one target; it becomes executable only after the owning target verifies it. |
| Runtime node or device | Runtime control plane | The authority that owns, verifies, and executes against a location. |
| Location Git snapshot | Runtime-location projection | Verified repository, branch, commit, worktree, and sanitized remote metadata. |
| Location preference | Project service | Per subject, project, and capability selection for terminal, Git, or build. |

A runtime location records a location kind, runtime target identity, path
flavor, logical root locator, encrypted absolute path, stable path fingerprint,
safe display name, capability availability, health status, verification time,
and audit/version fields. The absolute path is a write-only sensitive
registration input and is never returned from the app API or generated SDK.
Only a target-owned, authenticated runtime resolver may decrypt it for a
validated action. Git remote URLs must be credential-free. Mutable Git state
is verified on the runtime target and is not treated as project-global
metadata.

All terminal, Git (including worktree), build, file-system, and Coding Session
provider operations must resolve an explicit `runtimeLocationId` before using a
filesystem path. The service validates the project ACL, target binding,
capability, health lease, and canonical root on the owning target. A raw request
path is never accepted as an execution parameter.

A Tauri import has a deliberately narrower initial outcome. It registers the
selected absolute path as encrypted server data and retains the returned
opaque `runtimeLocationId` and version in the current-device binding. The
registration begins `pending_verification`; the current standalone gateway
does not treat a renderer or desktop user session as a mutually authenticated
target-verification authority. It therefore cannot advertise capabilities,
write a remote subject preference, decrypt the path for a remote action, or
authorize cross-node execution merely because a desktop registered it.

The same current-device Tauri binding may still support a local terminal. The
native host restores and canonicalizes its own mounted root, then launches the
local terminal with that root. This is a local host capability rather than
server execution authority: it does not reveal a path through the API, does
not make a server/runner action valid, and does not create a default for
another device or user. A future mutually authenticated target adapter must
perform verification first; only then may it publish capability and Git
evidence and an authorized caller may select a remote preference.

Desktop registration retries preserve command idempotency across transient
network failure. The subject-scoped local binding retains an opaque create
generation that contains no path material; it is included in the create
idempotency key. The generation changes only after the desktop has confirmed
that the remote record is absent. That is a new registration intent, not a
retry of the deleted command. The server deliberately retains the old command
reservation rather than allowing a delayed duplicate request to resurrect a
deleted location. Audit history therefore records a delete followed by a new
create, instead of making deletion ambiguous.

The canonical runtime-location capabilities are `terminal`, `git`, `build`,
and `file_system`. Worktree remains a Git operation and snapshot concept; it
does not create a distinct capability or subject preference.

A new logical Coding Session persists its exact terminal-capable
`runtimeLocationId` together with its immutable engine/model pair. Turns,
recovery, and provider-history reconciliation use that stored binding rather
than resolving the caller's mutable terminal preference. Aggregate discovery
for the unified coding-session inventory requires an explicit authorized
runtime location. Legacy sessions that lack a location binding may remain
readable for history, but they are non-executable and provider-history refresh
returns a typed unavailable error.
Provider-reported CWD is target-private matching evidence only; it is neither a
public DTO field nor an execution authority.

## API And Security Rules

- Generic project lists remain path-free.
- Runtime locations are exposed through separately permissioned project
  location resources, but list and detail responses contain only safe labels,
  target identity, lifecycle, capability, and verification metadata.
- Absolute paths are sensitive data. They are encrypted at rest, accepted only
  through the protected registration flow, and decrypted only inside the
  authenticated owning target with audit. No app-api caller receives a path
  reveal.
- Stored absolute paths use an application-approved encrypted-at-rest value;
  fingerprints are one-way normalized identifiers for duplicate detection.
- Registration and retriable lifecycle commands use idempotency keys; mutable
  location state uses documented optimistic version preconditions.
- Location verification is an explicit command and reports capability/health
  status without leaking path values in errors, logs, or telemetry.
- Coding Session, native-session, terminal replay, and SSE projections never
  expose plaintext CWD or a path-derived execution root.

## Migration

`studio_project.site_path` remains a legacy field and is not reused. The
runtime-location table becomes the sole authoritative persisted path source.
Existing Tauri KV mounts are migrated or re-registered as desktop locations.
Server-derived roots are retired as implicit execution sources; they do not
become server-workspace locations until an explicit server-workspace enrollment
aggregate, trusted service identity, and target-to-control-plane verification
adapter exist. Coding-session root metadata and Git worktree paths become
derived snapshots; new sessions persist exact runtime-location bindings, while
historic unbound sessions are read-only and fail closed for execution. Because
BirdCoder is pre-launch, obsolete public path behavior is removed directly. Any
durable backfill is idempotent, observable, verified, and followed by removal
of compatibility reads.

## Consequences

- A project may have many locations without ambiguous global paths.
- A preferred terminal location is per subject and capability, not a global
  desktop preference that could select another user's device.
- A browser directory handle remains non-executable unless a trusted runtime
  target can verify a corresponding location; it never fabricates an OS path.
- A desktop terminal resolves its current-device local binding through
  runtimeLocationId semantics. It never asks the server to reveal a plaintext
  path and never falls back to the process current directory.
- A desktop registration that remains pending is durable location evidence,
  not a remote-execution grant. The local Tauri binding remains usable only on
  the device that owns it until a trusted target-verification path is
  available.
- A configured standalone server workspace is not a server-workspace
  enrollment. Until the enrollment aggregate and trusted source-sync adapter
  exist, server Git, terminal, build, worktree, and file-system actions return
  typed unavailable outcomes rather than deriving a root from configuration or
  a user request.
- The project service gains location repository and resolver ports. UI and SDK
  consumers use semantic location identifiers instead of raw filesystem paths.
- A runtime-location preference can assist a UI selection but must never be
  resolved as a hidden server execution root. Coding Session execution is bound
  to the location persisted at session creation.

## Verification

- Repository tests prove tenant, organization, project, target, and subject
  isolation plus SQL-pushed pagination.
- Service tests prove capability, preference, health, and path-redaction
  decisions.
- API and OpenAPI tests prove standard envelopes, typed errors, pagination,
  idempotency, write-only registration, and no plaintext project-path leakage.
- Coding-session and native-session tests prove exact immutable location
  binding, historic-session fail-closed behavior, and CWD redaction from public
  DTOs, replay, SSE, OpenAPI, and generated SDKs.
- Desktop and runner integration tests prove re-registration, verification,
  target ownership, and deterministic terminal/Git/build location selection.
- Documentation and migration gates prove no active document retains the
  superseded single-root model.
