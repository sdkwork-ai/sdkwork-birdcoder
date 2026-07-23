# REQ-2026-0001 Distributed Project Runtime Locations

Status: accepted
Owner: SDKWork maintainers
Source: customer
Priority: P0
Date: 2026-07-16
Specs: `REQUIREMENTS_SPEC.md`, `API_SPEC.md`, `DATABASE_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `MIGRATION_SPEC.md`

## Problem

One project may exist on multiple desktops, runners, containers, and
server-owned workspaces. A project-level path, local mount, preference, browser
handle, or process CWD cannot identify which trusted target may execute an
operation or which canonical root that target owns.

## Goals

- Persist target-scoped `ProjectRuntimeLocation` records separately from Project
  identity.
- Scope every location by tenant, organization, project, target identity,
  lifecycle, capability, health, verification, and version.
- Encrypt absolute paths at rest and keep them out of general responses, SDK
  models, logs, traces, metrics, and exports.
- Resolve terminal, Git, build, worktree, and filesystem actions through an
  explicit `runtimeLocationId` and a target-owned canonical-root check.
- Require each executable Agents Session to own an immutable Session Runtime
  Binding that references the BirdCoder `runtimeLocationId`.
- Keep browser directory handles and Tauri mounts private to their host adapter.

## Non-Goals

- Treating a stored path as permission to execute without target authentication,
  object authorization, capability, health, and lifecycle validation.
- Returning or logging plaintext paths, ciphertext, credentials, private remote
  URLs, or browser handles.
- Copying runtime-location state into Agents, IM, or a BirdCoder Session table.
- Reconstructing a root from project metadata, current preference, session data,
  configuration, provider CWD, or process CWD.
- Enabling a production remote runner without isolation, scheduling, secret,
  capacity, recovery, and audit evidence.

## Acceptance Criteria

1. A project can own multiple locations linked to distinct trusted targets.
2. Registration accepts a path only as a protected write-only input and returns
   path-free metadata.
3. Lists are SQL-paginated with tenant-leading indexes; resource and command
   responses use canonical SDKWork envelopes and Problem Detail errors.
4. Create, update, verify, rebind, preference, terminal, Git, build, and file
   flows enforce object scope, target binding, lifecycle, health, capability,
   idempotency, and optimistic concurrency as applicable.
5. Rebind invalidates prior verification and Git observations; generic update
   cannot change the root.
6. Preferences are subject and capability scoped and never become hidden
   execution authority.
7. Tauri persists an opaque current-device binding and fails the import if that
   durable binding cannot be written.
8. An Agents Session Runtime Binding stores only the stable
   `runtimeLocationId`; Agents resolves the root through the authorized
   BirdCoder port for every execution and fails closed when unavailable.
9. Browser code never fabricates an OS path or registers a browser handle as an
   executable target.
10. Database, OpenAPI, generated SDKs, consumers, operator docs, and security
    tests identify the same single authority with no projection or fallback.

## Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Security | Dual-token authentication, object authorization, explicit permissions, encryption at rest, write-only paths, redacted failures, and audited lifecycle commands. |
| Privacy | Defined retention, deletion, export, masking, and key-rotation behavior for path material. |
| Performance | SQL-pushed filtering, ordering, and pagination; bounded target probes; no full-table or in-memory owner scans. |
| Reliability | Idempotent registration and commands, optimistic concurrency, explicit fail-closed outcomes, and no root fallback. |
| Architecture | Stable-ID cross-domain reference, no cross-domain foreign key, copied table, projection, raw HTTP consumer, or compatibility facade. |

## Affected Surfaces

- BirdCoder workspace/project service, SQLx repository, App API, OpenAPI, and SDK
- Rust standalone gateway and target-owned runtime resolver
- PC browser/Tauri, H5, and Flutter service adapters
- Agents Session Runtime Binding and provider execution boundary
- Database, API, SDK, security, privacy, operator, and release evidence

## Traceability

- [ADR-20260716](../../architecture/decisions/ADR-20260716-distributed-project-runtime-locations.md)
- [MIG-2026-0001](../../migrations/MIG-2026-0001-distributed-project-runtime-locations.md)
- [Technical architecture](../../architecture/tech/TECH_ARCHITECTURE.md)
- [Product PRD](../prd/PRD.md)

## Verification

- `pnpm db:validate`
- `pnpm db:pool:validate`
- `pnpm sdk:generate`
- `node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .`
- `node ../sdkwork-specs/tools/check-api-response-envelope.mjs --workspace .`
- `node ../sdkwork-specs/tools/check-pagination.mjs --workspace .`
- `node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .`
- `pnpm docs:build`
