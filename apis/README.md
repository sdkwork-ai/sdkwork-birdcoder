# APIs Directory

## Purpose

Author-owned API contracts and API source inputs for all API kinds, including HTTP OpenAPI surfaces, RPC/proto contracts, async/event API manifests, API examples, API changelogs, and API validation inputs.

BirdCoder currently materializes HTTP OpenAPI authority under the PC application SDK workspace. This directory remains the standard contract root and records the active authority locations until contracts are relocated here.

## Active HTTP OpenAPI Authority (PC)

| Surface | Authority path |
| --- | --- |
| app-api | `apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json` |
| backend-api | `apps/sdkwork-birdcoder-pc/sdks/sdkwork-birdcoder-backend-sdk/openapi/sdkwork-birdcoder-backend-api.openapi.json` |
| derived app input | `apps/sdkwork-birdcoder-pc/sdks/specs/openapi/birdcoder-app-v3.openapi.json` |
| derived backend input | `apps/sdkwork-birdcoder-pc/sdks/specs/openapi/birdcoder-backend-v3.openapi.json` |
| deployment handoff | `deployments/server-windows/x64/openapi/coding-server-v1.json` |

## RPC / Discovery

BirdCoder is HTTP-first today. No first-party gRPC/RPC service catalog is published from this repository, so `sdkwork-discovery` registration is not required until RPC services are introduced.

## Shared Utilities

BirdCoder consumes `sdkwork-utils` through:

- TypeScript release/digest helpers via `@sdkwork/utils-typescript`
- Rust service validation via `sdkwork-utils-rust`

Verification: `pnpm run check:utils-standard`

## Owner

SDKWork Birdcoder team.

## Related Specs

- [API_SPEC.md](../sdkwork-specs/API_SPEC.md)
- [WEB_FRAMEWORK_SPEC.md](../sdkwork-specs/WEB_FRAMEWORK_SPEC.md)
- [SDK_SPEC.md](../sdkwork-specs/SDK_SPEC.md)
- [SDK_WORKSPACE_GENERATION_SPEC.md](../sdkwork-specs/SDK_WORKSPACE_GENERATION_SPEC.md)
- [WEB_BACKEND_SPEC.md](../sdkwork-specs/WEB_BACKEND_SPEC.md)

## Verification

- [ ] API contracts follow OpenAPI 3.1.2 stable profile
- [ ] No generated SDK output in `apis/`
- [ ] `pnpm run check:web-framework-standard` passes for framework OpenAPI extensions
- [ ] API examples are valid and documented
