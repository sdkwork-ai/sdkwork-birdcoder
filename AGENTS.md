# Repository Guidelines

<!-- SDKWORK-AGENTS-GENERATED: v1 -->

## SDKWORK Soul

Read `../sdkwork-specs/SOUL.md` before executing tasks in this root. Follow specs before memory, dictionary before context, stop on ambiguity, and evidence before completion.

## SDKWORK Standards

Canonical SDKWORK specs path from this root:

- `../sdkwork-specs/README.md`
- `../sdkwork-specs/SOUL.md`
- `../sdkwork-specs/AGENTS_SPEC.md`
- `../sdkwork-specs/CODE_STYLE_SPEC.md`
- `../sdkwork-specs/NAMING_SPEC.md`

Do not copy root standard text into this repository. If these relative paths do not resolve, stop and report the broken workspace layout.

## Application Identity

This is a multi-surface SDKWork application repository. Read `sdkwork.app.config.json` before changing application behavior, runtime config, SDK wiring, release metadata, or app-owned capabilities.

### Application Surfaces

| Surface | Root | Architecture Spec |
|---------|------|-------------------|
| PC (Desktop/Web) | `apps/sdkwork-birdcoder-pc/` | `APP_PC_ARCHITECTURE_SPEC.md` |
| H5 (Mobile Web/Capacitor) | `apps/sdkwork-birdcoder-h5/` | `APP_H5_ARCHITECTURE_SPEC.md` |
| Flutter Mobile | `apps/sdkwork-birdcoder-flutter-mobile/` | `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md` |

### Shared Packages

- `packages/sdkwork-birdcoder-*` — Cross-surface shared packages (13 packages)
- Each app root has its own surface-specific packages in `packages/`

## Local Dictionary Structure

- `AGENTS.md`: local agent entrypoint and relative SDKWORK spec index.
- `CLAUDE.md`: Claude Code compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `GEMINI.md`: Gemini CLI compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `CODEX.md`: Codex compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `sdkwork.app.config.json`: application identity and owned capability metadata.
- `.sdkwork/`: reserved local dictionary folder; create only for local skills, plugins, manifests, or AI workspace metadata.
- `specs/`: local application/component contracts and narrowing rules.
- `package.json`, `pnpm-workspace.yaml`: language/build manifests.
- `Cargo.toml`: Rust workspace configuration.
- `tsconfig.json`, `tsconfig.base.json`: TypeScript configuration.
- Local directories to inspect first when relevant: `apis/`, `apps/`, `configs/`, `crates/`, `deployments/`, `docs/`, `examples/`, `external/`, `jobs/`, `packages/`, `plugins/`, `scripts/`, `specs/`, `tests/`, `tools/`.

## Spec Resolution Order

1. Read this `AGENTS.md` and any nearer component-level `AGENTS.md`.
2. Read `sdkwork.app.config.json` when present.
3. Read local `specs/README.md` and `specs/component.spec.json` when present.
4. Read local `.sdkwork/README.md`, `.sdkwork/skills/`, and `.sdkwork/plugins/` when relevant.
5. Read `../sdkwork-specs/README.md` and the task-specific root specs.
6. Inspect implementation files only after the relevant dictionary entries are clear.

## Required Specs By Task Type

- Agent/workflow changes: `../sdkwork-specs/SOUL.md`, `../sdkwork-specs/AGENTS_SPEC.md`, `../sdkwork-specs/SDKWORK_WORKSPACE_SPEC.md`.
- Any code change: `../sdkwork-specs/CODE_STYLE_SPEC.md`, `../sdkwork-specs/NAMING_SPEC.md`, plus only the touched language/framework spec.
- Rust code: `../sdkwork-specs/RUST_CODE_SPEC.md` and `../sdkwork-specs/RUST_RPC_SPEC.md` when RPC is touched.
- Java/Spring code: `../sdkwork-specs/JAVA_CODE_SPEC.md` and `../sdkwork-specs/WEB_BACKEND_SPEC.md` when HTTP backend behavior is touched.
- TypeScript/Node code: `../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md`.
- Frontend/UI code: `../sdkwork-specs/FRONTEND_CODE_SPEC.md`, `../sdkwork-specs/FRONTEND_SPEC.md`, `../sdkwork-specs/UI_ARCHITECTURE_SPEC.md`, and exactly one detailed UI architecture spec.
- API, SDK, database, runtime, security, and deployment changes must follow the task matrix in `../sdkwork-specs/README.md`.

Language-specific specs are on-demand; do not load Rust, Java, TypeScript, and frontend specs for unrelated tasks.

## Code Style Rules

Read `../sdkwork-specs/CODE_STYLE_SPEC.md` and `../sdkwork-specs/NAMING_SPEC.md` before code changes.

Load language specs only when touched: Rust uses `RUST_CODE_SPEC.md`, Java/Spring uses `JAVA_CODE_SPEC.md`, TypeScript/Node uses `TYPESCRIPT_CODE_SPEC.md`, and frontend/UI uses `FRONTEND_CODE_SPEC.md`.

For TypeScript or frontend code, prefer strict types, explicit package exports, colocated tests, and existing package/module boundaries.

## Build, Test, and Verification

Run commands from this directory unless a command explicitly targets another path.

