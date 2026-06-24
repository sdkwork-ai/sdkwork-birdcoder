# SDKWork BirdCoder

**English** | [Simplified Chinese](./README.zh-CN.md)

SDKWork BirdCoder is a package-first AI IDE workspace. It keeps BirdCoder product modules while aligning host boundaries, release flow, CI policy, deployment bundles, and documentation governance with the SDKWork architecture standard. IAM uses the standard SDKWork IAM runtime, generated app/backend SDKs, and shared auth/user/VIP UI packages. BirdCoder binds product branding, routes, and sample starter data onto those canonical surfaces instead of owning an application-level auth or account compatibility layer.

> BirdCoder is not a generic starter template. This repository contains a multi-host AI IDE, executable architecture contracts, release automation, and deployment assets that are maintained as one governed workspace.

## What This Repository Delivers

- A shared AI IDE workspace that runs in web, desktop, and native server modes from the same package graph.
- Product surfaces for code, studio, terminal, settings, skills, templates, SDKWork IAM auth, user profile, and VIP membership flows.
- Multi-engine integration through shared kernel metadata and dedicated adapters for Codex, Claude Code, Gemini, and OpenCode.
- Release packaging for `desktop`, `server`, `container`, `kubernetes`, and `web`, including smoke routes and finalization.
- Executable governance for prompts, docs, package structure, release closure, quality tiers, SDK generation, and architecture boundaries.

## Workspace Shape

### Multi-Surface Architecture

This repository contains three application surfaces:

| Surface | Root | Architecture Spec |
|---------|------|-------------------|
| PC (Desktop/Web) | `apps/sdkwork-birdcoder-pc/` | `APP_PC_ARCHITECTURE_SPEC.md` |
| H5 (Mobile Web/Capacitor) | `apps/sdkwork-birdcoder-h5/` | `APP_H5_ARCHITECTURE_SPEC.md` |
| Flutter Mobile | `apps/sdkwork-birdcoder-flutter-mobile/` | `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md` |

### PC Application Root

All PC-specific packages are under `apps/sdkwork-birdcoder-pc/packages/` with the `pc` segment:

**Core & Infrastructure:**
- `@sdkwork/birdcoder-pc-core` — PC core runtime
- `@sdkwork/birdcoder-pc-commons` — PC commons
- `@sdkwork/birdcoder-pc-shell` — PC shell
- `@sdkwork/birdcoder-pc-types` — PC types
- `@sdkwork/birdcoder-pc-i18n` — PC internationalization
- `@sdkwork/birdcoder-pc-infrastructure` — PC infrastructure
- `@sdkwork/birdcoder-pc-iam` — PC IAM integration
- `@sdkwork/birdcoder-pc-auth` — PC auth utilities
- `@sdkwork/birdcoder-pc-user` — PC user model
- `@sdkwork/birdcoder-pc-settings` — PC settings

**Delivery Hosts:**
- `@sdkwork/birdcoder-pc-web` — Web host
- `@sdkwork/birdcoder-pc-desktop` — Tauri desktop host
- `@sdkwork/birdcoder-pc-server` — Server host

**Product Modules:**
- `@sdkwork/birdcoder-pc-code` — Code editor
- `@sdkwork/birdcoder-pc-studio` — Studio
- `@sdkwork/birdcoder-pc-projection` — Kernel event → coding_session projection
- `@sdkwork/birdcoder-pc-skills` — Skills
- `@sdkwork/birdcoder-pc-templates` — Templates
- ... (38 total PC packages)

### H5-Specific Packages

H5-specific packages are under `apps/sdkwork-birdcoder-h5/packages/` with the `h5` segment:

- `@sdkwork/birdcoder-h5-core` — H5 core runtime
- `@sdkwork/birdcoder-h5-commons` — H5 commons
- `@sdkwork/birdcoder-h5-shell` — H5 shell
- `@sdkwork/birdcoder-h5-chat` — H5 chat
- `@sdkwork/birdcoder-h5-capacitor` — Capacitor host
- ... (9 total H5 packages)

