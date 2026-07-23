# @sdkwork/birdcoder-pc-core

Domain: `sdkwork-birdcoder`
Capability: PC application composition
Package type: React/TypeScript core package
Status: active
Owner: `sdkwork-birdcoder`

The machine-readable contract is
[specs/component.spec.json](./specs/component.spec.json). Canonical SDKWork
standards remain under [sdkwork-specs](../../../../../sdkwork-specs/README.md).

## Public API

- `.` exposes the stable PC application core.
- `./sdk` exposes named application SDK factories.
- `./sdk/birdcoder-app` exposes the BirdCoder-owned App SDK.
- `./sdk/agents-app`, `./sdk/documents-app`, `./sdk/drive-app`,
  `./sdk/messaging-app`, `./sdk/prompts-app`, and `./sdk/skills-app` expose
  dependency SDK composition entrypoints.
- `./appSessionTokenManager` exposes the single authenticated-session
  TokenManager boundary.
- `./modules`, `./host`, `./session`, and `./composition` expose registries for
  bootstrap and verification.

## Required SDK Surface

BirdCoder's own App SDK is bound only to `application.public-ingress`. Agents,
Documents, Drive, IAM, Messaging, Membership, Order, Prompts, and Skills remain
owner-generated dependency App SDKs and are bound to `platform.api-gateway` or
an explicit owner-specific override. This package does not copy dependency
operations into the BirdCoder SDK family.

## Configuration

Runtime/bootstrap supplies each resolved SDK base URL and the global
TokenManager when constructing an authenticated client:

```ts
import { createClient } from '@sdkwork/birdcoder-pc-core/sdk/birdcoder-app';

const client = createClient({
  authMode: 'dual-token',
  baseUrl: applicationPublicIngress,
  platform: 'pc',
  tokenManager,
});
```

Feature packages consume these public exports or an injected service port.
They do not read environment variables or construct credentials.

## Deployment Profile And Runtime Target Behavior

Browser and desktop renderers use the same SDK contracts and separate
connection planes. Browser development exposes the platform gateway through
the controlled same-origin `/__sdkwork/platform` proxy. Desktop and release
runtimes receive a direct platform gateway URL. Neither surface falls back to
the BirdCoder application URL.

## Security

Authenticated App SDK clients share one TokenManager for the active session.
The core package stores no secret, assembles no authentication header, and
does not expose backend-admin SDKs.

## Extension Points

Add a dependency SDK by updating this package's dependency, public export, and
`specs/component.spec.json#contracts.sdkDependencies` together. Dependency
operations remain in the owner SDK and generated transport is never edited.

## Verification

- `pnpm --dir apps/sdkwork-birdcoder-pc typecheck`
- `node ../sdkwork-specs/tools/check-frontend-composition.mjs --root .`
- `node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root . --strict`
- `node ../sdkwork-specs/tools/check-composition-resolver.mjs --root .`