- `pnpm install`: install dependencies for this workspace or package.
- `pnpm run dev`: start the local development server or app shell.
- `pnpm run build`: build production artifacts or package outputs.
- `pnpm run lint`: run lint and static checks.
- `pnpm run typecheck`: run TypeScript type checks.
- `pnpm run check:arch`: run repository verification or architecture checks.
- `pnpm run check:package-governance`: run repository verification or architecture checks.
- `pnpm run preview`: serve built artifacts locally.
- `pnpm run build:cloud`: build production artifacts or package outputs.
- `pnpm run build:demo`: build production artifacts or package outputs.
- `pnpm run build:dev`: build production artifacts or package outputs.
- `pnpm run build:local`: build production artifacts or package outputs.
- `pnpm run build:private`: build production artifacts or package outputs.
- `pnpm run build:prod`: build production artifacts or package outputs.
- `pnpm run build:test`: build production artifacts or package outputs.
- `pnpm run check:api-transport-standard`: run repository verification or architecture checks.
- `pnpm run check:auth-session-standard`: run repository verification or architecture checks.
- `pnpm run check:ci-flow`: run repository verification or architecture checks.

Run the narrowest relevant check first, then broader verification when API contracts, SDK generation, persistence, security, or cross-package boundaries change.

## Agent Execution Rules

Use the convention dictionary instead of broad context loading. Do not hand-edit generated SDK output unless the task is explicitly about generated artifacts and the source contract is verified. Do not replace generated SDK integration with raw HTTP. Keep changes scoped to the owning module, package, crate, or app root. Record the exact verification commands and important outputs before reporting completion.

## Human Review Rules

Request human review before breaking SDKWORK standards, changing public naming, altering security/auth behavior, changing database migrations or production deployment config, deleting data/files, or changing generated SDK ownership. Surface unresolved spec paths, app identity conflicts, component ownership conflicts, and API authority ambiguity instead of guessing.

## Existing Local Guidance

The repository-specific guidance below was preserved from the previous `AGENTS.md`. If it conflicts with the SDKWORK sections above or with `../sdkwork-specs/`, the SDKWORK standards win.

### Project Structure & Module Organization
This workspace follows the SDKWork PC architecture standard. All PC-specific packages live in `apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-*` with package manifest names `@sdkwork/birdcoder-pc-*`. Foundational layers include `@sdkwork/birdcoder-pc-core`, `-pc-types`, `-pc-i18n`, `-pc-infrastructure`, `-pc-commons`, and `-pc-shell`. PC delivery targets include `@sdkwork/birdcoder-pc-web`, `-pc-desktop`, and `-pc-server`. PC product modules such as `@sdkwork/birdcoder-pc-code`, `-pc-studio`, `-pc-chat`, `-pc-skills`, `-pc-templates` keep BirdCoder PC business behavior isolated from the architecture shell. Deployment assets are in `deployments/`; release automation is in `scripts/release`; docs are in `docs/`.

### Build, Test, and Development Commands
- `pnpm install --frozen-lockfile` installs the workspace exactly as CI expects.
- `pnpm dev` runs the web host locally; `pnpm dev:test` starts the test-mode web host.
- `pnpm build` builds the shared workspace and web shell; `pnpm server:build` builds the Rust server host.
- `pnpm tauri:dev` and `pnpm tauri:build` run the desktop host.
- `pnpm lint` runs TypeScript, architecture, structure, CI, and release-flow checks.
- `pnpm check:package-governance` validates scoped package naming, internal `workspace:*` dependencies, and root-owned shared dependency versions.
- `pnpm check:desktop`, `pnpm check:server`, and `pnpm check:multi-mode` verify target-specific delivery layers.
- `pnpm docs:build` builds the VitePress documentation site.

### Coding Style & Naming Conventions
Use TypeScript with 2-space indentation and keep exports centered in each package `src/index.ts`. React components and providers use `PascalCase`; hooks and helpers use `camelCase`. Directory names stay on `sdkwork-birdcoder-*`, package manifest names and import specifiers use `@sdkwork/birdcoder-*`, internal workspace dependencies use `workspace:*`, and repeated third-party versions must be governed from the root `pnpm-workspace.yaml` `catalog` instead of being re-versioned per package. Prefer editing standardized package layers instead of adding new root-level glue. Keep deployment and release metadata explicit: `platform`, `arch`, and `accelerator` are required naming dimensions.

### Previous SDKWORK Standards Notes
Before changing domains, APIs, SDK contracts, database schemas, reusable modules, frontend UI/service logic, app manifests, IAM/auth/permission behavior, deployment/runtime configuration, external integrations, events, observability, performance, privacy, or generated-client integration, read the canonical standards in `../sdkwork-specs/README.md` and then the relevant spec files under `../sdkwork-specs/`. Local conventions may extend these standards but must not contradict them.

### Testing Guidelines
Contract tests are script-based and live in `scripts/*.test.mjs` and `scripts/release/*.test.mjs`. Add focused tests beside the release or architecture script you change. Before submitting work, run at least `pnpm lint`; for release or deployment changes also run `pnpm check:release-flow` and the relevant `pnpm release:smoke:*` command.

### Commit & Pull Request Guidelines
Use short imperative commits with scope, for example `fix release asset manifest layout` or `chore align ci flow`. Pull requests should summarize the changed architecture area, list touched packages or deployment layers, include the exact verification commands run, and attach screenshots only for UI-visible shell changes.

### Security & Configuration Tips
Keep secrets out of the repo. Use `.env.example` as the baseline, never commit real API keys, and prefer immutable container image tags or digests in release artifacts instead of mutable `latest` references.