### Flutter-Specific Packages

Flutter-specific packages are under `apps/sdkwork-birdcoder-flutter-mobile/packages/` with the `flutter_mobile` segment:

- `sdkwork_birdcoder_flutter_mobile_core` — Flutter core runtime
- `sdkwork_birdcoder_flutter_mobile_commons` — Flutter commons
- `sdkwork_birdcoder_flutter_mobile_shell` — Flutter shell
- `sdkwork_birdcoder_flutter_mobile_chat` — Flutter chat
- `sdkwork_birdcoder_flutter_mobile_host` — Flutter host
- ... (9 total Flutter packages)

### Foundation

- `@sdkwork/birdcoder-core`
- `@sdkwork/birdcoder-types`
- `@sdkwork/birdcoder-i18n`
- `@sdkwork/birdcoder-infrastructure`
- `@sdkwork/birdcoder-ui`
- `@sdkwork/birdcoder-commons`

### Shell And Host Boundaries

- `@sdkwork/birdcoder-pc-shell` — PC shell
- `@sdkwork/birdcoder-pc-host-core` — PC host core
- `@sdkwork/birdcoder-pc-host-studio` — PC host studio

### Delivery Hosts

- `@sdkwork/birdcoder-pc-web` — Web host
- `@sdkwork/birdcoder-pc-desktop` — Tauri desktop host
- `@sdkwork/birdcoder-pc-server` — Server host
- `@sdkwork/birdcoder-distribution` — Distribution utilities

### Product Modules

- `@sdkwork/birdcoder-pc-code` — Code editor
- `@sdkwork/birdcoder-pc-studio` — Studio
- `@sdkwork/birdcoder-pc-projection` — Kernel event → coding_session projection
- `@sdkwork/birdcoder-settings` — Settings
- `@sdkwork/birdcoder-skills` — Skills
- `@sdkwork/birdcoder-templates` — Templates
- `@sdkwork/birdcoder-auth` — Auth
- `@sdkwork/birdcoder-user` — User
- `@sdkwork/birdcoder-iam`
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

Start the default private web sample stack:

```bash
pnpm dev
```

Common development entrypoints:

```bash
pnpm dev:local
pnpm dev:private
pnpm dev:cloud
pnpm tauri:dev
pnpm tauri:dev:private
pnpm tauri:dev:cloud
pnpm server:dev
pnpm server:dev:private
pnpm server:dev:cloud
pnpm stack:desktop:local
pnpm stack:desktop:private
pnpm stack:desktop:cloud
pnpm stack:web:private
pnpm stack:web:cloud
pnpm docs:dev
pnpm check:iam:sample
```

Default local ports from the current scripts:

- Web workspace: `http://localhost:3000`
- BirdCoder server: `http://127.0.0.1:10240`
- Docs preview: `http://127.0.0.1:4173`

## IAM Deployment Modes

BirdCoder exposes three canonical IAM deployment modes through the root `pnpm` wrappers:

| Mode | Desktop command | Server command | Public SDKWork mode | IAM authority |
| --- | --- | --- | --- | --- |
| `desktop-local` | `pnpm tauri:dev` or `pnpm tauri:dev:local` | N/A | `local` | Embedded BirdCoder coding server with local SDKWork IAM |
| `server-private` | `pnpm tauri:dev:private` | `pnpm server:dev` or `pnpm server:dev:private` | `private` | Private BirdCoder server with local SDKWork IAM |
| `cloud-saas` | `pnpm tauri:dev:cloud` | `pnpm server:dev:cloud` | `saas` | BirdCoder server backed by SDKWork cloud app-api IAM |

The wrappers load `.env`, `.env.local`, `.env.development`, `.env.development.local`, `.env.production`, and `.env.production.local` through Vite's env loader, then apply mode-specific defaults for sqlite, remote API base URL, SDKWork IAM mode, OAuth sample providers, and dev-only quick-login hints. The managed public client value is `VITE_SDKWORK_DEPLOYMENT_MODE`, and the server-facing value is `SDKWORK_IAM_MODE`.

