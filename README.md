# SDKWork BirdCoder
repository-kind: application

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
- `@sdkwork/birdcoder-pc-workbench` — PC commons
- `@sdkwork/birdcoder-pc-shell` — PC shell
- `@sdkwork/birdcoder-pc-contracts-commons` — PC types
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
- ... (36 total PC packages)

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

### Repository-Level Shared Packages

The repository root `packages/` directory holds cross-surface shared contracts that are owned by this repository. As of the current release, the only repository-root shared package is:

- `@sdkwork/birdcoder-chat-contracts` — Cross-surface chat contracts shared by PC, H5, and Flutter surfaces

> Manifest honesty note: All `@sdkwork/birdcoder-*` product modules (auth, user, iam, chat adapters, settings, skills, templates, code, studio, distribution, etc.) live under their respective surface roots (`apps/sdkwork-birdcoder-pc/packages/`, `apps/sdkwork-birdcoder-h5/packages/`, `apps/sdkwork-birdcoder-flutter-mobile/packages/`) and are NOT duplicated at the repository root. Shared SDKWork platform packages (sdkwork-iam, sdkwork-appbase, sdkwork-ui, sdkwork-core, sdkwork-utils, etc.) are external workspace dependencies resolved through `pnpm-workspace.yaml` and are not part of this repository's owned package surface.

### Repository-Level Assets

- [`docs/`](./docs/) for architecture, steps, prompts, release notes, and operator guidance
- [`scripts/`](./scripts/) for verification, release orchestration, code generation, and governance automation
- [`deployments/docker`](./deployments/docker/) for Docker delivery assets
- [`deployments/kubernetes`](./deployments/kubernetes/) for Helm-compatible Kubernetes delivery assets
- [`external/`](./external/) for engine source mirrors and protocol references used by integration work

## Prerequisites

- Node.js
- `pnpm` 10
- Rust and Cargo when working on desktop or native server hosts
- Docker if you need container packaging, local PostgreSQL smoke, or deployment-oriented verification

### SDKWork Platform Workspace Federation

BirdCoder follows the SDKWork workspace-federation model. The repository consumes shared SDKWork platform packages (IAM, appbase, UI, core, search, terminal, drive, messaging, models, sdk-commons, utils) from sibling monorepos via `pnpm-workspace.yaml` `../sdkwork-*` relative path globs rather than published npm packages.

For a complete end-to-end build, clone all required SDKWork platform repositories as siblings of this directory:

```
sdkwork-space/
├── sdkwork-birdcoder/         <- this repository
├── sdkwork-iam/               # IAM runtime, contracts, SDK, auth/user PC
├── sdkwork-appbase/           # Application base runtime + i18n for PC React
├── sdkwork-core/              # Core PC React runtime
├── sdkwork-ui/                # UI component library for PC React
├── sdkwork-search/            # Search contracts + PC React foundation
├── sdkwork-terminal/          # Terminal PC packages + runtime SDK
├── sdkwork-drive/             # Drive app SDK
├── sdkwork-messaging/         # Messaging app SDK
├── sdkwork-models/            # Models SDK
├── sdkwork-sdk-commons/       # Common TypeScript SDK utilities
└── sdkwork-utils/             # Shared utilities
```

CI handles the full federation automatically by checking out all required platform repositories before running `pnpm install --frozen-lockfile`. See `.github/workflows/ci.yml` for the canonical checkout order.

