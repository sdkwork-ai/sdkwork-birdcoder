# @sdkwork/birdcoder-backend-sdk

BirdCoder backend SDK family surface.

- API prefix: `/backend/v3/api`
- TypeScript output: `sdkwork-birdcoder-backend-sdk-typescript`
- Rust output: `sdkwork-birdcoder-backend-sdk-rust`
- Standard profile: `sdkwork-v3`

Do not edit generated output by hand. Update `sdks/specs/openapi/birdcoder-backend-v3.openapi.json` or `scripts/generate-birdcoder-sdk-family.mjs`, then run `pnpm generate:sdk:birdcoder`.

Example TypeScript calls:

```ts
client.iam.auditEvents.list();
client.iam.policies.list();
client.iam.teams.list(params);
client.platform.releases.list(params);
```
