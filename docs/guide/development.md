# Development

BirdCoder development follows the SDKWork application and SDK integration
standards. Read the root `AGENTS.md`, `sdkwork.app.config.json`, and the
task-specific `sdkwork-specs` authority before changing behavior.

## Prerequisites

- Node.js and `pnpm` 10
- Rust and Cargo for BirdCoder service and Tauri hosts
- Flutter for the Flutter mobile surface
- Docker only for container or PostgreSQL workflows

Sibling SDKWork repositories referenced by `pnpm-workspace.yaml` must resolve
from the same workspace root.

## Install

```bash
pnpm install --frozen-lockfile
```

Do not replace sibling SDK packages with local forks or raw HTTP wrappers when
installation or generation fails. Fix the declared workspace, SDK family, or
runtime configuration authority.

## Run

```bash
pnpm dev
pnpm dev:desktop:standalone
pnpm dev:browser:standalone
pnpm dev:browser:cloud
pnpm dev:server:standalone
pnpm topology:plan -- --deployment-profile standalone --environment development --runtime-target desktop
pnpm docs:dev
```

These root commands delegate runtime composition to `sdkwork-app` and the
topology contract. Deployment profile (`standalone` or `cloud`) and runtime
target (`browser`, `desktop`, `server`, `container`, and other declared
targets) are orthogonal. Cloud development requires explicit remote endpoints
from `cloud.development`; it does not start remote dependencies locally.

A standalone desktop selection still uses the same 39-operation BirdCoder App
API and injected dependency SDK clients as every other selection. Renderer code
has no generic SQL bridge and cannot query application tables directly.

Configuration comes from the `etc/` source profiles and the application
manifest. Client code receives only public runtime values. Authentication
claims come from the global SDKWork TokenManager; fixed tenant, organization,
user, or production credential values must not be injected through source.

## SDK Integration

Every feature follows:

```text
composition root -> generated SDK client -> feature service/port -> UI
```

- BirdCoder workspaces and projects use the BirdCoder App SDK.
- Agent Project, Session, Turn, Session Item, Interaction, Runtime Binding,
  Artifact, and Checkpoint operations use the Agents App SDK.
- Skill operations use the Skills App SDK.
- Human chat uses the IM SDK; AI-assistant transcript rows use Agents Session
  Items and are not IM Messages.
- All authenticated App SDK clients share the application TokenManager.

Raw `fetch`, manual `Authorization` headers, copied OpenAPI DTOs, local generated
SDK forks, compatibility facades, and silent local fallbacks are prohibited.

## Verification

Run the smallest check that covers the changed boundary, then expand when the
change crosses API, persistence, SDK, host, or release boundaries.

```bash
pnpm check:domain-ownership
pnpm check:agents-birdcoder-alignment
pnpm check:kernel-birdcoder-alignment
pnpm check:api-transport-standard
pnpm db:validate
pnpm typecheck
pnpm lint
pnpm docs:build
```

Database, API, generated SDK, security, and deployment changes require the
additional validators selected by `AGENTS.md` and `sdkwork-specs`. Mutating
alignment or generation commands are not substitutes for verification; inspect
their diff and run the corresponding read-only gate afterward.

## Pre-Launch Changes

BirdCoder is not yet in production. A domain cutover therefore removes obsolete
tables, routes, DTOs, packages, tests, scripts, and documentation in the same
change. Do not retain a legacy path, dual-write, or compatibility branch for a
consumer that has not shipped.
