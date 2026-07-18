# API Reference

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-16

This page is navigation, not a parallel API contract. The authored OpenAPI
document and composed SDK facade are authoritative for request shapes,
responses, operation IDs, authentication, and errors.

## Contract Authorities

| Need | Authority |
| --- | --- |
| App API source | [BirdCoder app OpenAPI](../../sdks/specs/openapi/birdcoder-app-v3.openapi.json) |
| Generated consumer facade | [@sdkwork/birdcoder-app-sdk](../../sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/index.ts) |
| Session lifecycle and provider boundary | [Engine SDK Integration](engine-sdk-integration.md) |
| Project runtime-location lifecycle and privacy | [Runtime-location operator guide](../guides/operator/project-runtime-locations.md) and [ADR-20260716](../architecture/decisions/ADR-20260716-distributed-project-runtime-locations.md) |
| Root architecture and product scope | [Technical Architecture](../architecture/tech/TECH_ARCHITECTURE.md) and [PRD](../product/prd/PRD.md) |

The OpenAPI source is synchronized into SDK-family inputs and used by the
approved generation flow. Generated SDK artifacts are derived, read-only
output: update the authored route/OpenAPI authority and regenerate instead of
editing generated files or importing a generated transport package directly.

## Consumer Rule

Application code consumes @sdkwork/birdcoder-app-sdk through its composed
facade. API behavior must be checked against the OpenAPI operation and the
generated facade, including the SDKWork success envelope and
application/problem+json errors. Provider-native session behavior is not a
second app API contract; it is described by the session reference above.

## Verification

    pnpm sdk:generate
    pnpm sdk:generate:standard
    node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .
    node ../sdkwork-specs/tools/check-api-response-envelope.mjs --workspace .
    node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