Development commands for `server-private` and `cloud-saas` desktop modes default the client base URL to `http://127.0.0.1:10240` when you are iterating locally. Production desktop packaging for those two remote modes is stricter: you must explicitly set `BIRDCODER_API_BASE_URL` or `VITE_BIRDCODER_API_BASE_URL` so the packaged app cannot silently target a localhost endpoint.

For local development, register or log in through the standard SDKWork IAM auth surface. Tenant, organization, user, session, and app scope come from dual-token JWT claims after authentication; do not inject fixed identity through bootstrap environment variables.

Optional login-form prefill is explicit opt-in only:

- Set `VITE_BIRDCODER_AUTH_DEV_PREFILL_ENABLED=true`
- Provide your own `VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL`, `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE`, and/or `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD`
- Fixed local verify code in dev wrappers when enabled: `123456` via `SDKWORK_IAM_DEV_FIXED_VERIFY_CODE`

Local startup also seeds one starter workspace project when the authority has no active projects. The project is written to a deterministic absolute directory beside the sqlite authority file:

- Default seeded root: `<sqlite-dir>/bootstrap-projects/<sqlite-file-stem>/project-default`
- Seeded files: `README.md`, `package.json`, `.gitignore`, `src/index.ts`
- Optional override: `BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT`

The shared SDKWork auth surface receives the same values as development prefill defaults in `desktop-local` and `server-private`, so password login, email-code login, and phone-code login can be exercised immediately without changing UI code or manually typing test credentials. `cloud-saas` can use the same prefill surface too: set `VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT`, `VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL`, `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE`, and `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD` in your env file when you want a remote test account to be preloaded in development.

Seed behavior is fail-closed by deployment profile. `desktop-local` and `server-private` enable local SDKWork IAM authority seed, auth-development seed, fixed local verification code, and starter workspace bootstrap. `cloud-saas` disables local authority seed instead of fabricating fallback local users, verification codes, or starter projects, so upstream configuration problems surface immediately during startup and governance checks.

Inspect the final managed startup env before running a mode:

```bash
pnpm iam:show -- desktop-dev --iam-mode desktop-local
pnpm iam:show -- server-dev --iam-mode server-private
pnpm iam:show -- server-dev --iam-mode cloud-saas
```

The inspector prints resolved `BIRDCODER_*`, `VITE_BIRDCODER_*`, `SDKWORK_IAM_*`, and `VITE_SDKWORK_DEPLOYMENT_MODE` values with secret-like fields masked, so you can confirm sqlite paths, API base URLs, dev quick-login defaults, OAuth sample provider configuration, and cloud app-api configuration before starting a host.

When you want the same canonical deployment profile plus readiness validation, use the doctor aliases:

```bash
pnpm iam:doctor:desktop:local
pnpm iam:doctor:web:private
pnpm iam:doctor:server:cloud
```

Doctor commands validate required env presence, effective API base URL, storage target, readiness endpoints, seed behavior, and development-prefill availability. Cloud lanes fail closed when upstream app-api configuration is incomplete.

For a repeatable sample-app verification entrypoint, run:

```bash
pnpm check:iam:sample
```

This command executes the standardized IAM inspectors for desktop, web, and server targets across local, private, and cloud lanes, then builds the web and server artifacts for private and cloud deployment modes. If `SDKWORK_IAM_APP_API_BASE_URL` is not already set, the cloud slice uses `https://app-api.example.com` as a deterministic placeholder so the command can validate BirdCoder's cloud wiring without requiring a live upstream authority during local governance checks.

BirdCoder keeps frontend code on the standard routes: `/app/v3/api/auth/*`, `/app/v3/api/system/iam/runtime`, `/app/v3/api/system/iam/verification_policy`, `/app/v3/api/iam/users/current`, `/app/v3/api/memberships/current`, and `/app/v3/api/memberships/package_groups`. Auth UI uses `SdkworkIamAuthRoutes`; the user surface uses the shared SDKWork user controller; membership and package catalog data go through the generated BirdCoder app SDK `commerce.memberships` surface; runtime auth/session calls go through the generated BirdCoder app SDK and `@sdkwork/iam-runtime`.

