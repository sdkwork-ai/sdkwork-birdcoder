# SDKWork BirdCoder

**English** | [Simplified Chinese](./README.zh-CN.md)

SDKWork BirdCoder is a package-first AI IDE workspace. It keeps BirdCoder-specific product modules while aligning host boundaries, release flow, CI policy, deployment bundles, and documentation governance with the Claw Studio architecture standard. Identity, user-center, auth-runtime, deployment-profile, command-matrix, and seed-contract behavior come from `sdkwork-appbase`; BirdCoder binds product branding, namespace, routes, and sample starter data onto those canonical factories.

> BirdCoder is not a generic starter template. This repository contains a multi-host AI IDE, executable architecture contracts, release automation, and deployment assets that are maintained as one governed workspace.

## What This Repository Delivers

- A shared AI IDE workspace that runs in web, desktop, and native server modes from the same package graph.
- Product surfaces for code, studio, terminal, settings, skills, templates, and shared identity and membership flows.
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
- `@sdkwork/birdcoder-auth`
- `@sdkwork/birdcoder-user`
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

Start the default local web sample stack:

```bash
pnpm dev
```

Additional local entrypoints:

```bash
pnpm tauri:dev
pnpm tauri:dev:private
pnpm tauri:dev:external
pnpm tauri:dev:cloud
pnpm dev:local
pnpm dev:private
pnpm dev:external
pnpm dev:cloud
pnpm server:dev
pnpm server:dev:external
pnpm server:dev:cloud
pnpm desktop:dev:local
pnpm desktop:dev:private
pnpm desktop:dev:external
pnpm desktop:dev:cloud
pnpm stack:desktop:local
pnpm stack:desktop:private
pnpm stack:desktop:external
pnpm stack:desktop:cloud
pnpm web:dev:private
pnpm web:dev:external
pnpm web:dev:cloud
pnpm stack:web:private
pnpm stack:web:external
pnpm stack:web:cloud
pnpm server:dev:private
pnpm server:dev:cloud
pnpm docs:dev
pnpm check:identity:sample
```

Default local ports from the current scripts:

- Web workspace: `http://localhost:3000`
- Docs preview: `http://127.0.0.1:4173`

## Identity Deployment And Provider Modes

BirdCoder now exposes three canonical identity deployment modes through the root `pnpm` wrappers:

| Mode | Desktop command | Server command | Identity authority |
| --- | --- | --- | --- |
| `desktop-local` | `pnpm tauri:dev` or `pnpm tauri:dev:local` | N/A | Tauri embeds the coding server and uses a local sqlite user center |
| `server-private` | `pnpm tauri:dev:private` | `pnpm server:dev` or `pnpm server:dev:private` | A private BirdCoder server hosts the local user center and auth APIs |
| `cloud-saas` | `pnpm tauri:dev:cloud` | `pnpm server:dev:cloud` | BirdCoder server delegates identity to `sdkwork-cloud-app-api` |

The wrappers load `.env`, `.env.local`, `.env.development`, `.env.development.local`, `.env.production`, and `.env.production.local` through Vite's env loader, then apply mode-specific defaults for sqlite, remote API base URL, user-center provider, local OAuth providers, and dev-only quick-login hints. They also mirror `BIRDCODER_USER_CENTER_LOGIN_PROVIDER` to `VITE_BIRDCODER_USER_CENTER_LOGIN_PROVIDER` so the web and desktop hosts can bind the canonical provider kind during bootstrap instead of waiting for downstream inference. `VITE_BIRDCODER_IDENTITY_DEPLOYMENT_MODE` still acts as the fallback inference source for the three standardized deployment modes, and after the app loads `/api/app/v1/auth/config`, BirdCoder syncs the server-reported `providerKind` and `providerKey` back into the runtime binding so the live runtime remains aligned with the authoritative server configuration.

