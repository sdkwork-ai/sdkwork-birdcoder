# SDKs Directory

## Purpose
SDK family workspaces, SDK generation manifests, authority OpenAPI materialization outputs, derived `sdkgen` inputs, generated SDK language workspaces, and SDK component specs.

## Owner
SDKWork Birdcoder team.

## SDK Families
- `@sdkwork/birdcoder-app-sdk` — Generated app SDK for BirdCoder client-side API consumption
- `@sdkwork/birdcoder-backend-sdk` — Generated backend SDK for BirdCoder server-side API consumption

## Allowed Content
- SDK family directories (e.g., sdkwork-birdcoder-sdk/)
- SDK generation manifests
- OpenAPI materialization outputs
- Derived sdkgen inputs
- Generated SDK language workspaces
- SDK component specs
- Family-root sdk-manifest.json files

## Forbidden Content
- Authored API contracts (belongs in apis/)
- Implementation code
- Runtime secrets or credentials
- Temporary build artifacts

## SDK Standard
All generated SDKs follow the `sdkwork-v3` standard. Authentication uses the canonical `Access-Token` header pattern.

App SDK examples:
```ts
import { createBirdcoderAppSdkClient } from '@sdkwork/birdcoder-app-sdk';
const client = createBirdcoderAppSdkClient({ baseUrl });
await client.auth.sessions.create({ ... });
const teams = await client.collaboration.workspaceTeams.list(params);
const currentUser = await client.iam.users.current.retrieve();
```

Backend SDK examples:
```ts
import { createBirdcoderBackendSdkClient } from '@sdkwork/birdcoder-backend-sdk';
const client = createBirdcoderBackendSdkClient({ baseUrl });
const teams = await client.iam.teams.list(params);
const users = await client.iam.users.list();
const roles = await client.iam.users.roles.list({ userId });
const auditEvents = await client.iam.auditEvents.list();
```

## Related Specs
- [SDK_SPEC.md](../sdkwork-specs/SDK_SPEC.md)
- [SDK_WORKSPACE_GENERATION_SPEC.md](../sdkwork-specs/SDK_WORKSPACE_GENERATION_SPEC.md)
- [API_SPEC.md](../sdkwork-specs/API_SPEC.md)
- [APP_SDK_INTEGRATION_SPEC.md](../sdkwork-specs/APP_SDK_INTEGRATION_SPEC.md)

## Verification
- [ ] SDK families follow SDKWork naming conventions
- [ ] Generated SDK output is properly structured
- [ ] No authored API contracts in sdks/
- [ ] Family-root sdk-manifest.json files are valid

## Notes
API contracts and materialization inputs should be in apis/, while SDK family workspaces and generated SDK output should be in sdks/.
