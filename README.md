# SDKWork BirdCoder

repository-kind: application

`sdkwork-birdcoder` is the SDKWork coding workbench application. The current
architecture work is scoped to the Rust backend and PC browser/Tauri surfaces.
H5 and Flutter remain declared application roots, but they are not part of this
cutover or its verification evidence.

BirdCoder is pre-launch. Domain changes therefore use one direct cutover with
no data projection, shadow table, synchronized copy, dual write, alias,
compatibility facade, or second identifier system.

## Current Ownership

BirdCoder is a stateless application-composition host. It owns only its
descriptor, health, route catalog, and runtime metadata. Reusable business
facts remain with their domain owners:

| Owner | Canonical facts |
| --- | --- |
| `sdkwork-agents` | Workspace, Agent Project, composition slot, Session, Turn, Session Item, Interaction, Runtime Binding, Artifact, and Checkpoint |
| `sdkwork-skills` | Skill package, version, artifact, capability, and installation |
| `sdkwork-im` | Human Conversation, Message, Member, and ReadCursor |
| `sdkwork-iam` | Authentication, organization scope, membership, role, permission, and audit |
| `sdkwork-drive` | Drive and sandbox storage |
| `sdkwork-documents` | Document identity and content |

Workspace and Project are canonical `sdkwork-agents` aggregates. Every user has
an idempotently initialized default Workspace, and every Project belongs to one
Workspace. BirdCoder consumes both through the generated Agents App SDK and
keeps only the current Workspace/Project selection as UI session state; it has
no BirdCoder-owned Workspace/Project service, persistence, id mapping, or
compatibility layer. The Header can create and rename Workspaces and can archive
or delete empty non-default Workspaces; the default Workspace is protected by
Agents.

AI assistant content is an Agents Session Item stream. IM messaging is human
or channel communication. The two models may carry stable correlation
identifiers, but neither is a persisted copy of the other. See
[the Session Item UI contract](specs/agent-session-item-view.spec.md).

## Database Design

BirdCoder owns zero server business tables and has no server database,
migration, seed, schema, backup, or restore lifecycle.

The Tauri host has one local SQLite table, `device_state_entry`, for
host-private device state only. Its allowlist is limited to application
settings, canonical-project device mounts, and the desktop runtime-location
installation identity. `ProjectDeviceMountRegistry` is keyed by the Agents
`projectId`. Native paths, Git processes, worktrees, and terminal handles stay
inside the PC/Tauri boundary and are never BirdCoder server records.

## API And Permissions

BirdCoder owns four App API operations:

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/app/v3/api/system/descriptor` | `birdcoder.system-descriptor.read` |
| `GET` | `/app/v3/api/system/health` | `birdcoder.system-health.read` |
| `GET` | `/app/v3/api/system/routes` | `birdcoder.system-routes.read` |
| `GET` | `/app/v3/api/system/runtime` | `birdcoder.system-runtime.read` |

Backend API operations: **0**. Open API operations: **0**. The authored
authority is
[the BirdCoder App OpenAPI](sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json).
Workspace, Project, composition, Session, Skill, IAM, Drive, and Document operations are
consumed from their owner SDK families and are not copied into BirdCoder. Human
Conversation and Message facts remain owned by IM; BirdCoder consumes the IM
SDK only when an independent human messaging feature is enabled.

## PC Runtime Boundary

PC feature packages receive generated owner SDK clients or typed ports from
the composition root. They do not issue raw HTTP, add manual authentication
headers, fork DTOs, or import generated transport internals.

- Workspace, Project, and Session workflows use `@sdkwork/agents-app-sdk`.
- The Header selects a Workspace first and lists only that Workspace's Projects.
- Drive sandbox import uses the Agents Project import command with the selected
  `workspaceId`; local directory paths and handles remain device-local.
- A Session uses the same canonical `projectId`, then records its opaque
  runtime location through Agents `sessionRuntimeBindings`.
- Sandbox composition uses the Agents `drive/drive` composition slot.
- Document composition uses the Agents `document/documents` composition slot
  and resolves document content through `@sdkwork/documents-app-sdk`.
- Local filesystem, Git, worktree, and terminal operations use PC/Tauri host
  adapters and an authorized device mount.

## Repository Layout

| Path | Purpose |
| --- | --- |
| [`apps/`](apps/README.md) | Application surface roots; the current cutover covers PC only |
| `crates/` | Stateless Rust assembly, gateway, System routes, and Tauri host adapters |
| [`apis/`](apis/README.md) | Authored API authority index |
| [`sdks/`](sdks/README.md) | BirdCoder System-only SDK family and generated outputs |
| [`specs/`](specs/README.md) | Application machine contracts and human index |
| [`docs/`](docs/README.md) | Product, architecture, operations, and evidence |
| `etc/` | Source-controlled safe runtime profiles |
| `scripts/` | Generation and verification entrypoints |

There is intentionally no `database/` directory. Shared SDKWork packages are
sibling workspace dependencies resolved through native package manifests, not
copied source.

## Development And Verification

```bash
pnpm install --frozen-lockfile
pnpm dev:desktop
pnpm dev:browser:standalone
pnpm build:server

pnpm check:domain-ownership
pnpm check:agents-birdcoder-alignment
pnpm check:api-transport-standard
pnpm check:desktop
pnpm check:server
pnpm typecheck
pnpm lint
pnpm docs:build
```

Run the narrowest check for the changed boundary first. Global standards live
in [`../sdkwork-specs/`](../sdkwork-specs/README.md); this repository links
them instead of copying their normative text.

## Documentation

- [Documentation index](docs/README.md)
- [Product PRD](docs/product/prd/PRD.md)
- [Technical architecture](docs/architecture/tech/TECH_ARCHITECTURE.md)
- [PC application documentation](apps/sdkwork-birdcoder-pc/docs/README.md)
- [API inventory](apis/README.md)
- [Local specs index](specs/README.md)
