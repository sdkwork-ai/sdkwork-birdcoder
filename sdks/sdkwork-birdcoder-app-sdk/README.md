# SDKWork BirdCoder App SDK

This is the only BirdCoder-owned HTTP SDK family. Its OpenAPI authority contains 39 App API
operations for system metadata, workspaces, projects, document and sandbox bindings, runtime
locations, and project Git commands.

- Authority: `openapi/sdkwork-birdcoder-app-api.openapi.json`
- sdkgen input: `openapi/sdkwork-birdcoder-app-api.sdkgen.json`
- TypeScript: `sdkwork-birdcoder-app-sdk-typescript`
- Rust generated transport: `sdkwork-birdcoder-app-sdk-rust/generated/server-openapi`
- Generator: `@sdkwork/sdk-generator`
- Standard profile: `sdkwork-v3`

Dependency-owned IAM, Agents, Drive, Messaging, Membership, Skills, Prompts, Documents,
Deployments, and other domain operations are declared as SDK dependencies or composed by
application bootstrap. They do not belong in this authority or its generated transport.

Do not edit `generated/server-openapi`. Update the authority, run
`node scripts/sync-birdcoder-sdk-openapi.mjs`, then run `pnpm sdk:generate` from the application
root.
