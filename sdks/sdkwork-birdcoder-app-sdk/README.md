# sdkwork-birdcoder-app-sdk

Domain: intelligence
Capability: BirdCoder System metadata
Package type: generated App SDK family
Status: active

This is the only BirdCoder-owned HTTP SDK family. Its authored OpenAPI contains
four read-only System operations for descriptor, health, route catalog, and
runtime metadata.

## Authority

- [OpenAPI](openapi/sdkwork-birdcoder-app-api.openapi.json)
- [SDK manifest](sdk-manifest.json)
- [Family component contract](specs/component.spec.json)

Backend API operations: **0**. Open API operations: **0**.

## Language Workspaces

- `sdkwork-birdcoder-app-sdk-typescript/`
- `sdkwork-birdcoder-app-sdk-rust/`

Generated code under each language workspace is derived output. Change the
route/OpenAPI authority and regenerate; do not hand-edit generated files.

## Ownership Boundary

This SDK intentionally contains no Project, Workspace, composition, Session,
runtime-binding, Skill, IM, Git, filesystem, terminal, sandbox, or document
business resource. Consumers use the generated SDK owned by the relevant
module. The BirdCoder gateway composing an owner route does not make that route
part of this SDK.

## Security

Protected operations use the application TokenManager and standard SDKWork
authentication flow. Consumers must not add manual auth headers or bypass the
generated transport.

## Verification

```bash
pnpm sdk:generate
pnpm check:sdk-family-standard
pnpm check:sdk-family-generated
```
