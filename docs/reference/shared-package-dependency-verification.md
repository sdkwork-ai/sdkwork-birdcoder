# Workspace Dependency Verification

This reference describes the current dependency boundary for BirdCoder application surfaces. It does not duplicate package inventories that can be derived from workspace manifests.

## Ownership Model

- Surface-owned packages live under `apps/<application>/packages/` and use explicit package exports.
- Cross-surface BirdCoder contracts live under `apps/sdkwork-birdcoder-common/packages/` when a shared contract is required.
- Platform capabilities remain in their owning sibling repositories and are linked through `pnpm-workspace.yaml`.
- BirdCoder consumes generated or composed owner SDKs. It does not fork platform packages, import generated transport internals, or add raw HTTP wrappers.

## Skills Dependency

Reusable Skills are not a BirdCoder shared package. The only supported TypeScript dependency is the canonical package:

```text
../sdkwork-skills/sdks/sdkwork-skills-app-sdk/sdkwork-skills-app-sdk-typescript
  -> @sdkwork/skills-app-sdk
  -> BirdCoder infrastructure composition
  -> catalog service port
```

The integration uses dual-token authentication through the shared global token manager. Tenant, organization, user, and operator scope are resolved by the Skills service from trusted request context. BirdCoder must not send tenant-selection headers or persist copies of Skill packages, artifacts, capabilities, or installations.

## Verification Sources

- `pnpm-workspace.yaml` is the workspace dependency source.
- `specs/domain-ownership.spec.json` is the domain ownership source.
- `specs/component.spec.json` and module `component.spec.json` files declare required SDK ports.
- SDK family `sdk-manifest.json` files declare owner, API authority, package, and generated-transport policy.
- Package `package.json` files declare actual workspace dependencies and exports.

## Checks

```bash
pnpm install --frozen-lockfile
pnpm check:app-composition
node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
pnpm --dir apps/sdkwork-birdcoder-pc typecheck
pnpm run test:skills-sdk-boundary-contract
```

A verification result is valid only for the exact worktree and lockfile under test. This document intentionally does not preserve old package counts, removed local package names, or unsupported dependency claims.
