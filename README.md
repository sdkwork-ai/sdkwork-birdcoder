# SDKWork BirdCoder

`sdkwork-birdcoder` is the SDKWork coding workbench application. It provides
PC, H5, and Flutter user experiences while keeping reusable platform domains in
their owning SDKWork projects.

The repository is pre-launch. Its current contract version is `0.1.0`, and
schema/API changes use a direct greenfield cutover without legacy routes,
shadow tables, dual-write, or compatibility facades.

## Application Surfaces

| Surface | Root | Architecture authority |
| --- | --- | --- |
| PC web and desktop | `apps/sdkwork-birdcoder-pc/` | `APP_PC_ARCHITECTURE_SPEC.md` |
| H5 and Capacitor | `apps/sdkwork-birdcoder-h5/` | `APP_H5_ARCHITECTURE_SPEC.md` |
| Flutter mobile | `apps/sdkwork-birdcoder-flutter-mobile/` | `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md` |

Application identity, runtime profiles, and release metadata are declared in
`sdkwork.app.config.json` and the corresponding surface manifests.

## Domain Ownership

BirdCoder owns one bounded context:

```text
domain: intelligence
capability: coding-workbench
```

Its business facts are limited to workspace/project identity, project document
bindings, project runtime locations and preferences, and project sandbox
bindings. The machine-readable authority is
`specs/domain-ownership.spec.json`.

Reusable domains remain external:

| Owner | Canonical facts used by BirdCoder |
| --- | --- |
| `sdkwork-agents` | Agent Project, Session, Turn, Session Item, Interaction, Runtime Binding, Artifact, Checkpoint |
| `sdkwork-skills` | Skill package, version, artifact, capability, installation, API, SDK, and runtime logic |
| `sdkwork-prompts` | Saved Prompt identity, content, lifecycle, API, and SDK |
| `sdkwork-im` | Human Conversation, Message, Member, and ReadCursor |
| `sdkwork-iam` | Authentication, users, organizations, memberships, roles, permissions, and audit |
| `sdkwork-drive` | Sandbox and file storage |
| `sdkwork-documents` | Document identity, content, lifecycle, API, and SDK |
| Other SDKWork modules | Appstore, deployments, models, settings, messaging, and commerce facts |

An AI-assistant transcript is an Agents Session Item stream. It is not an IM
conversation and is never persisted as an IM Message. BirdCoder uses an
in-memory UI adapter only, as defined by
`specs/agent-session-item-view.spec.md`.

The execution dependency is one-way:

```text
BirdCoder -> Agents -> Kernel
BirdCoder -> IM
IM -> Agents
Agents -/-> IM
BirdCoder -/-> Kernel
```

## Database

BirdCoder owns exactly ten `studio_*` tables:

1. `studio_workspace`
2. `studio_project`
3. `studio_project_document_binding`
4. `studio_project_runtime_location`
5. `studio_project_runtime_location_preference`
6. `studio_project_runtime_location_idempotency`
7. `studio_project_runtime_location_audit`
8. `studio_project_sandbox_binding`
9. `studio_project_sandbox_binding_idempotency`
10. `studio_project_sandbox_binding_audit`

The registry is `database/contract/table-registry.json`. SQLite and PostgreSQL
greenfield baselines are under `database/ddl/baseline/`. Cross-domain ids are
opaque references and do not create cross-domain database foreign keys.

## API And SDK

| Surface | Authority | Operations |
| --- | --- | ---: |
| App API | `sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json` | 39 |
| Backend API | None | 0 |
| Open API | None | 0 |

The App API owns only workspaces, projects, project bindings, project runtime
locations/preferences, project Git orchestration, and system metadata. It does
not copy routes from Agents, Skills, IM, IAM, Drive, or another SDKWork domain.

Frontend integration follows one path:

```text
UI -> feature service/port -> injected generated SDK client
```

Bootstrap code constructs SDK clients with the application-wide TokenManager.
Feature UI must not construct raw HTTP clients, add manual authentication
headers, import another project's private source, or maintain local generated
SDK forks.

## Workspace Layout

| Path | Purpose |
| --- | --- |
| `apps/` | PC, H5, and Flutter application surfaces |
| `crates/` | BirdCoder workbench services, repositories, routes, hosts, and Git integration |
| `sdks/` | BirdCoder-owned App SDK family only |
| `database/` | Ten-table coding-workbench database authority |
| `apis/` | API authority index |
| `specs/` | Local component, ownership, dependency, IAM, and topology contracts |
| `docs/` | Product, architecture, requirement, migration, operator, and release documentation |
| `scripts/` | Focused architecture, generation, build, and verification entrypoints |
| `etc/` | Source runtime configuration and deployment profiles |

Shared SDKWork modules are sibling workspace dependencies resolved through
`pnpm-workspace.yaml`; they are not owned or copied by this repository.

## Development

Prerequisites:

- Node.js and `pnpm` 10
- Rust and Cargo for the service and Tauri hosts
- Flutter for the Flutter mobile surface
- Docker only for container or PostgreSQL-oriented workflows

Install the workspace:

```bash
pnpm install --frozen-lockfile
```

Common entrypoints:

```bash
pnpm dev
pnpm dev:desktop
pnpm dev:browser:standalone
pnpm dev:browser:cloud
pnpm docs:dev
```

Runtime values come from the `etc/` source profiles and
`sdkwork.app.config.json`. Secrets and fixed production identities must not be
committed or embedded in client code.

## Verification

Run the narrowest relevant check first. The architecture convergence loop is:

```bash
pnpm check:domain-ownership
pnpm check:agents-birdcoder-alignment
pnpm check:kernel-birdcoder-alignment
pnpm check:api-transport-standard
pnpm db:validate
pnpm typecheck
pnpm lint
```

For a release or deployment change, also run the release-flow and target-host
checks selected by `AGENTS.md` and `sdkwork-specs`.

## Documentation

- `docs/README.md` is the documentation canon index.
- `docs/product/prd/PRD.md` is the product authority.
- `docs/architecture/tech/TECH_ARCHITECTURE.md` is the technical architecture authority.
- `apis/README.md` lists the owned API surfaces.
- `database/README.md` explains database ownership and initialization.
- `specs/README.md` indexes the local machine and narrative contracts.

Global SDKWork rules live in the sibling `sdkwork-specs` repository. This
repository links those standards and does not duplicate their normative text.
