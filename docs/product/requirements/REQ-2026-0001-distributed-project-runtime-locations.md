# REQ-2026-0001 Distributed Project Runtime Locations

Status: in-progress
Owner: SDKWork maintainers
Source: customer
Priority: P0
Date: 2026-07-16
Specs: REQUIREMENTS_SPEC.md, ARCHITECTURE_DECISION_SPEC.md, API_SPEC.md, DATABASE_SPEC.md, SDK_SPEC.md, SECURITY_SPEC.md, PRIVACY_SPEC.md, MIGRATION_SPEC.md

## Problem

Importing a desktop project identifies a concrete filesystem root, but the
previous product model treated that root as device-local cache state only.
After restart or when a project is selected through another execution target,
terminal, Git, build, and file workflows could not select one authoritative
project root. A single Project.path field would not solve the problem: one
project can exist on multiple desktops, runners, containers, and
server-owned workspaces.

## Goals

- Persist complete project-root information as server-owned
  ProjectRuntimeLocation records, not as an ambiguous single field on Project.
- Associate every executable location with its project, tenant, organization,
  subject scope, target identity, capability state, verification state, and
  Git snapshot.
- Store each absolute path encrypted at rest. A path is a sensitive input and
  must never appear in generic project data, list responses, logs, traces, or
  telemetry.
- Resolve terminal, Git, build, worktree, and file actions through an explicit
  runtime-location identity and a target-owned canonical-root check.
- Persist an exact terminal-capable runtime-location identity for each new
  coding session so provider turns and native-session discovery never infer a
  root from project state, current preferences, session metadata, or process
  state.
- Keep browser directory handles capability-local. Browser code must never
  fabricate an OS path or register a browser handle as an executable target.

## Non-Goals

- Treating a stored path as permission to execute commands on a desktop,
  server, container, or runner without target authentication, health, and
  capability validation.
- Returning plaintext absolute paths from the app API or generated SDK.
- Storing Git credentials in remote URLs or runtime-location records.
- Reusing studio_project.site_path, coding-session JSON root fields, or Tauri
  KV records as a second authoritative source after cutover.
- Returning provider/native CWD through session APIs or using it as an
  execution authority.
- Enabling a production remote runner before its isolation, scheduling,
  secret-brokering, resource-governance, and recovery requirements are met.

## Acceptance Criteria

1. A project can have multiple runtime locations, each linked to a distinct
   trusted target and location kind.
2. A Tauri import registers its selected absolute root as a write-only,
   authenticated runtime-location input; the server persists encrypted path
   material and returns only safe location metadata.
3. Every public list is server-paginated and returns standard items and page
   information; retrieve, create, and update responses return a single item;
   delete returns 204.
4. Runtime-location responses never contain plaintext absolutePath, cwd,
   rootPath, sitePath, browser handles, credentials, or Git
   credential-bearing URLs.
5. Location create, update, rebind, verification, preference, terminal, Git
   (including worktree), build, and file-system paths verify project ACL,
   target binding, capability, lifecycle state, and canonical root before use.
6. A path rebind is an explicit lifecycle operation that invalidates prior
   verification and Git snapshots; generic update cannot silently change the
   root.
7. A project has subject-and-capability-scoped preferences for terminal, Git,
   build, and file-system actions. Worktree uses Git rather than a separate
   capability. One user's desktop location cannot become another user's default.
8. Existing desktop mount persistence can recover or rebind the local
   location, but a failed local persistence operation is not reported as a
   successful import.
9. The project, runtime-location, Git, SDK, desktop, browser, and operator
   documentation all identify the same authority and lifecycle.
10. New Coding Sessions require and persist an explicit terminal-capable
    runtimeLocationId. Turns, recovery, and native-session list/detail use that
    binding; historic sessions without it remain readable but return typed 503
    unavailable results for execution and native discovery.
11. Coding-session, native-session, terminal replay, and SSE public payloads,
    OpenAPI schemas, and generated SDK models never expose CWD, nativeCwd,
    rootPath, or another path-derived execution field.

## Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Security | Enforce dual-token authentication, object-level authorization, explicit permission codes, write-only path input, encryption at rest, redacted errors and logs, and audit for sensitive lifecycle actions. |
| Privacy | Classify absolute paths and path-derived metadata as sensitive; define storage, masking, retention, export, and deletion behavior. |
| Performance | Push filtering, sorting, and pagination to SQL; use tenant-leading indexes and do not load all project locations into process memory. |
| Reliability | Make registration, verification, backfill, rebind, and Coding Session binding idempotent, observable, resumable, and safe to retry. Do not use project-root, preference, session-CWD, or process-CWD fallback for execution. |
| Compatibility | The application is pre-launch. Remove obsolete public contract behavior directly; retain only documented, bounded data migration and audit history. |

## Affected Surfaces

- Project service and SQLx repository
- Workspace app-api route crate and canonical OpenAPI authority
- Generated BirdCoder app SDK and composed @sdkwork/birdcoder-app-sdk
- PC desktop import, mount recovery, terminal, Git, build, worktree, and file
  service ports
- Browser host adapter behavior
- Server and container target resolver and operations runbooks
- Coding-session service, native-session route, engine-catalog route, and provider execution bridge
- Product, architecture, API, migration, and release documentation

## Traceability

- [ADR-20260716: Distributed project runtime locations](../../architecture/decisions/ADR-20260716-distributed-project-runtime-locations.md)
- [Technical architecture](../../architecture/tech/TECH_ARCHITECTURE.md)
- [Product PRD](../prd/PRD.md)

## Verification

- Runtime-location repository, service, route, OpenAPI, SDK, and desktop
  contract tests
- node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .
- node ../sdkwork-specs/tools/check-api-response-envelope.mjs --workspace .
- node ../sdkwork-specs/tools/check-pagination.mjs --workspace .
- node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
- pnpm generate:sdk:birdcoder
- pnpm db:validate
- pnpm docs:build