For the sample-engineering workflow, BirdCoder now also exposes one-command stack launchers that start the native server first when a separate authority host is required and then boot the matching desktop or web client on top of the same managed identity env. This keeps the local single-machine, private-server, external-provider, and cloud-backed samples aligned behind one stable operator surface.

Provider selection is standardized independently from deployment mode:

| Provider kind | Standardized command family | Notes |
| --- | --- | --- |
| `builtin-local` | `pnpm dev`, `pnpm dev:private`, `pnpm stack:web:private`, `pnpm server:dev`, `pnpm tauri:dev`, and the `:local` aliases | Local sqlite authority with seeded bootstrap account, fixed dev verify code, and prefilled login defaults in builtin-local development flows |
| `external-user-center` | `pnpm dev:external`, `pnpm web:dev:external`, `pnpm tauri:dev:external`, `pnpm desktop:dev:external`, `pnpm server:dev:external` | Private BirdCoder server keeps the same facade routes but delegates identity to a third-party bridge |
| `sdkwork-cloud-app-api` | `pnpm dev:cloud`, `pnpm server:dev:cloud`, `pnpm tauri:dev:cloud`, and the `:cloud` aliases | BirdCoder server delegates identity to `sdkwork-cloud-app-api` |

Development commands for `server-private` and `cloud-saas` desktop modes default the client base URL to `http://127.0.0.1:10240` when you are iterating locally. Production desktop packaging for those two remote modes is stricter: you must explicitly set `BIRDCODER_API_BASE_URL` or `VITE_BIRDCODER_API_BASE_URL` so the packaged app cannot silently target a localhost endpoint.

For local development with the builtin local user center, BirdCoder seeds this default account automatically:

- Account: `local-default@sdkwork-birdcoder.local`
- Email: `local-default@sdkwork-birdcoder.local`
- Phone: `13800000000`
- Password: `dev123456`
- Fixed local verify code in dev wrappers: `123456`

Builtin local startup now also seeds one starter workspace project when the authority has no active projects. The project is written to a deterministic absolute directory beside the sqlite authority file:

- Default seeded root: `<sqlite-dir>/bootstrap-projects/<sqlite-file-stem>/project-default`
- Seeded files: `README.md`, `package.json`, `.gitignore`, `src/index.ts`
- Optional override: `BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT`

The shared `sdkwork-appbase` auth surface also receives these values as development prefill defaults in `desktop-local` and `server-private`, so password login, email-code login, and phone-code login can all be exercised immediately without changing UI code or manually typing test credentials. `cloud-saas` can use the same prefill surface too: set `VITE_BIRDCODER_AUTH_DEV_DEFAULT_ACCOUNT`, `VITE_BIRDCODER_AUTH_DEV_DEFAULT_EMAIL`, `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PHONE`, and `VITE_BIRDCODER_AUTH_DEV_DEFAULT_PASSWORD` in your env file when you want a remote test account to be preloaded in development.

Seed behavior is fail-closed by deployment profile. `desktop-local` and `server-private` with `builtin-local` enable authority seed, auth-development seed, fixed local verification code, and starter workspace bootstrap. `server-private` with `external-user-center` and `cloud-saas` disable builtin-local authority seed instead of fabricating fallback local users, verification codes, or starter projects, so upstream configuration problems surface immediately during startup and governance checks.

If you need to inspect the final managed startup env before running a mode, use the root inspector command:

```bash
pnpm identity:show -- desktop-dev --identity-mode desktop-local
pnpm identity:show -- server-dev --identity-mode server-private
pnpm identity:show -- server-dev --identity-mode server-private --user-center-provider external-user-center
pnpm identity:show -- server-dev --identity-mode cloud-saas
```

The inspector prints the resolved `BIRDCODER_*` and `VITE_BIRDCODER_*` values with secret-like fields masked, so you can confirm sqlite paths, provider selection, remote API base URLs, dev quick-login defaults, local OAuth provider configuration, and cloud OAuth provider configuration before starting a host.

When you want the same canonical deployment profile plus readiness validation, use the doctor aliases:

