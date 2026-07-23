# @sdkwork/birdcoder-app-sdk

TypeScript consumer facade for the BirdCoder-owned App API. The package exposes only the 39
BirdCoder coding-workbench operations under `/app/v3/api`; authentication, agent sessions, skills,
saved prompts, document content, messaging, and membership remain in their owner SDK families.

- Authority: `../openapi/sdkwork-birdcoder-app-api.openapi.json`
- Generated transport: `generated/server-openapi`
- Generator: `@sdkwork/sdk-generator`
- Standard profile: `sdkwork-v3`

Application bootstrap creates this client once, configures the shared token manager, and injects it
into infrastructure services. Feature components do not construct SDK clients or call raw HTTP.

```ts
const workspaces = await client.intelligence.workspaces.list({ page: 1, pageSize: 20 });
const project = await client.intelligence.projects.retrieve(projectId);
await client.intelligence.projects.git.switchBranch(projectId, request);
```

Do not edit `generated/server-openapi`. Change the authority and run `pnpm sdk:generate` from the
application root.
