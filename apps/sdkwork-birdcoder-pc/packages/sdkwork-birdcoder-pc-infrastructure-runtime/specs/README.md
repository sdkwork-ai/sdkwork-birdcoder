# SDKWork BirdCoder PC Infrastructure Runtime Specs

[component.spec.json](./component.spec.json) is the machine authority for this
package. Global standards remain in
[sdkwork-specs](../../../../../../sdkwork-specs/README.md).

## Owned Boundary

This package owns PC runtime composition only. It invokes the Infrastructure
dependency-client factory and injects the resulting clients into typed service
adapters. It owns no SDK inventory, API, business record, database, generated
transport, token store, or feature state.

## Required Port

`dependencyAppSdkClientFactory` is provided by
`@sdkwork/birdcoder-pc-infrastructure/services/dependencyAppSdkClients`.
Documents and Prompts remain owner-generated SDKs declared by PC core; this
runtime neither imports those packages nor duplicates their component specs.

## Verification

- `pnpm --dir apps/sdkwork-birdcoder-pc typecheck`
- `node scripts/run-local-tsx.mjs scripts/pc-runtime-boundary-ports-contract.test.ts`
- `node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root . --strict`

