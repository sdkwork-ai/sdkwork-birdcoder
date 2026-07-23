# BirdCoder API Inventory

`apis/` indexes authored BirdCoder API contracts. It does not own generated
SDK output or dependency-module routes.

## Backend API

BirdCoder owns **0 Backend API operations**.

## Open API

BirdCoder owns **0 Open API operations**.

## App API

The sole authority is
[`sdkwork-birdcoder-app-api.openapi.json`](../sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json).
It contains exactly four System operations:

| Method | Path | Operation ID | Permission |
| --- | --- | --- | --- |
| `GET` | `/app/v3/api/system/descriptor` | `descriptor.retrieve` | `birdcoder.system-descriptor.read` |
| `GET` | `/app/v3/api/system/health` | `health.retrieve` | `birdcoder.system-health.read` |
| `GET` | `/app/v3/api/system/routes` | `routes.list` | `birdcoder.system-routes.read` |
| `GET` | `/app/v3/api/system/runtime` | `runtime.retrieve` | `birdcoder.system-runtime.read` |

The standalone gateway may compose executable dependency assemblies, but that
does not transfer API ownership. Project, composition, Session, Turn, Session
Item, and Runtime Binding operations remain in the Agents API. Skill operations
remain in Skills. Human messaging remains in IM. Their routes and schemas must
not appear in the BirdCoder OpenAPI or SDK generation input.

## Consumer Boundary

PC code consumes generated owner SDK clients through the application
composition root. It must not call API paths with raw HTTP, assemble
authentication headers, parse envelopes by hand, or maintain local DTO forks.

## Verification

```bash
pnpm api:assembly:validate
pnpm check:api-response-envelope
pnpm check:api-transport-standard
pnpm check:sdk-family-standard
```
