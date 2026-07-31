# @sdkwork/birdcoder-pc-workbench

Coding-workbench UI package for SDKWork BirdCoder. Its machine-readable
integration contract is [specs/component.spec.json](./specs/component.spec.json).

## Public API

The public `exports` map in [package.json](./package.json) exposes workbench UI,
hooks, contexts, terminal surfaces, typed host adapters, narrow bootstrap
message and error-boundary entrypoints, and the bounded `./storage/localStore`
settings port.

## Required SDK Surface

This package does not construct SDK clients. Runtime-provided IDE services expose
BirdCoder workbench, Agents session/item, Skills, Prompts, Documents, and Drive
capabilities through typed ports.

The Agent Turn input queue controller consumes the injected Agents Session
service. Agents is the durable FIFO, claim, lease, fencing, idempotency, and
failure authority; Workbench keeps only a bounded process-memory projection
and scoped invalidation channel.

## Configuration

Workbench preferences and run configurations use versioned device-local keys.
Inputs are normalized and bounded before persistence; unsupported or unsafe JSON
numeric values fail explicitly.

Terminal governance preflight exposes a separate transient diagnostics buffer.
It retains at most 100 normalized records in process memory, clears them on each
application-session change, and never treats renderer storage as an audit system.

## Deployment Profile And Runtime Target Behavior

Browser and Tauri renderers use the same workbench contracts. Browser-compatible
local settings use Web Storage. Native filesystem and terminal behavior remains
behind typed host adapters.

## Security

Local settings contain no token, credential, tenant-owned business record, agent
transcript, prompt body, skill definition, or document content. IAM credentials
are owned by the secure app-session host adapter. Terminal preflight diagnostics
are not persisted and cannot cross application-session boundaries.
Turn input queue content is never stored in local settings. Logout clears its
disposable projection, while deleting durable entries requires an explicit
generated Agents SDK command under the authenticated owner scope.

## Extension Points

New workbench UI may add typed feature state or injected service ports. Server
state and dependency-owned domain facts must be added to the owning API and SDK,
not to local storage.

## Verification

- `pnpm --filter @sdkwork/birdcoder-pc-workbench typecheck`
- `pnpm --filter @sdkwork/birdcoder-pc-workbench test -- agentTurnInputQueue.test.ts agentTurnInputQueueHook.test.tsx`
- `node scripts/local-store-contract.test.ts`
- `node scripts/run-config-contract.test.ts`
- `node scripts/terminal-governance-runtime-contract.test.ts`
- `node scripts/pc-local-business-storage-boundary-contract.test.mjs`
