# SDKWork BirdCoder PC Infrastructure Specs

This directory indexes the local contract for `@sdkwork/birdcoder-pc-infrastructure`.
The machine authority is [component.spec.json](./component.spec.json); global rules
remain in [sdkwork-specs](../../../../../../sdkwork-specs/README.md).

## Owned Boundary

The package owns PC runtime composition, generated SDK adapters, native host
adapters, and the app-session persistence port binding. It owns no business
database, business table, HTTP API, generated SDK transport, or domain record.

## Dependency Authorities

SDK inventory authority lives in `@sdkwork/birdcoder-pc-core`. Infrastructure
adapters import only its public SDK entrypoints or receive injected clients.

| Capability | Authority |
| --- | --- |
| Coding workbench | `sdkwork-birdcoder` App SDK |
| Agent Session, Turn, and Item | `sdkwork-agents` App SDK |
| AI skill catalog and installation | `sdkwork-skills` App SDK |
| Saved prompts and prompt templates | `sdkwork-prompts` App SDK |
| Project documents | `sdkwork-documents` App SDK |
| Files and media | `sdkwork-drive` App SDK |
| IAM application session | `sdkwork-iam` App SDK and the shared TokenManager |
| Business messages and notifications | `sdkwork-messaging` App SDK |
| Membership state and benefits | `sdkwork-membership` App SDK |
| Commercial orders | `sdkwork-order` App SDK |

`./services/dependencyAppSdkClients` is the runtime-facing factory for
Documents and Prompts. It is a composed port, not a second SDK inventory.

## Connectivity Planes

| Client family | Required connection plane |
| --- | --- |
| BirdCoder App SDK | `application.public-ingress` |
| Agents, Skills, Documents, Prompts, IAM, Drive, Messaging, Membership, Order | `platform.api-gateway` or an explicit owner-specific override |

The two fields are `applicationApiBaseUrl` and
`platformApiGatewayBaseUrl`. Ambiguous `apiBaseUrl` runtime state, local URL
defaults, path stripping, and application-to-platform fallback are retired.
Browser development uses only the controlled `/__sdkwork/platform` proxy;
desktop uses a direct platform URL.

## Persistence Boundary

Desktop IAM session credentials are bound to the Tauri secure-session host port
and stored in the operating-system credential store. This package does not use
SQLite, browser local storage, projection tables, shadow records, or dual-write
for business or IAM session facts.

## Verification

- `pnpm --dir apps/sdkwork-birdcoder-pc typecheck`
- `node scripts/desktop-app-session-persistence-contract.test.mjs`
- `node scripts/pc-local-business-storage-boundary-contract.test.mjs`
