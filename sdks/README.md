# BirdCoder SDK Workspace

BirdCoder owns one SDK family: `sdkwork-birdcoder-app-sdk`. It is generated from the 39-operation
BirdCoder App API authority at
`sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json`.

| Surface | Owned operations | SDK family |
| --- | ---: | --- |
| App API | 39 | `sdkwork-birdcoder-app-sdk` |
| Backend API | 0 | None |
| Open API | 0 | None |

IAM, Drive, Messaging, Membership, Skills, Agents, Deployments, and other external capabilities are
consumed from their owner SDK families. They are not copied into BirdCoder OpenAPI or generated
transport.

TypeScript consumers import `@sdkwork/birdcoder-app-sdk` through the application-root workspace.
Rust consumers use `sdkwork-birdcoder-app-sdk-rust`. Generated transport is owned by
`@sdkwork/sdk-generator` under each language workspace's `generated/server-openapi` directory.

```powershell
node scripts/sync-birdcoder-sdk-openapi.mjs
pnpm sdk:generate
pnpm check:sdk-family-standard
pnpm check:sdk-family-generated
```

The synchronization and generation commands must be idempotent. PC-local SDK mirrors, BirdCoder
backend SDKs, empty Open API families, duplicate authority files, raw HTTP fallbacks, and manual
edits under generated ownership are forbidden.