## Common Commands

| Goal | Command | Notes |
| --- | --- | --- |
| Start the local single-machine desktop sample | `pnpm dev:local` or `pnpm desktop:dev:local` | Opens the Tauri desktop host with embedded coding server, local SDKWork IAM, seeded bootstrap data, and dev quick-login defaults |
| Start the private web sample stack | `pnpm dev` or `pnpm dev:private` | Starts the native BirdCoder server first, waits for `/app/v3/api/system/health` and IAM config routes, then boots the browser host |
| Start web workspace against cloud-backed IAM | `pnpm dev:cloud` | Browser host uses the cloud-mode API base URL from env |
| Start the private BirdCoder web sample stack in one command | `pnpm stack:web:private` | Managed server-plus-web stack for private browser-host onboarding |
| Start the cloud-backed BirdCoder web sample stack in one command | `pnpm stack:web:cloud` | Starts the local BirdCoder server in `cloud-saas` mode and then boots the web host; requires or defaults `SDKWORK_IAM_APP_API_BASE_URL` for sample checks |
| Start desktop host with embedded local IAM | `pnpm tauri:dev` | Default `desktop-local` mode with embedded coding server, local SDKWork IAM, and dev quick-login defaults |
| Start desktop host against a private BirdCoder server | `pnpm tauri:dev:private` | Uses `BIRDCODER_API_BASE_URL` or defaults to `http://127.0.0.1:10240` |
| Start desktop host against cloud-backed IAM | `pnpm tauri:dev:cloud` | Expects the target BirdCoder server to run with SDKWork cloud app-api IAM integration |
| Start the private BirdCoder desktop sample stack | `pnpm stack:desktop:private` | Starts the native BirdCoder server and then launches the desktop host against it |
| Start the cloud-backed BirdCoder desktop sample stack | `pnpm stack:desktop:cloud` | Starts the native BirdCoder server in `cloud-saas` mode and then launches the desktop host against it |
| Start native server with private IAM | `pnpm server:dev` or `pnpm server:dev:private` | Default server-private mode with local SDKWork IAM |
| Start native server with cloud app-api IAM | `pnpm server:dev:cloud` | Requires or defaults `SDKWORK_IAM_APP_API_BASE_URL` for sample checks |
| Inspect resolved IAM env for any target/mode | `pnpm iam:show -- <target> --iam-mode <mode>` | Prints managed BirdCoder env after `.env` loading and mode normalization |
| Validate IAM env and deployment readiness | `pnpm iam:doctor:desktop:local`, `pnpm iam:doctor:web:private`, `pnpm iam:doctor:server:cloud` | Validates required env, base URL, storage target, seed policy, and quick-login availability |
| Run BirdCoder IAM governance | `pnpm check:iam-standard` | Verifies BirdCoder stays on standard SDKWork IAM runtime, auth UI, generated SDK, command matrix, and package boundaries |
| Verify the BirdCoder IAM sample matrix | `pnpm check:iam:sample` | Runs IAM inspectors plus private/cloud web/server builds |
| Build web bundle for private mode | `pnpm build` or `pnpm build:private` | Production browser bundle for private BirdCoder server integration |
| Build web bundle for cloud mode | `pnpm build:cloud` | Production browser bundle for cloud IAM integration |
| Build desktop package for local mode | `pnpm tauri:build` | Packages the desktop app for embedded local deployment |
| Build desktop package for private-server mode | `pnpm tauri:build:private` | Packages the desktop app to target an external BirdCoder server |
| Build desktop package for cloud mode | `pnpm tauri:build:cloud` | Packages the desktop app to target a cloud-backed BirdCoder server |
| Build docs site | `pnpm docs:build` | Builds the VitePress documentation site |
| Run repository baseline verification | `pnpm lint` | Main pre-commit and pre-push verification baseline |
| Verify package governance | `pnpm check:package-governance` | Guards scoped package names and workspace dependency ownership |
| Verify cross-host delivery | `pnpm check:multi-mode` | Aggregates desktop, server, and release-flow checks |
| Generate quality execution evidence | `pnpm quality:execution-report` | Writes `artifacts/quality/quality-gate-execution-report.json` |
| Build native server release bundle | `pnpm server:build` | Runs the governed server build wrapper |

