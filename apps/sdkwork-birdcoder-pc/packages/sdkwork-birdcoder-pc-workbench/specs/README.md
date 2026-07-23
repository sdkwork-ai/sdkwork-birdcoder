# SDKWork BirdCoder PC Workbench Specs

This directory indexes the local contract for `@sdkwork/birdcoder-pc-workbench`.
The machine authority is [component.spec.json](./component.spec.json); global rules
remain in [sdkwork-specs](../../../../../../sdkwork-specs/README.md).

## Owned Boundary

The package owns coding-workbench UI, UI state, terminal presentation, and
bounded device-local workbench settings. It consumes business facts through
injected services and owner-generated SDKs.

## Local Settings

`./storage/localStore` stores only non-sensitive presentation and device settings
such as workbench preferences, bounded run configurations, and recovery UI state.
It does not store IAM credentials, projects, agent sessions, assistant items,
prompts, skills, documents, or any server-owned business record.

## Terminal Governance Diagnostics

Terminal launch preflight keeps at most 100 normalized diagnostics in process
memory. The buffer is cleared whenever the application session changes and is
never written to Web Storage or the native SQLite key-value store. It is a
short-lived troubleshooting surface, not the terminal audit authority; durable
governance records require an owner-defined `sdkwork-terminal` service port.

## Verification

- `pnpm --filter @sdkwork/birdcoder-pc-workbench typecheck`
- `node scripts/local-store-contract.test.ts`
- `node scripts/run-config-contract.test.ts`
- `node scripts/terminal-governance-runtime-contract.test.ts`
- `node scripts/pc-local-business-storage-boundary-contract.test.mjs`
