# MIG-2026-0001 Distributed Project Runtime Locations

Status: active
Owner: SDKWork maintainers
Requirement: [REQ-2026-0001](../product/requirements/REQ-2026-0001-distributed-project-runtime-locations.md)
Decision: [ADR-20260716](../architecture/decisions/ADR-20260716-distributed-project-runtime-locations.md)
Type: database, API, SDK, desktop, and cross-domain contract
Specs: `MIGRATION_SPEC.md`, `DATABASE_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`

```yaml
id: MIG-2026-0001
owner: SDKWork maintainers
status: active
requirement: REQ-2026-0001
strategy: pre-launch-direct-cutover
producers:
  - sdkwork-birdcoder-workspace-service
  - sdkwork-routes-workspace-app-api
  - sdkwork-api-birdcoder-standalone-gateway
  - sdkwork-birdcoder-app-sdk
  - sdkwork-birdcoder-tauri-host
consumers:
  - sdkwork-agents-session-runtime-binding
  - sdkwork-agents-app-sdk
  - sdkwork-birdcoder-pc
  - sdkwork-birdcoder-h5
  - sdkwork-birdcoder-flutter-mobile
rollback:
  strategy: forward-fix-or-reinitialize-unlaunched-database
verification:
  - pnpm db:validate
  - pnpm db:pool:validate
  - pnpm sdk:generate
  - node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .
  - node ../sdkwork-specs/tools/check-api-response-envelope.mjs --workspace .
  - node ../sdkwork-specs/tools/check-pagination.mjs --workspace .
  - node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
  - pnpm docs:build
```

## Cutover

`ProjectRuntimeLocation` is the only BirdCoder authority for a project root on
one trusted execution target. Generic Project metadata, browser handles, local
mount records, configuration, user preferences, session metadata, and process
CWD cannot authorize execution.

BirdCoder and Agents keep independent aggregates connected by a stable ID:

- BirdCoder owns the runtime-location lifecycle, encrypted path, target binding,
  capabilities, preference, Git observation, idempotency, and audit facts.
- Agents owns Session and Session Runtime Binding facts and stores only the
  stable BirdCoder `runtimeLocationId` required for an execution.
- At execution time Agents invokes the authorized BirdCoder runtime-location
  resolver port. It never receives a renderer-supplied root and never stores a
  BirdCoder path copy.

No projection, dual write, shared table, cross-domain foreign key, compatibility
facade, or fallback path is introduced.

## Implementation Steps

1. Keep the runtime-location, preference, idempotency, and audit structures in
   the BirdCoder initialization baseline and exact ten-table registry.
2. Remove `studio_project.site_path` and every project/session/CWD fallback from
   executable flows.
3. Require target identity, tenant and organization scope, project authority,
   lifecycle, health, and capability before path resolution.
4. Wire Agents Session Runtime Binding creation to the stable
   `runtimeLocationId`; provider/model/session identity remains entirely in
   Agents.
5. Keep Tauri mount data as a device-private capability materialization. It may
   resolve the current device's local path only after matching the authorized
   runtime-location identity.
6. Regenerate the BirdCoder and Agents SDK families from their owner OpenAPI
   authorities, then migrate PC, H5, and Flutter consumers.
7. Remove all obsolete local Session, SQL bridge, projection, copied DTO, and
   route artifacts after consumer cutover.

## Security And Privacy

Absolute paths are write-only sensitive inputs, encrypted at rest, and
available only to the authenticated owning target for a validated action. API
responses, SDK models, logs, traces, metrics, errors, audit payloads, Agents
Session records, and IM messages must not expose plaintext paths, ciphertext,
browser handles, credentials, or credential-bearing Git URLs.

## Completion

The migration completes only when database, API, SDK, desktop, cross-domain
binding, path-redaction, target-authorization, documentation, and production
gates pass and all former local Session/root authorities are absent.