## Quality And Governance

BirdCoder treats documentation and release behavior as executable contracts, not passive references.

- `pnpm lint` runs TypeScript checks plus the repository's current architecture, governance, prompt, IAM, SDK, and release-flow contract set.
- `pnpm check:quality:fast`, `pnpm check:quality:standard`, and `pnpm check:quality:release` define the stepped quality tiers.
- `pnpm quality:report` and `pnpm quality:execution-report` archive machine-readable evidence under `artifacts/quality/`.
- `pnpm check:live-docs-governance-baseline` guards architecture, Step, prompt, and release docs against the active governance baseline.
- `pnpm check:release-flow` and `pnpm check:ci-flow` freeze release orchestration and workflow contracts.

If you are changing package ownership, release automation, documentation governance, IAM behavior, generated SDKs, or multi-host behavior, start from `pnpm lint` and then add the narrower checks for your area.

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
- [Development](./docs/guide/development.md)
- [Architecture Overview](./docs/core/architecture.md)
- [Package Topology](./docs/core/packages.md)
- [Command Reference](./docs/reference/commands.md)
- [Release And Deployment](./docs/core/release-and-deployment.md)
- [Chinese Architecture Standards](./docs/架构/README.md)
- [Step Execution Matrix](./docs/step/README.md)

## Auth UI Rule

BirdCoder is the sample integration for the shared SDKWork IAM auth surface. Its auth page must keep the QR panel on the left rail for login, registration, and forgot-password flows. The supported QR contract is anchored on `/app/v3/api/auth/qr_login_codes` and `/app/v3/api/auth/qr_login_codes/{qrKey}`, so the left rail stays bound to a real QR login capability instead of a placeholder layout.

When the desktop or web host is opened on a direct auth callback path such as `/auth/oauth/callback/:provider`, BirdCoder boots straight into the shared auth surface so OAuth return flows can complete without manual tab switching.

## Language Support

- The default entrypoint is this English `README.md`.
- The Simplified Chinese counterpart lives at [README.zh-CN.md](./README.zh-CN.md).
- Most operational docs are written in English, while the full architecture and Step standards are maintained in Chinese under [`docs/架构`](./docs/架构) and [`docs/step`](./docs/step/).

## SDKWork Documentation Contract

Domain: platform
Capability: component
Package type: react-tauri-app
Status: ACTIVE

### Public API

Public exports are declared in `specs/component.spec.json` under `contracts.publicExports`.

### Required SDK Surface

- None declared in `specs/component.spec.json`.

### Configuration

Configuration keys and runtime entrypoints are declared in `specs/component.spec.json`.

### SaaS/Private/Local Behavior

This module follows the canonical standards linked from `specs/component.spec.json`, including deployment and runtime configuration rules where applicable.

### Security

Do not add secrets, live tokens, manual auth headers, or app-local credential handling to this module.

### Extension Points

Extension points are limited to declared public exports, runtime entrypoints, SDK clients, events, and config keys.

### Verification

- `pnpm --filter @sdkwork/birdcoder-workspace typecheck`

### Owner And Status

Owner and lifecycle status are tracked in `specs/component.spec.json`.

## Documentation Canon

- [docs/README.md](docs/README.md)
- [docs/product/prd/PRD.md](docs/product/prd/PRD.md)
- [docs/architecture/tech/TECH_ARCHITECTURE.md](docs/architecture/tech/TECH_ARCHITECTURE.md)