For read-only source inspection without building, you can comment out the external `../sdkwork-*` entries in `pnpm-workspace.yaml`; TypeScript type resolution and `pnpm install` will then fail for any package that imports `@sdkwork/iam-*`, `@sdkwork/appbase-*`, `@sdkwork/ui`, `@sdkwork/core`, `@sdkwork/search-*`, `@sdkwork/terminal-*`, `@sdkwork/drive-*`, `@sdkwork/messaging-*`, `@sdkwork/models-*`, `@sdkwork/sdk-commons`, or `@sdkwork/utils`. Use this mode only for source reading.

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
pnpm dev:desktop:local
pnpm dev:browser:postgres:standalone
pnpm dev:browser:cloud
pnpm dev:desktop
pnpm dev:desktop:standalone
pnpm dev:desktop:cloud
pnpm dev:server:postgres:standalone
pnpm dev:server:standalone
pnpm dev:server:cloud
pnpm dev:desktop:local
pnpm dev:desktop:standalone
pnpm dev:desktop:cloud
pnpm dev:browser:standalone
pnpm dev:browser:cloud
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
| `desktop-local` | `pnpm dev:desktop` or `pnpm dev:desktop:local` | N/A | `local` | Embedded BirdCoder coding server with local SDKWork IAM |
| `server-private` | `pnpm dev:desktop:standalone` | `pnpm dev:server:postgres:standalone` or `pnpm dev:server:standalone` | `private` | Private BirdCoder server with local SDKWork IAM |
| `cloud-saas` | `pnpm dev:desktop:cloud` | `pnpm dev:server:cloud` | `saas` | BirdCoder server backed by SDKWork cloud app-api IAM |

The wrappers load `.env`, `.env.local`, `.env.development`, `.env.development.local`, `.env.production`, and `.env.production.local` through Vite's env loader, then apply mode-specific defaults for sqlite, remote API base URL, SDKWork IAM mode, OAuth sample providers, and dev-only quick-login hints. The managed public client values are `VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE` and `VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET`, and the server-facing value is `SDKWORK_IAM_MODE`.

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
pnpm check:env:desktop:local -- desktop-dev --iam-mode desktop-local
pnpm check:env:desktop:local -- server-dev --iam-mode server-private
pnpm check:env:desktop:local -- server-dev --iam-mode cloud-saas
```

The inspector prints resolved `BIRDCODER_*`, `VITE_BIRDCODER_*`, `SDKWORK_IAM_*`, `VITE_SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE`, and `VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET` values with secret-like fields masked, so you can confirm sqlite paths, API base URLs, dev quick-login defaults, OAuth sample provider configuration, and cloud app-api configuration before starting a host.

When you want the same canonical deployment profile plus readiness validation, use the doctor aliases:

```bash
pnpm check:iam:desktop:local
pnpm check:iam:browser:standalone
pnpm check:iam:server:cloud
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
| Start the local single-machine desktop sample | `pnpm dev:desktop:local` or `pnpm dev:desktop:local` | Opens the Tauri desktop host with embedded coding server, local SDKWork IAM, seeded bootstrap data, and dev quick-login defaults |
| Start the private web sample stack | `pnpm dev` or `pnpm dev:browser:postgres:standalone` | Starts the native BirdCoder server first, waits for `/app/v3/api/system/health` and IAM config routes, then boots the browser host |
| Start web workspace against cloud-backed IAM | `pnpm dev:browser:cloud` | Browser host uses the cloud-mode API base URL from env |
| Start the private BirdCoder web sample stack in one command | `pnpm dev:browser:standalone` | Managed server-plus-web stack for private browser-host onboarding |
| Start the cloud-backed BirdCoder web sample stack in one command | `pnpm dev:browser:cloud` | Starts the local BirdCoder server in `cloud-saas` mode and then boots the web host; requires or defaults `SDKWORK_IAM_APP_API_BASE_URL` for sample checks |
| Start desktop host with embedded local IAM | `pnpm dev:desktop` | Default `desktop-local` mode with embedded coding server, local SDKWork IAM, and dev quick-login defaults |
| Start desktop host against a private BirdCoder server | `pnpm dev:desktop:standalone` | Uses `BIRDCODER_API_BASE_URL` or defaults to `http://127.0.0.1:10240` |
| Start desktop host against cloud-backed IAM | `pnpm dev:desktop:cloud` | Expects the target BirdCoder server to run with SDKWork cloud app-api IAM integration |
| Start the private BirdCoder desktop sample stack | `pnpm dev:desktop:standalone` | Starts the native BirdCoder server and then launches the desktop host against it |
| Start the cloud-backed BirdCoder desktop sample stack | `pnpm dev:desktop:cloud` | Starts the native BirdCoder server in `cloud-saas` mode and then launches the desktop host against it |
| Start native server with private IAM | `pnpm dev:server:postgres:standalone` or `pnpm dev:server:standalone` | Default server-private mode with local SDKWork IAM |
| Start native server with cloud app-api IAM | `pnpm dev:server:cloud` | Requires or defaults `SDKWORK_IAM_APP_API_BASE_URL` for sample checks |
| Inspect resolved IAM env for any target/mode | `pnpm check:env:desktop:local -- <target> --iam-mode <mode>` | Prints managed BirdCoder env after `.env` loading and mode normalization |
| Validate IAM env and deployment readiness | `pnpm check:iam:desktop:local`, `pnpm check:iam:browser:standalone`, `pnpm check:iam:server:cloud` | Validates required env, base URL, storage target, seed policy, and quick-login availability |
| Run BirdCoder IAM governance | `pnpm check:iam-standard` | Verifies BirdCoder stays on standard SDKWork IAM runtime, auth UI, generated SDK, command matrix, and package boundaries |
| Verify the BirdCoder IAM sample matrix | `pnpm check:iam:sample` | Runs IAM inspectors plus private/cloud web/server builds |
| Build web bundle for private mode | `pnpm build` or `pnpm build:private` | Production browser bundle for private BirdCoder server integration |
| Build web bundle for cloud mode | `pnpm build:cloud` | Production browser bundle for cloud IAM integration |
| Build desktop package for local mode | `pnpm build:desktop` | Packages the desktop app for embedded local deployment |
| Build desktop package for private-server mode | `pnpm build:desktop:standalone` | Packages the desktop app to target an external BirdCoder server |
| Build desktop package for cloud mode | `pnpm build:desktop:cloud` | Packages the desktop app to target a cloud-backed BirdCoder server |
| Build docs site | `pnpm docs:build` | Builds the VitePress documentation site |
| Run repository baseline verification | `pnpm lint` | Main pre-commit and pre-push verification baseline |
| Verify package governance | `pnpm check:package-governance` | Guards scoped package names and workspace dependency ownership |
| Verify cross-host delivery | `pnpm check:multi-mode` | Aggregates desktop, server, and release-flow checks |
| Generate quality execution evidence | `pnpm check:quality-execution-report` | Writes `artifacts/quality/quality-gate-execution-report.json` |
| Build native server release bundle | `pnpm build:server` | Runs the governed server build wrapper |

