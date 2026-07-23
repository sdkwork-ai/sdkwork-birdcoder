# @sdkwork/birdcoder-app-sdk

Domain: intelligence
Capability: BirdCoder System metadata
Package type: TypeScript App SDK facade
Status: active

The package exposes the generated four-operation BirdCoder App SDK. It does not
wrap dependency-domain APIs.

## Public API

```ts
import { createClient } from '@sdkwork/birdcoder-app-sdk';

const client = createClient({
  baseUrl: applicationApiBaseUrl,
  tokenManager,
});

const descriptor = await client.system.descriptor.retrieve();
const health = await client.system.health.retrieve();
const routes = await client.system.routes.list();
const runtime = await client.system.runtime.retrieve();
```

Use the platform or owner-specific base URL when constructing Agents, Skills,
IM, IAM, Drive, or Documents clients. Do not route those SDKs through the
BirdCoder application URL as a silent fallback.

## Exports

The facade exports the generated client, System API types, standard transport
types, and authentication integration. Consumers should import this package,
not `generated/server-openapi` internals.

## Verification

```bash
pnpm sdk:generate
pnpm check:sdk-family-generated
pnpm check:api-transport-standard
```
