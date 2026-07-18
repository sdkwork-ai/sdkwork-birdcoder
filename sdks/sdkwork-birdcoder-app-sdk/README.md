# @sdkwork/birdcoder-app-sdk

BirdCoder app SDK family surface.

- API prefix: `/app/v3/api`
- TypeScript output: `sdkwork-birdcoder-app-sdk-typescript`
- Rust output: `sdkwork-birdcoder-app-sdk-rust`
- Standard profile: `sdkwork-v3`

Do not edit generated output by hand. Update `sdks/specs/openapi/birdcoder-app-v3.openapi.json` or `scripts/generate-birdcoder-sdk-family.mjs`, then run `pnpm sdk:generate`.

Example TypeScript calls:

```ts
client.auth.sessions.create(body);
client.auth.sessions.current.retrieve();
client.platform.workspaces.list(params);
client.collaboration.workspaceTeams.list(params);
```