## Quality And Governance

BirdCoder treats documentation and release behavior as executable contracts, not passive references.

- `pnpm lint` runs TypeScript checks plus the repository's current architecture, governance, prompt, IAM, SDK, and release-flow contract set.
- `pnpm check:quality:fast`, `pnpm check:quality:standard`, and `pnpm check:quality:release` define the stepped quality tiers.
- `pnpm check:quality-report` and `pnpm check:quality-execution-report` archive machine-readable evidence under `artifacts/quality/`.
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

## Release Governance And Supply-Chain

`.github/workflows/release-governance.yml` is the dedicated supply-chain governance workflow that satisfies `sdkwork.app.config.json` security policy (`checksumRequired`, `signatureRequired`, `sbomRequired`). It follows `sdkwork-specs/RELEASE_SPEC.md` and `sdkwork-specs/SUPPLY_CHAIN_SECURITY_SPEC.md` and runs alongside the thin `.github/workflows/package.yml` reusable packaging call.

The governance workflow produces:

- **SBOM** — SPDX SBOMs via `anchore/sbom-action` for server, PC, and H5 surfaces plus CycloneDX for Rust crates and `pnpm`/`npm` SBOM for the frontend workspace. Artifacts: `artifacts/sbom/birdcoder-server.spdx.json`, `birdcoder-pc.spdx.json`, `birdcoder-h5.spdx.json`.
- **Cosign image signing** — keyless signing of the container image via the GitHub OIDC token (`COSIGN_EXPERIMENTAL=1`, no cosign key required), followed by signature verification.
- **Trivy security scanning** — filesystem and container image scans at `CRITICAL,HIGH` severity, with SARIF results uploaded to the GitHub Security tab.
- **Checksums** — SHA256 files for every release asset, attached to the GitHub Release.

