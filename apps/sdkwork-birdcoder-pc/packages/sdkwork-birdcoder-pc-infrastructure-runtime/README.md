# @sdkwork/birdcoder-pc-infrastructure-runtime

Domain: `sdkwork-birdcoder`
Capability: PC runtime composition
Package type: TypeScript runtime package
Status: active
Owner: `sdkwork-birdcoder`

The machine contract is
[specs/component.spec.json](./specs/component.spec.json). Canonical standards
remain under [sdkwork-specs](../../../../../sdkwork-specs/README.md).

## Public API

- `./defaultIdeServices` binds the typed dependency-client factory to default
  IDE service adapters.
- `./membershipSdkBootstrap`, `./projectRuntimeLocation`,
  `./driveSandboxExplorer`, and `./runtimeTopology` expose runtime composition
  helpers.

## Required SDK Surface

This package declares no SDK family directly. It requests Documents and
Prompts clients through
`@sdkwork/birdcoder-pc-infrastructure/services/dependencyAppSdkClients`; the PC
core remains the only frontend SDK inventory authority.

## Configuration

Bootstrap supplies the resolved application edge URL and runtime topology.
Tests may inject typed clients; production composition obtains Prompts through
the Infrastructure factory before feature services load. Documents construction
is deferred until the Agents project composition returns a canonical enabled
`document` / `documents` slot.

## Deployment Profile And Runtime Target Behavior

Browser and desktop targets share the same service contracts. The resolved
topology determines cloud or standalone endpoints before the factory creates
clients; this package does not infer deployment URLs.

## Security

No credential is persisted here. The Infrastructure factory binds clients to
the global TokenManager, and this package receives only typed clients and
service ports.

## Extension Points

Extend runtime composition by adding a typed Infrastructure port and declaring
that required port in `specs/component.spec.json`. Do not add generated SDK
packages or a duplicate `sdkDependencies` inventory to this runtime package.

## Verification

- `pnpm --dir apps/sdkwork-birdcoder-pc typecheck`
- `node scripts/run-local-tsx.mjs scripts/pc-runtime-boundary-ports-contract.test.ts`
- `node ../sdkwork-specs/tools/check-frontend-composition.mjs --root .`
- `node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root . --strict`
