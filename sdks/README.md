# SDKWork BirdCoder SDKs

This directory owns the BirdCoder SDK family. It is governed by the SDKWork root standards and uses `sdkwork-v3` generation rules.

## SDK Surfaces

| Surface | API prefix | Package |
| --- | --- | --- |
| App API | `/app/v3/api` | `@sdkwork/birdcoder-app-sdk` |
| Backend API | `/backend/v3/api` | `@sdkwork/birdcoder-backend-sdk` |

The app SDK is for product clients and app shells. The backend SDK is for operator, admin, and control-plane use. Login and session creation stay in the app API only.

## Source Of Truth

- SDK assembly manifest: [`.sdkwork-assembly.json`](./.sdkwork-assembly.json)
- Component spec: [`specs/component.spec.json`](./specs/component.spec.json)
- App OpenAPI: [`specs/openapi/birdcoder-app-v3.openapi.json`](./specs/openapi/birdcoder-app-v3.openapi.json)
- Backend OpenAPI: [`specs/openapi/birdcoder-backend-v3.openapi.json`](./specs/openapi/birdcoder-backend-v3.openapi.json)

OpenAPI is the source of truth. Generated output must not be edited by hand.

## Generated Client Shape

The TypeScript SDK surface is resource-oriented.

App SDK examples:

```ts
client.auth.sessions.create(body);
client.auth.sessions.current.retrieve();
client.platform.projects.list(params);
client.intelligence.codingSessions.create(body);
client.iam.users.current.retrieve();
client.collaboration.workspaceTeams.list(params);
```

Backend SDK examples:

```ts
client.iam.users.list();
client.iam.users.roles.list({ userId });
client.iam.teams.list(params);
client.iam.teams.members.list({ teamId });
client.iam.policies.list();
client.iam.auditEvents.list();
```

Auth tokens are set through generated SDK APIs. Consumers must not assemble `Authorization` or `Access-Token` headers in UI or service code.

## Commands

```bash
pnpm check:sdk-family-standard
pnpm generate:sdk:birdcoder
pnpm check:sdk-family-generated
```

## SDKWork Documentation Contract

Domain: platform
Capability: sdk
Package type: sdk-family
Status: standardizing

### Public API

Public exports are declared in `specs/component.spec.json` under `contracts.publicExports`.

### Required SDK Surface

- `@sdkwork/birdcoder-app-sdk#createBirdcoderAppSdkClient`
- `@sdkwork/birdcoder-backend-sdk#createBirdcoderBackendSdkClient`
- `sdkwork_birdcoder_app_sdk`
- `sdkwork_birdcoder_backend_sdk`

### Configuration

Configuration keys and runtime entrypoints are declared in `specs/component.spec.json`.

### SaaS/Private/Local Behavior

This module follows the canonical standards linked from `specs/component.spec.json`, including deployment and runtime configuration rules where applicable.

### Security

Do not add secrets, live tokens, manual auth headers, or app-local credential handling to this module.

### Extension Points

Extension points are limited to declared public exports, runtime entrypoints, SDK clients, events, and config keys.

### Verification

- `pnpm check:sdk-family-standard`
- `pnpm generate:sdk:birdcoder`
- `pnpm check:sdk-family-generated`

### Owner And Status

Owner and lifecycle status are tracked in `specs/component.spec.json`.
