# API Reference

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-23

This page is navigation. The
[authored OpenAPI](../../sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json)
is the request/response authority.

## BirdCoder-Owned Operations

| Method | Path | Operation ID |
| --- | --- | --- |
| `GET` | `/app/v3/api/system/descriptor` | `descriptor.retrieve` |
| `GET` | `/app/v3/api/system/health` | `health.retrieve` |
| `GET` | `/app/v3/api/system/routes` | `routes.list` |
| `GET` | `/app/v3/api/system/runtime` | `runtime.retrieve` |

BirdCoder owns no Backend API or Open API operation.

## Consumer Rule

PC imports the approved SDK facade and injects its client. Do not call paths
with raw HTTP, assemble authentication headers, parse SDKWork envelopes by
hand, or import generated transport internals.

## Verification

```bash
pnpm api:assembly:validate
pnpm sdk:generate
pnpm check:api-response-envelope
pnpm check:api-transport-standard
```
