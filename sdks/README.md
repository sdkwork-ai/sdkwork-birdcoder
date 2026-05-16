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

The TypeScript SDK surface is resource-oriented. Examples:

```ts
client.auth.sessions.create(body);
client.auth.sessions.current.retrieve();
client.platform.projects.list(params);
client.intelligence.codingSessions.create(body);
client.iam.users.list(params);
```

Auth tokens are set through generated SDK APIs. Consumers must not assemble `Authorization` or `Sdkwork-Access-Token` headers in UI or service code.

## Commands

```bash
pnpm check:sdk-family-standard
pnpm generate:sdk:birdcoder
pnpm check:sdk-family-generated
```