```bash
pnpm identity:doctor:desktop:local
pnpm identity:doctor:web:private
pnpm identity:doctor:server:cloud
```

Doctor commands validate required env presence, resolved provider kind, effective API base URL, storage target, readiness endpoints, seed behavior, and development-prefill availability. Cloud and external-provider lanes fail closed when their upstream configuration is incomplete.

When you want one repeatable sample-app verification entrypoint instead of manually stepping through the identity matrix, run:

```bash
pnpm check:identity:sample
```

This command executes the standardized identity inspectors for desktop, web, and server targets across local, private, external-provider, and cloud lanes, then builds the web and server artifacts for private, external, and cloud deployment modes. If `BIRDCODER_USER_CENTER_APP_API_BASE_URL` is not already set, the cloud slice uses `https://app-api.example.com` as a deterministic placeholder so the command can validate BirdCoder's cloud wiring without requiring a live upstream authority during local governance checks.

For the standardized user-center surface, `desktop-local`, `server-private`, and `cloud-saas` all stay on the same BirdCoder routes. `desktop-local` and `server-private` expose password login, email-code login, phone-code login, local OAuth URL resolution, local OAuth login, verification-code delivery, registration, password reset, profile, and membership from the builtin-local authority. `cloud-saas` bridges the same contract to the upstream `sdkwork-cloud-app-api` authority, and BirdCoder can also switch the same facade to an `external-user-center` provider when a third-party identity gateway is required. QR login remains on the BirdCoder facade itself and completes through BirdCoder's own session-confirm flow, so frontend code does not need deployment-mode branches and the left QR rail stays stable across all modes.

BirdCoder enables `wechat`, `douyin`, and `github` as the default local OAuth provider sample set for `desktop-local` and `server-private`. These providers stay behind the canonical `/api/app/v1/auth/oauth/url` and `/api/app/v1/auth/oauth/login` facade and can be disabled or replaced through `BIRDCODER_LOCAL_OAUTH_PROVIDERS` plus provider-specific env overrides such as `BIRDCODER_LOCAL_OAUTH_GITHUB_NAME` or `BIRDCODER_LOCAL_OAUTH_WECHAT_EMAIL`.

## Common Commands

