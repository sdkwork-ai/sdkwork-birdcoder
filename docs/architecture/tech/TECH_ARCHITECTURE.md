# SDKWork BirdCoder Technical Architecture

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-23
Specs: ARCHITECTURE_DECISION_SPEC.md, APP_PC_ARCHITECTURE_SPEC.md, DESKTOP_APP_ARCHITECTURE_SPEC.md, APP_SDK_INTEGRATION_SPEC.md, API_SPEC.md, SDK_SPEC.md, DATABASE_SPEC.md, SECURITY_SPEC.md, CONFIG_SPEC.md, DEPLOYMENT_SPEC.md

## 1. Architecture Overview

BirdCoder is a stateless coding-workbench composition host. The Rust gateway
owns four System reads and mounts approved dependency assemblies without
claiming their API or data ownership. The PC composition root constructs
generated owner SDK clients with the shared TokenManager and injects them into
feature services.

```text
PC browser/Tauri
  -> feature service or typed host port
  -> generated owner SDK client
  -> BirdCoder System API or dependency-owned API
  -> owning domain service and persistence
```

There is no BirdCoder server business database and no second Workspace,
Project, Session, transcript, or runtime-location aggregate.

## 2. Technology Choices

| Area | Choice | Boundary |
| --- | --- | --- |
| Server | Rust, Axum, composed route assemblies | Stateless BirdCoder System host |
| Desktop | Tauri and Rust host commands | Device-private filesystem, Git, terminal, and device state |
| PC renderer | React and TypeScript package families | UI and in-memory view adaptation |
| Remote integration | Generated SDKWork owner SDKs | No raw HTTP or local generated fork |
| Local persistence | Tauri SQLite and browser capability storage | Device state only, never remote business authority |
| Contracts | Root/module specs, OpenAPI, native manifests | Machine authority; docs are narrative |

## 3. Data And Lifecycle

### Server Data

BirdCoder server business tables: **0**. The Rust gateway has no BirdCoder
database pool, DDL, migration, seed, drift, backup, or restore lifecycle.
Dependency modules retain their own persistence, which is outside this
project's database design.

### PC Device State

The Tauri host owns one local SQLite table:

| Table | Allowed purpose | Forbidden purpose |
| --- | --- | --- |
| `device_state_entry` | Application settings, subject-scoped project device mounts, desktop runtime-location installation identity | Project, Session, Conversation, Message, transcript, Skill, or any server business aggregate |

The command layer and SQLite constraint both enforce the scope/key allowlist.
Values are bounded to 256 KiB. The file defaults to
`birdcoder-device-state.sqlite3` and may be overridden only for PC/Tauri with
`SDKWORK_BIRDCODER_DEVICE_STATE_FILE`.

Browser directory handles may use browser-local capability storage. They are
not SQL business records and cannot be converted into native or remote paths.

### Domain Facts

| Facts | System of record |
| --- | --- |
| Project, composition, Session, Turn, Session Item, Interaction, Runtime Binding, Artifact, Checkpoint | `sdkwork-agents` |
| Skill package, version, artifact, capability, installation | `sdkwork-skills` |
| Human Conversation, Message, Member, ReadCursor | `sdkwork-im` |
| Authentication, organization scope, membership, role, permission, audit | `sdkwork-iam` |
| Drive and sandbox data | `sdkwork-drive` |
| Document identity and content | `sdkwork-documents` |

AI assistant content follows the Agents execution lifecycle. IM facts follow
human communication delivery and read-state lifecycles. Similar presentation
does not make the records interchangeable.

## 4. API, SDK, And Rust Composition

The BirdCoder App API owns exactly four operations:

| Resource | Operation |
| --- | --- |
| System descriptor | retrieve |
| System health | retrieve |
| System routes | list |
| System runtime | retrieve |

Backend API and Open API each contain zero BirdCoder operations. The four
matching permissions live in `specs/iam.module.manifest.json`.

The standalone assembly combines the BirdCoder System router with approved
owner assemblies, including Agents. Runtime mounting is executable composition,
not contract ownership. Only the four System operations enter the BirdCoder
OpenAPI and generated App SDK.

The generated client boundary is:

```text
runtime composition
  -> owner SDK client + TokenManager + owner endpoint
  -> feature service/port
  -> UI
```

