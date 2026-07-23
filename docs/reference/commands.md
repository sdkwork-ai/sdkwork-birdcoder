# Commands

`package.json` is the machine authority. This page lists the stable Rust and
PC entrypoints relevant to the current architecture.

## Development And Build

| Command | Purpose |
| --- | --- |
| `pnpm dev:browser:standalone` | Start the PC browser topology. |
| `pnpm dev:desktop` | Start the Tauri desktop topology. |
| `pnpm dev:server:standalone` | Start the stateless Rust gateway topology. |
| `pnpm build:desktop` | Build the desktop host. |
| `pnpm build:server` | Build the Rust gateway. |
| `pnpm docs:build` | Build the documentation site. |

## Contracts

| Command | Purpose |
| --- | --- |
| `pnpm check:domain-ownership` | Verify 0 business tables, 4 App operations, 0 Backend/Open operations, and dependency ownership. |
| `pnpm check:agents-birdcoder-alignment` | Verify canonical Agents Project and Session integration. |
| `pnpm check:api-transport-standard` | Verify generated SDK transport usage. |
| `pnpm check:local-business-storage-boundary` | Verify PC/Tauri device-state restrictions. |
| `pnpm api:assembly:validate` | Validate route assembly ownership. |
| `pnpm sdk:generate` | Regenerate the four-operation BirdCoder App SDK. |
| `pnpm check:arch` | Run the architecture aggregate. |

## Quality And Release

| Command | Purpose |
| --- | --- |
| `pnpm typecheck` | Type-check the PC TypeScript workspace. |
| `pnpm lint` | Run the repository fast quality checks. |
| `pnpm check:desktop` | Verify desktop delivery. |
| `pnpm check:server` | Verify the Rust gateway delivery. |
| `pnpm check:multi-mode` | Verify desktop/server composition. |
| `pnpm check:release-flow` | Verify release orchestration. |

Generation commands are mutating. Inspect their diff and run the matching
validator. No BirdCoder server database command is part of the current
architecture.