| Goal | Command | Notes |
| --- | --- | --- |
| Start the canonical local single-machine sample | `pnpm dev:local` or `pnpm desktop:dev:local` | Opens the Tauri desktop host with embedded coding server, local sqlite user center, seeded bootstrap data, and dev quick-login defaults |
| Start the canonical local single-machine sample as one managed stack | `pnpm stack:desktop:local` | Recommended reference entrypoint for the BirdCoder sample app when you want the local desktop host to remain the standard template |
| Start the default local private web sample stack | `pnpm dev` or `pnpm dev:private` | Starts the native BirdCoder server first, waits for `/api/core/v1/health` and `/api/app/v1/auth/config`, then boots the browser host with builtin-local quick-login defaults |
| Start web workspace against a private BirdCoder server with external identity | `pnpm dev:external` or `pnpm web:dev:external` | Keeps the same BirdCoder facade routes while switching the server provider to `external-user-center` |
| Start web workspace against a cloud-backed BirdCoder server | `pnpm dev:cloud` | Browser host uses the cloud-mode API base URL from env |
| Start the private BirdCoder web sample stack in one command | `pnpm stack:web:private` | Same managed server-plus-web stack as `pnpm dev`, kept as the explicit standardized alias for private browser-host onboarding |
| Start the external-provider BirdCoder web sample stack in one command | `pnpm stack:web:external` | Same stack orchestration, but binds the server to `external-user-center` |
| Start the cloud-backed BirdCoder web sample stack in one command | `pnpm stack:web:cloud` | Starts the local BirdCoder server in `cloud-saas` mode and then boots the web host; requires `BIRDCODER_USER_CENTER_APP_API_BASE_URL` |
| Start desktop host with embedded local auth | `pnpm tauri:dev` | Default desktop-local mode with embedded coding server, local sqlite user center, and dev quick-login defaults |
| Start desktop host against a private BirdCoder server | `pnpm tauri:dev:private` | Uses `BIRDCODER_API_BASE_URL` or defaults to `http://127.0.0.1:10240` |
| Start desktop host against an external-user-center BirdCoder server | `pnpm tauri:dev:external` or `pnpm desktop:dev:external` | Uses the private-server deployment lane with `external-user-center` provider binding |
| Start desktop host against a cloud-backed BirdCoder server | `pnpm tauri:dev:cloud` | Expects the target BirdCoder server to run with `sdkwork-cloud-app-api` integration |
| Start the private BirdCoder desktop sample stack in one command | `pnpm stack:desktop:private` | Starts the native BirdCoder server, waits for the canonical health and auth-config routes to succeed, and then launches the desktop host against the same resolved private identity env |
| Start the external-provider BirdCoder desktop sample stack in one command | `pnpm stack:desktop:external` | Same stack orchestration, but binds the BirdCoder server to `external-user-center` |
| Start the cloud-backed BirdCoder desktop sample stack in one command | `pnpm stack:desktop:cloud` | Starts the native BirdCoder server in `cloud-saas` mode and then launches the desktop host against it |
| Start desktop host through the explicit mode matrix | `pnpm desktop:dev:local`, `pnpm desktop:dev:private`, `pnpm desktop:dev:external`, `pnpm desktop:dev:cloud` | Preferred explicit commands for sample-app onboarding and operator docs |
| Start browser host through the explicit mode matrix | `pnpm web:dev:private`, `pnpm web:dev:external`, `pnpm web:dev:cloud` | Keeps browser-mode command naming aligned with desktop and server matrices |
| Start native server with local private auth | `pnpm server:dev` | Default server-private mode with local sqlite user center |
| Start native server with external-user-center auth | `pnpm server:dev:external` | Keeps the same BirdCoder auth facade but binds the server to the external bridge provider |
| Start native server through the explicit mode matrix | `pnpm server:dev:private`, `pnpm server:dev:external`, `pnpm server:dev:cloud` | Preferred explicit commands for private, external, and cloud integration validation |
| Start native server with cloud app-api identity | `pnpm server:dev:cloud` | Requires `BIRDCODER_USER_CENTER_APP_API_BASE_URL` |
| Inspect resolved identity env for any target/mode | `pnpm identity:show -- <target> --identity-mode <mode>` | Prints the managed BirdCoder env after `.env` loading and mode normalization |
| Inspect resolved identity env through the canonical alias matrix | `pnpm identity:show:desktop:local`, `pnpm identity:show:web:private`, `pnpm identity:show:server:cloud` | Thin aliases over the canonical env commands for operator docs and CI-friendly invocation |
| Validate identity env and deployment readiness through the canonical alias matrix | `pnpm identity:doctor:desktop:local`, `pnpm identity:doctor:web:private`, `pnpm identity:doctor:server:cloud` | Validates required env, provider kind, base URL, storage target, seed policy, and fast-login availability; remote lanes fail closed when upstream config is incomplete |
| Run BirdCoder identity governance against the canonical appbase contract | `pnpm check:identity-standard` | Verifies BirdCoder stays a thin wrapper over canonical auth UI, runtime bridge, command matrix, and plugin assembly |
| Verify the BirdCoder identity sample matrix | `pnpm check:identity:sample` | Runs the standardized identity inspectors plus private, external, and cloud web/server builds, defaulting the cloud sample to `https://app-api.example.com` when no explicit app-api base URL is configured |
| Build web bundle for private mode | `pnpm build` or `pnpm build:private` | Production browser bundle for private BirdCoder server integration |
| Build web bundle for external identity mode | `pnpm build:external` or `pnpm web:build:external` | Production browser bundle for the private-server deployment lane with external provider binding |
| Build web bundle for cloud mode | `pnpm build:cloud` | Production browser bundle for cloud identity integration |
| Build desktop package for local mode | `pnpm tauri:build` | Packages the desktop app for embedded local deployment |
| Build desktop package for private-server mode | `pnpm tauri:build:private` | Packages the desktop app to target an external BirdCoder server |
| Build desktop package for external-user-center mode | `pnpm tauri:build:external` or `pnpm desktop:build:external` | Packages the desktop app for a private BirdCoder server that delegates identity externally |
| Build desktop package for cloud mode | `pnpm tauri:build:cloud` | Packages the desktop app to target a cloud-backed BirdCoder server |
| Build through the explicit standardized matrix | `pnpm desktop:build:local`, `pnpm desktop:build:private`, `pnpm desktop:build:external`, `pnpm desktop:build:cloud`, `pnpm web:build:private`, `pnpm web:build:external`, `pnpm web:build:cloud`, `pnpm server:build:private`, `pnpm server:build:external`, `pnpm server:build:cloud` | Keeps CI, operator docs, and deployment naming aligned |
| Package desktop artifacts with explicit mode naming | `pnpm package:desktop:local`, `pnpm package:desktop:private`, `pnpm package:desktop:external`, `pnpm package:desktop:cloud` | Thin aliases over the standardized desktop build commands for release-oriented workflows |
| Package web artifacts with explicit mode naming | `pnpm package:web:private`, `pnpm package:web:external`, `pnpm package:web:cloud` | Thin aliases over the standardized web build commands for operator-facing packaging flows |
| Package server artifacts with explicit mode naming | `pnpm package:server:private`, `pnpm package:server:external`, `pnpm package:server:cloud` | Thin aliases over the standardized server build commands for private, external, and cloud deployment packaging |
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
- [Development](./docs/guide/development.md)
- [Architecture Overview](./docs/core/architecture.md)
- [Package Topology](./docs/core/packages.md)
- [Command Reference](./docs/reference/commands.md)
- [Release And Deployment](./docs/core/release-and-deployment.md)
- [Chinese Architecture Standards](./docs/架构/README.md)
- [Step Execution Matrix](./docs/step/README.md)

