# APIs Directory

## Purpose

Author-owned API contracts and API source inputs for all API kinds, including HTTP OpenAPI surfaces, RPC/proto contracts, async/event API manifests, API examples, API changelogs, and API validation inputs.

BirdCoder materializes HTTP OpenAPI authority under the PC application SDK workspace and exports a unified coding-server snapshot for deployment handoff. This directory records the active authority locations.

## Active HTTP OpenAPI Authority (PC)

| Surface | Authority path |
| --- | --- |
| app-api | `apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json` |
| backend-api | `apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-backend-sdk/openapi/sdkwork-birdcoder-backend-api.openapi.json` |
| derived app input | `apps/sdkwork-birdcoder-pc/sdks/specs/openapi/birdcoder-app-v3.openapi.json` |
| derived backend input | `apps/sdkwork-birdcoder-pc/sdks/specs/openapi/birdcoder-backend-v3.openapi.json` |
| live coding-server export | `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/routeCatalog.ts` |
| deployment handoff | `deployments/server-windows/x64/openapi/coding-server-v1.json` |

BirdCoder does not expose a legacy API-key-authenticated `/api/v1/*` surface. App and backend operations use the canonical SDKWORK dual-token surfaces; API-key authentication is reserved for separately owned protected open-api authorities.

## Project Runtime Location Contract

ProjectRuntimeLocation is an app-api resource owned by the workspace/project
route authority. It persists one target-specific project root and exposes
separate location list, registration, retrieval, update, delete, verification,
and subject-capability preference operations.

- Registration carries an authenticated write-only absolutePath input. The
  control plane encrypts it before persistence.
- Generic Project and runtime-location response DTOs contain only safe
  metadata; they never return plaintext paths, browser handles, secrets, or
  credential-bearing Git URLs.
- A client supplies runtimeLocationId as the opaque selector for a terminal,
  Git, build, worktree, or file capability. Only the authenticated owning
  target resolves the protected root internally.
- OpenAPI/route ownership changes are authored in the canonical route/API
  source and regenerated into all SDK authority and generated-output mirrors.
  Do not hand-edit generated SDK output.

## RPC / Discovery

BirdCoder is HTTP-first. No first-party gRPC/RPC service catalog is published from this repository, so `sdkwork-discovery` registration is not required until RPC services are introduced.

## Shared Utilities

BirdCoder consumes `sdkwork-utils` through:

- TypeScript release/digest helpers via `@sdkwork/utils`
- Rust service validation via `sdkwork-utils-rust`

Verification: `pnpm run check:utils-standard`

## Drive Upload Integration

All attachment uploads route through `@sdkwork/drive-app-sdk` on PC and H5. Server-side multipart upload handlers must use Drive uploader services or approved Rust facades when introduced.

Verification: `pnpm run check:drive-standard`

## Owner

SDKWork Birdcoder team.

## Related Specs

- [API_SPEC.md](../sdkwork-specs/API_SPEC.md)
- [WEB_FRAMEWORK_SPEC.md](../sdkwork-specs/WEB_FRAMEWORK_SPEC.md)
- [APP_COMPOSITION_SPEC.md](../sdkwork-specs/APP_COMPOSITION_SPEC.md)
- [SDK_SPEC.md](../sdkwork-specs/SDK_SPEC.md)
- [SDK_WORKSPACE_GENERATION_SPEC.md](../sdkwork-specs/SDK_WORKSPACE_GENERATION_SPEC.md)
- [WEB_BACKEND_SPEC.md](../sdkwork-specs/WEB_BACKEND_SPEC.md)
- [DRIVE_SPEC.md](../sdkwork-specs/DRIVE_SPEC.md)

## Verification

- [x] API contracts follow OpenAPI 3.1.2 stable profile
- [x] No generated SDK output in `apis/`
- [x] `pnpm run check:web-framework-standard` passes for framework OpenAPI extensions
- [x] `pnpm run check:api-response-envelope` passes for SdkWorkApiResponse / ProblemDetail alignment
- [x] `pnpm run check:app-composition` passes for native composition architecture
- [ ] `node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .` passes after runtime-location routes are materialized
- [ ] `node ../sdkwork-specs/tools/check-pagination.mjs --workspace .` passes after runtime-location list implementation is materialized
