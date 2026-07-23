# SDKWork BirdCoder PC Core Specs

[component.spec.json](./component.spec.json) is the machine authority for the
`@sdkwork/birdcoder-pc-core` composition boundary. Global standards remain in
[sdkwork-specs](../../../../../../sdkwork-specs/README.md).

## Owned Boundary

The PC core owns the frontend SDK inventory, stable dependency SDK exports,
session TokenManager boundary, and bootstrap registries. It owns no business
record, database, generated transport, dependency API, or backend-admin SDK.

## SDK Composition

- `sdkwork-birdcoder-app-sdk` is the application-owned App SDK.
- Agents, Documents, Drive, IAM, Messaging, Prompts, and Skills are dependency
  App SDKs resolved through their family manifests.
- `dependencyApiExports` and `dependencyApiSurfaces` remain empty because the
  BirdCoder API does not re-export dependency-owned HTTP operations.
- Permission inheritance is by referenced owner module manifests; no
  dependency permission catalog is copied into this repository.

## Verification

- `pnpm --dir apps/sdkwork-birdcoder-pc typecheck`
- `node ../sdkwork-specs/tools/check-frontend-composition.mjs --root .`
- `node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root . --strict`
- `node ../sdkwork-specs/tools/check-composition-resolver.mjs --root .`