## Auth UI rule

BirdCoder is the sample integration for the shared auth surface. Its auth page must keep the QR panel on the left rail for login, registration, and forgot-password flows. The legacy left-side method cards are intentionally disallowed for this sample and must not be restored by later iterations. The supported QR contract for this sample is anchored on `/api/app/v1/auth/qr/generate` and `/api/app/v1/auth/qr/status/{qrKey}`, so the left rail stays bound to a real QR login capability instead of a placeholder layout.

The BirdCoder sample also treats the following routes as the canonical user-center surface contract for private and cloud-integrated deployments: `/api/app/v1/auth/login`, `/api/app/v1/auth/email/login`, `/api/app/v1/auth/phone/login`, `/api/app/v1/auth/oauth/url`, `/api/app/v1/auth/oauth/login`, `/api/app/v1/auth/register`, `/api/app/v1/auth/verify/send`, `/api/app/v1/auth/password/reset/request`, `/api/app/v1/auth/password/reset`, `/api/app/v1/auth/session`, `/api/app/v1/auth/session/exchange`, `/api/app/v1/auth/qr/generate`, `/api/app/v1/auth/qr/status/{qrKey}`, `/api/app/v1/user/profile`, and `/api/app/v1/vip/info`. Frontend integrations must stay on this contract so identity mode switches do not force UI rewrites.

When the desktop or web host is opened on a direct auth callback path such as `/auth/oauth/callback/:provider`, BirdCoder boots straight into the shared auth surface so OAuth return flows can complete without manual tab switching.

## Language Support

- The default entrypoint is this English `README.md`.
- The Simplified Chinese counterpart lives at [README.zh-CN.md](./README.zh-CN.md).
- Most operational docs are written in English, while the full architecture and Step standards are maintained in Chinese under [`docs/架构`](./docs/架构/) and [`docs/step`](./docs/step/).
