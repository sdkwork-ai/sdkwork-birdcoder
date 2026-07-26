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

Project-document discovery composes two independent authorities: Agents owns the
enabled project `document` / `documents` slot and Documents owns the referenced
content. BirdCoder stores neither side and does not maintain a projection,
shadow binding, compatibility facade, or dual-write path.

`./services/dependencyAppSdkClients` is the runtime-facing factory for
Documents and Prompts. It is a composed port, not a second SDK inventory.

## Connectivity Planes

| Client family | Required connection plane |
| --- | --- |
| BirdCoder App SDK | `application.public-ingress` |
| Standalone-capable dependency SDKs | `application.public-ingress` through owner `api-assembly` contributions |
| Cloud dependency SDKs | `platform.api-gateway` or an explicit owner-specific override |

The runtime retains `applicationApiBaseUrl` and the cloud-only
`platformApiGatewayBaseUrl` field. In standalone, dependency resolvers select
the application URL because the gateway mounts owner contributions in-process;
there is no internal HTTP forwarding hop. In cloud, dependency resolvers
require the platform URL or an explicit override. Ambiguous `apiBaseUrl` state,
path stripping, and implicit cross-profile fallback are retired.

## Persistence Boundary

Desktop IAM session credentials are bound to the Tauri secure-session host port
and stored in the operating-system credential store. This package does not use
SQLite, browser local storage, projection tables, shadow records, or dual-write
for business or IAM session facts.

## Verification

- `pnpm --dir apps/sdkwork-birdcoder-pc typecheck`
- `node scripts/desktop-app-session-persistence-contract.test.mjs`
- `node scripts/pc-local-business-storage-boundary-contract.test.mjs`
