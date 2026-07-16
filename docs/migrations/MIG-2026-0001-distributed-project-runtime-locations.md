# MIG-2026-0001 Distributed Project Runtime Locations

Status: active
Owner: SDKWork maintainers
Requirement: [REQ-2026-0001](../product/requirements/REQ-2026-0001-distributed-project-runtime-locations.md)
Decision: [ADR-20260716](../architecture/decisions/ADR-20260716-distributed-project-runtime-locations.md)
Type: mixed
Specs: `MIGRATION_SPEC.md`, `DATABASE_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `DOCUMENTATION_SPEC.md`

```yaml
id: MIG-2026-0001
owner: SDKWork maintainers
status: active
requirement: REQ-2026-0001
type: mixed
scope:
  producers:
    - sdkwork-birdcoder-project-service
    - sdkwork-birdcoder-workspace-repository-sqlx
    - sdkwork-routes-workspace-app-api
    - sdkwork-birdcoder-coding-sessions-service
    - sdkwork-routes-coding-sessions-app-api
    - sdkwork-routes-engine-catalog-app-api
    - sdkwork-birdcoder-standalone-gateway
    - sdkwork-routes-terminal-app-api
    - sdkwork-birdcoder-pc-server
    - sdkwork-birdcoder-app-sdk
  consumers:
    - sdkwork-birdcoder-pc-commons
    - sdkwork-birdcoder-pc-infrastructure
    - sdkwork-birdcoder-pc-code
    - sdkwork-birdcoder-pc-shell
    - sdkwork-birdcoder-pc-types
    - sdkwork-terminal-pc
compatibility_window:
  starts_at: 2026-07-16
  ends_at: 2026-07-16
strategy: no-compatibility-approved
approval: customer-authorized pre-launch direct cleanup on 2026-07-16
rollback:
  supported: true
  steps:
    - Disable the affected execution action when its target resolver or contract fails verification.
    - Apply a forward fix to the authoritative baseline, route/OpenAPI contract, SDK generation input, and consumer service.
    - For an unlaunched development database only, reinitialize from the corrected baseline after preserving required test evidence; never restore a project-root or process-CWD fallback.
verification:
  - pnpm db:generate:ddl
  - pnpm db:validate
  - pnpm test:migration-replay
  - pnpm generate:openapi:coding-server
  - pnpm generate:sdk:birdcoder
  - node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .
  - node ../sdkwork-specs/tools/check-api-response-envelope.mjs --workspace .
  - node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
  - pnpm docs:build
```

## Scope And Cutover

BirdCoder is pre-launch. This is a direct cleanup of ambiguous project-root
behavior, not an adapter period for a released public contract. The canonical
model is `ProjectRuntimeLocation`: one Project may own zero or more
target-bound locations, each with an encrypted absolute path and an opaque
`runtimeLocationId`. Generic Project data, `studio_project.site_path`, browser
directory handles, local mount records, configured runner roots, session JSON
paths, and process CWD cannot authorize execution.

Terminal, Git, worktree, build, file-system, Coding Session, and provider/native
session operations carry or persist an exact `runtimeLocationId`. A
subject-and-capability preference can assist interactive selection only; the
execution request resolves it to an exact identifier and never asks a server to
infer a project root. A local Tauri action additionally requires the
current-device mounted binding. A server, runner, container, or remote-workspace
action remains unavailable until its mutually authenticated target enrollment
and verification authority exist.

## Data And Contract Steps

1. Fold the runtime-location and Coding Session binding columns, indexes, and
   constraints into the initialization baseline DDL. This repository is in
   database initialization state, so no new incremental `.up.sql` migration is
   introduced for this pre-GA schema cleanup.
2. Regenerate checked-in SQLite and PostgreSQL DDL from the baseline and verify
   that `runtime_location_id` appears once for Coding Sessions and remains
   nullable only to represent historical unbound records.
3. Remove execution reads of project-only roots, `site_path`, session root/CWD
   values, current-subject preferences, configured runner roots, and process
   CWD. Preserve target-private provider CWD only for scoped matching after an
   exact runtime location has been authorized.
4. Require `runtimeLocationId` for new Coding Session creation and persist it
   immutably. Old rows without the value remain readable but turn execution,
   recovery, native-session list, and native-session detail return typed `503`
   unavailable results.
5. Update OpenAPI authorities and regenerate composed BirdCoder and terminal
   SDKs. Public request, response, replay, and SSE models omit absolute paths,
   `cwd`, `nativeCwd`, `workingDirectory`, and equivalent path fields.
6. Reconcile Tauri durable mounts with location identity. A mount is considered
   usable only after durable local binding persistence succeeds; failed recovery
   or rebind fails closed.

## Safety And Privacy

Absolute paths are write-only sensitive inputs, encrypted at rest, and available
only to the authenticated owning target for a validated action. Path fingerprints
are scoped one-way identifiers. Logs, traces, metrics, audit projections,
generic Project data, runtime-location responses, Coding Session data,
native-session data, replay, and SSE never expose plaintext paths, ciphertext,
fingerprints, browser handles, credentials, or credential-bearing Git URLs.

No compatibility reader may reconstruct an execution root from an old field.
Failures are explicit and typed; the supported operational response is repair,
re-registration, verified target enrollment, or a forward fix, not fallback to a
different directory.

## Evidence And Completion Criteria

The migration completes when baseline DDL, OpenAPI authorities, generated SDKs,
route handlers, runtime resolvers, desktop bindings, and documentation agree on
the same identity boundary; focused tests prove location scope/capability checks,
session immutability, legacy fail-closed behavior, path redaction, and no CWD
fallback; and the verification commands in the YAML block pass.
