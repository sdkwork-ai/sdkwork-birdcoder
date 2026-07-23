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
| `sdkwork-agents` | Agent Project, composition slot, Session, Turn, Session Item, Interaction, Runtime Binding, Artifact, and Checkpoint |
| `sdkwork-skills` | Skill package, version, artifact, capability, installation, and execution metadata |
| `sdkwork-im` | Human Conversation, Message, Member, and ReadCursor |
| `sdkwork-iam` | Authentication, organization scope, membership, role, permission, and audit |
| `sdkwork-drive` | Drive and sandbox storage |
| `sdkwork-documents` | Document identity and content |

The retired workbench Workspace aggregate is folded directly into IAM
organization scope plus the canonical Agents `AgentProject`. BirdCoder and
the PC client use one `projectId`; there is no Workspace service, BirdCoder
Project, id mapping, or compatibility layer.

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
Project, composition, Session, Skill, IM, IAM, Drive, and Document operations
are consumed from their owner SDK families and are not copied into BirdCoder.

## PC Runtime Boundary

PC feature packages receive generated owner SDK clients or typed ports from
the composition root. They do not issue raw HTTP, add manual authentication
headers, fork DTOs, or import generated transport internals.

- Project and Session workflows use `@sdkwork/agents-app-sdk`.
- A Session uses the same canonical `projectId`, then records its opaque
  runtime location through Agents `sessionRuntimeBindings`.
- Sandbox composition uses the Agents `drive/drive` composition slot.
- Document composition remains unavailable and fails closed until Agents owns
  the canonical `document/documents` slot pair.
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
