# SDKWork BirdCoder

**English** | [Simplified Chinese](./README.zh-CN.md)

SDKWork BirdCoder is a package-first AI IDE workspace. It keeps BirdCoder-specific product modules while aligning host boundaries, release flow, CI policy, deployment bundles, and documentation governance with the Claw Studio architecture standard.

> BirdCoder is not a generic starter template. This repository contains a multi-host AI IDE, executable architecture contracts, release automation, and deployment assets that are maintained as one governed workspace.

## What This Repository Delivers

- A shared AI IDE workspace that runs in web, desktop, and native server modes from the same package graph.
- Product surfaces for code, studio, terminal, settings, skills, templates, and appbase-aligned identity and membership flows.
- Multi-engine integration through shared kernel metadata and dedicated adapters for Codex, Claude Code, Gemini, and OpenCode.
- Release packaging for `desktop`, `server`, `container`, `kubernetes`, and `web`, including smoke routes and finalization.
- Executable governance for prompts, docs, package structure, release closure, quality tiers, and architecture boundaries.

## Workspace Shape

### Foundation

- `@sdkwork/birdcoder-core`
- `@sdkwork/birdcoder-types`
- `@sdkwork/birdcoder-i18n`
- `@sdkwork/birdcoder-infrastructure`
- `@sdkwork/birdcoder-ui`
- `@sdkwork/birdcoder-commons`

### Shell And Host Boundaries

- `@sdkwork/birdcoder-shell`
- `@sdkwork/birdcoder-host-core`
- `@sdkwork/birdcoder-host-studio`

### Delivery Hosts

- `@sdkwork/birdcoder-web`
- `@sdkwork/birdcoder-desktop`
- `@sdkwork/birdcoder-server`
- `@sdkwork/birdcoder-distribution`

### Product Modules

- `@sdkwork/birdcoder-code`
- `@sdkwork/birdcoder-studio`
- `@sdkwork/birdcoder-terminal`
- `@sdkwork/birdcoder-settings`
- `@sdkwork/birdcoder-skills`
- `@sdkwork/birdcoder-templates`
- `@sdkwork/birdcoder-appbase`
- `@sdkwork/birdcoder-chat`
- `@sdkwork/birdcoder-chat-claude`
- `@sdkwork/birdcoder-chat-codex`
- `@sdkwork/birdcoder-chat-gemini`
- `@sdkwork/birdcoder-chat-opencode`

### Repository-Level Assets

- [`docs/`](./docs/) for architecture, steps, prompts, release notes, and operator guidance
- [`scripts/`](./scripts/) for verification, release orchestration, code generation, and governance automation
- [`deploy/docker`](./deploy/docker/) for Docker delivery assets
- [`deploy/kubernetes`](./deploy/kubernetes/) for Helm-compatible Kubernetes delivery assets
- [`external/`](./external/) for engine source mirrors and protocol references used by integration work

## Prerequisites

- Node.js
- `pnpm` 10
- Rust and Cargo when working on desktop or native server hosts
- Docker if you need container packaging, local PostgreSQL smoke, or deployment-oriented verification

## Quick Start

Install the workspace exactly as CI expects:

```bash
pnpm install --frozen-lockfile
```

Start the browser host:

```bash
pnpm dev
```

Additional local entrypoints:

```bash
pnpm tauri:dev
pnpm server:dev
pnpm docs:dev
```

Default local ports from the current scripts:

- Web workspace: `http://localhost:3000`
- Docs preview: `http://127.0.0.1:4173`

## Common Commands

| Goal | Command | Notes |
| --- | --- | --- |
| Start web workspace | `pnpm dev` | Runs the shared browser-hosted BirdCoder workbench |
| Start desktop host | `pnpm tauri:dev` | Runs the Tauri host with toolchain and port guards |
| Start native server host | `pnpm server:dev` | Runs the Rust-backed server host |
| Build production web workspace | `pnpm build` | Prepares shared SDK packages and builds the web host |
| Build docs site | `pnpm docs:build` | Builds the VitePress documentation site |
| Run repository baseline verification | `pnpm lint` | The main pre-commit and pre-push verification baseline |
| Verify package governance | `pnpm check:package-governance` | Guards scoped package names and workspace dependency ownership |
| Verify cross-host delivery | `pnpm check:multi-mode` | Aggregates desktop, server, and release-flow checks |
| Generate quality execution evidence | `pnpm quality:execution-report` | Writes `artifacts/quality/quality-gate-execution-report.json` |
| Build native server release bundle | `pnpm server:build` | Runs the governed server build wrapper |

## Quality And Governance

BirdCoder treats documentation and release behavior as executable contracts, not passive references.

- `pnpm lint` runs TypeScript checks plus the repository's current architecture, governance, prompt, and release-flow contract set.
- `pnpm check:quality:fast`, `pnpm check:quality:standard`, and `pnpm check:quality:release` define the stepped quality tiers.
- `pnpm quality:report` and `pnpm quality:execution-report` archive machine-readable evidence under `artifacts/quality/`.
- `pnpm check:live-docs-governance-baseline` guards architecture, Step, prompt, and release docs against the active governance baseline.
- `pnpm check:release-flow` and `pnpm check:ci-flow` freeze release orchestration and workflow contracts.

If you are changing package ownership, release automation, documentation governance, or multi-host behavior, start from `pnpm lint` and then add the narrower checks for your area.

## Release And Deployment

BirdCoder packages multiple delivery families from the same workspace:

- `desktop`
- `server`
- `container`
- `kubernetes`
- `web`

Core release commands:

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
pnpm release:smoke:finalized
```

Release assets are assembled under `artifacts/release/`. Finalization emits the release inventory and quality evidence used by downstream publication and rollback planning.

For the full delivery contract, see [Release And Deployment](./docs/core/release-and-deployment.md).

## Documentation Map

- [Getting Started](./docs/guide/getting-started.md)
- [Application Modes](./docs/guide/application-modes.md)
- [Architecture Overview](./docs/core/architecture.md)
- [Package Topology](./docs/core/packages.md)
- [Command Reference](./docs/reference/commands.md)
- [Release And Deployment](./docs/core/release-and-deployment.md)
- [Chinese Architecture Standards](./docs/架构/README.md)
- [Step Execution Matrix](./docs/step/README.md)

## Language Support

- The default entrypoint is this English `README.md`.
- The Simplified Chinese counterpart lives at [README.zh-CN.md](./README.zh-CN.md).
- Most operational docs are written in English, while the full architecture and Step standards are maintained in Chinese under [`docs/架构`](./docs/架构/) and [`docs/step`](./docs/step/).
