# Commands

This reference lists stable operator entrypoints. `package.json` remains the
machine authority; package-level commands are documented by their owning
surface.

## Development

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the default BirdCoder development topology. |
| `pnpm dev:desktop` | Start the Tauri desktop development host. |
| `pnpm dev:browser:standalone` | Start the browser against a private BirdCoder service. |
| `pnpm dev:browser:cloud` | Start the browser against the configured cloud topology. |
| `pnpm docs:dev` | Start the documentation site. |

Runtime endpoint and profile values come from `etc/` and
`sdkwork.app.config.json`. A development command must not invent fixed
production identities, implicit dependency-domain routes, or a renderer SQL
authority.

## Build

| Command | Purpose |
| --- | --- |
| `pnpm build` | Build the default production web artifacts. |
| `pnpm build:desktop` | Build the desktop host and bundle. |
| `pnpm build:server` | Build the BirdCoder native service host. |
| `pnpm docs:build` | Build the VitePress documentation site. |

## Architecture And Contracts

| Command | Purpose |
| --- | --- |
| `pnpm check:domain-ownership` | Enforce the 10-table, 39-App-API ownership contract and reject duplicate domain authorities. |
| `pnpm check:agents-birdcoder-alignment` | Verify Agents SDK consumption and removal of local session/message authorities. |
| `pnpm check:kernel-birdcoder-alignment` | Verify BirdCoder has no direct Kernel integration. |
| `pnpm check:api-transport-standard` | Reject raw HTTP and non-standard SDK transport wiring. |
| `pnpm check:package-governance` | Verify package naming, ownership, and dependency declarations. |
| `pnpm check:arch` | Run the current repository architecture aggregate. |

## Database And API

| Command | Purpose |
| --- | --- |
| `pnpm db:materialize:contract` | Materialize the database contract from the greenfield baseline. |
| `pnpm db:generate:ddl` | Generate engine-specific DDL from the database authority. |
| `pnpm db:validate` | Validate the SDKWork database framework contract. |
| `pnpm db:drift:check` | Detect database drift without mutating the schema. |
| `pnpm api:assembly:validate` | Validate API assembly ownership and route composition. |
| `pnpm sdk:generate` | Regenerate the BirdCoder App SDK from its 39-operation authority. |

Generation and materialization are intentionally mutating. Review their diff
and run the matching ownership, SDK, API, or database validator afterward.

## Quality

| Command | Purpose |
| --- | --- |
| `pnpm typecheck` | Type-check the TypeScript workspace. |
| `pnpm lint` | Run the repository source and architecture baseline. |
| `pnpm check:desktop` | Verify desktop delivery boundaries. |
| `pnpm check:server` | Verify native service delivery boundaries. |
| `pnpm check:multi-mode` | Verify cross-host delivery composition. |
| `pnpm check:ci-flow` | Verify CI orchestration. |
| `pnpm check:release-flow` | Verify release orchestration. |

## Release

```bash
pnpm release:plan
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
pnpm release:smoke:desktop
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
pnpm release:smoke:web
pnpm release:finalize
pnpm release:assert-ready
```

Release commands may create artifacts or contact signing and deployment
systems. Run the preflight and smoke sequence required by the selected profile;
do not treat a local build as production-readiness evidence.