No layer may substitute raw HTTP, manual auth headers, hand-written envelope
parsing, a copied DTO, or another project's private source.

## 5. Project, Composition, And Session Flow

The former BirdCoder Workspace is removed, not migrated into another local
model. IAM organization scope provides grouping and authorization context.
Agents `AgentProject` is the only Project aggregate.

```text
IAM organization scope
  -> Agents AgentProject (canonical projectId)
       -> composition slots
       -> Session
            -> Turn
            -> Session Item
            -> Interaction
            -> Session Runtime Binding
```

PC creates, lists, updates, archives, and deletes Projects through the Agents
App SDK. Every UI and device-mount reference uses the returned `projectId`.
There is no alias, dual ID, or mapping table.

When a Session needs local execution context:

1. PC resolves the active subject's device mount for the canonical
   `projectId`.
2. PC creates the Agents Session with that same `projectId`.
3. PC creates or resolves the Agents `sessionRuntimeBindings` record using
   the opaque runtime location id from the local host identity.
4. Native paths remain in the Tauri boundary.
5. A missing mount, id, permission, or binding fails closed.

## 6. PC Host And Composition Boundaries

`ProjectDeviceMountRegistry` is the only PC project-to-local-directory
registry. It is subject-scoped and keyed by canonical `projectId`.

| Capability | Owner and behavior |
| --- | --- |
| Native path selection and canonicalization | Tauri host |
| Filesystem read/write | PC host adapter after mount validation |
| Git and worktree processes | PC/Tauri local Git capability |
| Terminal process and cwd | PC/Tauri terminal capability after mount validation |
| Sandbox composition | Agents composition slot `drive/drive` |
| Document composition | Unavailable until Agents supports `document/documents`; explicit fail-closed service |

BirdCoder does not expose remote Git, project-path, mount, or runtime-location
registration APIs. A local mount or opaque runtime id does not authorize remote
execution. Agents, Kernel, and provider runtimes own any future remote execution
and target validation.

## 7. Security, Performance, And Observability

- `IamAuthorizationPolicy` evaluates every protected System permission and
  denies missing scopes; development mode has no empty-scope bypass.
- SDK clients share the application TokenManager; tokens and auth headers do
  not enter feature code.
- Tauri local-store commands validate scope, key, value size, active subject,
  and path capability.
- Native paths, tokens, credentials, device-state values, Session content, and
  human messages are excluded from normal logs, traces, metrics, and release
  evidence.
- List operations use the owner API's bounded pagination. PC derives only
  disposable in-memory views and does not build replayed read authorities.
- Metrics identify bounded route templates and dependency health, not tenant,
  user, Project, Session, message, path, or mount values.

## 8. Deployment And Runtime Topology

| Profile and target | BirdCoder state | Capability |
| --- | --- | --- |
| `standalone + desktop` | Local Tauri device state only | Local filesystem, Git, worktree, and terminal through host adapters |
| `standalone + browser` | Browser-local capability handles only | Browser workbench; no native path |
| `standalone + server` | None | Stateless System API and composed owner routes |
| `cloud + server/container` | None | Stateless ingress; no project directory or remote runner |

`application.public-ingress` serves BirdCoder System operations.
`platform.api-gateway` or an explicit owner override serves dependency SDKs.
Missing required topology fails before SDK construction. Server and container
profiles contain no BirdCoder database or PC device-state setting.

## 9. Architecture Decision Index

- [ADR-20260722 Owner-composed stateless workbench](../decisions/ADR-20260722-domain-ownership-and-single-write-authority.md)
- [Runtime topology](../topology-standard.md)
- [PC architecture supplement](../../../apps/sdkwork-birdcoder-pc/docs/architecture/tech/TECH_ARCHITECTURE.md)

## 10. Verification

```bash
pnpm check:domain-ownership
pnpm check:agents-birdcoder-alignment
pnpm check:kernel-birdcoder-alignment
pnpm api:assembly:validate
pnpm check:sdk-family-standard
pnpm check:api-transport-standard
pnpm check:local-business-storage-boundary
pnpm check:desktop
pnpm check:server
pnpm typecheck
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root . --profile application
pnpm docs:build
```