### macOS Codesign And Notarization

The macOS codesign/notarize job is **opt-in**. Enable it by setting the repository variable `APPLE_SIGNING_ENABLED=true` and configuring the GitHub Secrets below. When disabled, the job is skipped so CI stays green for platforms that do not require macOS signing.

Required GitHub Secrets for macOS signing:

| Secret | Purpose |
| --- | --- |
| `APPLE_DEVID_CERT` | Base64-encoded Developer ID Application `.p12` certificate imported via `apple-actions/import-codesign-certs@v3`. |
| `APPLE_DEVID_CERT_PASSWORD` | Password for the `.p12` certificate above. |
| `APPLE_SIGN_IDENTITY` | Optional. Code-signing identity name (defaults to `Developer ID Application`). |
| `APPLE_ID` | Apple ID used for `xcrun notarytool submit` (an app-specific password account). |
| `APPLE_PASSWORD` | App-specific password for notarization (`xcrun notarytool`). |
| `APPLE_TEAM_ID` | Apple Developer Team ID for notarization. |

The job imports the certificates, builds the desktop bundle via `pnpm build:desktop`, deep-signs the `.app` and `.dmg` with hardened runtime (`codesign --deep --force --options runtime`), submits the `.dmg` to Apple notarization with `xcrun notarytool submit --wait`, and staples the ticket. Signing credentials live only in protected CI secrets; they are never committed to source.

### Cosign And Container Signing

Container images are signed keyless using the GitHub OIDC token. No `COSIGN_PRIVATE_KEY` is required for the default path; the `cosign sign --key env://` form is supported as an alternative when a cosign key is materialized from environment variables. Verification pins the certificate issuer to `https://token.actions.githubusercontent.com` and the GitHub Actions workflow identity.

## Documentation Map

- [Getting Started](./docs/guide/getting-started.md)
- [Application Modes](./docs/guide/application-modes.md)
- [Development](./docs/guide/development.md)
- [Architecture Overview](./docs/core/architecture.md)
- [Package Topology](./docs/core/packages.md)
- [Command Reference](./docs/reference/commands.md)
- [Release And Deployment](./docs/core/release-and-deployment.md)
- Migrated Chinese Architecture Standards — see [`docs/archive/migrated-legacy/架构/README.md`](./docs/archive/migrated-legacy/架构/README.md)
- Migrated Step Execution Matrix — see [`docs/archive/migrated-legacy/step/README.md`](./docs/archive/migrated-legacy/step/README.md)

## Auth UI Rule

BirdCoder is the sample integration for the shared SDKWork IAM auth surface. Its auth page must keep the QR panel on the left rail for login, registration, and forgot-password flows. The supported QR contract is anchored on `/app/v3/api/auth/qr_login_codes` and `/app/v3/api/auth/qr_login_codes/{qrKey}`, so the left rail stays bound to a real QR login capability instead of a placeholder layout.

When the desktop or web host is opened on a direct auth callback path such as `/auth/oauth/callback/:provider`, BirdCoder boots straight into the shared auth surface so OAuth return flows can complete without manual tab switching.

## Language Support

- The default entrypoint is this English `README.md`.
- The Simplified Chinese counterpart lives at [README.zh-CN.md](./README.zh-CN.md).
- Most operational docs are written in English, while the full architecture and Step standards are maintained in Chinese under [`docs/archive/migrated-legacy/架构`](./docs/archive/migrated-legacy/架构) and [`docs/archive/migrated-legacy/step`](./docs/archive/migrated-legacy/step/).

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

## Application Roots

- [apps directory index](apps/README.md)
