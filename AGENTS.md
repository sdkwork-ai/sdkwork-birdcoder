# Repository Guidelines

<!-- SDKWORK-AGENTS-GENERATED: v1 -->

## SDKWORK Soul

Read `../sdkwork-specs/SOUL.md` before executing tasks in this root. Follow specs before memory, dictionary before context, stop on ambiguity, and evidence before completion.

## SDKWORK Standards


<!-- SDKWORK-PROGRESSIVE-LOADING: v1 -->
Resolve this standards root once and use it as the global authority for the current task:

- `../sdkwork-specs/README.md`
- `../sdkwork-specs/SOUL.md`
- `../sdkwork-specs/AGENTS_SPEC.md`

Read only the relevant README task-matrix row or navigation heading, then load the selected authority sections.
<!-- /SDKWORK-PROGRESSIVE-LOADING: v1 -->

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

- `packages/sdkwork-birdcoder-*` — Cross-surface shared contracts owned by this repository when a BirdCoder-owned capability requires them; no shared contract package is currently declared.
- Each app root has its own surface-specific packages in `packages/`
- Shared SDKWork platform packages (`sdkwork-iam`, `sdkwork-appbase`, `sdkwork-ui`, `sdkwork-core`, `sdkwork-utils`, etc.) are external workspace dependencies resolved through `pnpm-workspace.yaml`, not owned by this repository

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
- `etc/`: deployable-root source configuration, environment/profile index, topology profiles, gateway templates, and safe runtime examples governed by `SOURCE_CONFIG_SPEC.md`.
- Local directories to inspect first when relevant: `apis/`, `apps/`, `etc/`, `crates/`, `deployments/`, `docs/`, `examples/`, `external/`, `jobs/`, `plugins/`, `scripts/`, `specs/`, `tests/`, `tools/`.

## Documentation Canon

- [docs/README.md](docs/README.md)
- [docs/product/prd/PRD.md](docs/product/prd/PRD.md)
- [docs/architecture/tech/TECH_ARCHITECTURE.md](docs/architecture/tech/TECH_ARCHITECTURE.md)

## Spec Resolution Order


<!-- SDKWORK-PROGRESSIVE-LOADING: v1 -->
Use dynamic progressive loading for the current task: resolve the selected root and task category before reading broad source context.

1. Read this `AGENTS.md` routing material and classify the owned surface.
2. Read `sdkwork.app.config.json`, module `specs/`, repository/application `specs/`, and `.sdkwork/` only when the task reaches the contract each item governs.
3. Locate only the relevant task-matrix row or navigation heading in `../sdkwork-specs/README.md`; do not load the full catalog.
4. Read only the task-specific global spec sections selected by that route, then inspect implementation files.
<!-- /SDKWORK-PROGRESSIVE-LOADING: v1 -->

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

Build scripts, dev runners, and `pnpm clean` must follow `CODE_STYLE_SPEC.md` §7 (Build Source Integrity And Self-Healing). Git-tracked build-critical source files must be verified before builds and self-healed from git when missing; `clean` must not delete them.

## Build, Test, and Verification


<!-- SDKWORK-VERIFICATION-ROUTING: v1 -->
Choose only the narrowest verification selected by the changed surface. This is not a default full-suite command list.
Run workspace-wide checks only when the change crosses that boundary.
`bootstrap-*`, `align-*`, `sync-*`, `--write`, and other mutating repair commands are not verification defaults; use them only for an explicitly scoped repair, migration, bootstrap, or alignment task and inspect the resulting diff.
<!-- /SDKWORK-VERIFICATION-ROUTING: v1 -->

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


<!-- SDKWORK-PROGRESSIVE-LOADING: v1 -->
Use dynamic progressive loading for the current task; treat indexes and cross-references as discovery, not as a startup bundle.
Keep `../sdkwork-specs/SOUL.md` and the task-selected standards authoritative; expand context only when evidence exposes a new contract boundary.
Language-specific specs are on-demand: only the touched language loads `../sdkwork-specs/RUST_CODE_SPEC.md`, `../sdkwork-specs/JAVA_CODE_SPEC.md`, `../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md`, or `../sdkwork-specs/FRONTEND_CODE_SPEC.md`.
Package command standardization loads `../sdkwork-specs/PNPM_SCRIPT_SPEC.md` only when the current task changes package commands or scripts; GitHub packaging work loads `../sdkwork-specs/GITHUB_WORKFLOW_SPEC.md` only when it reaches that workflow boundary.
Do not infer a recursive workspace scan or a broad validation suite from the presence of a path alone.
<!-- /SDKWORK-PROGRESSIVE-LOADING: v1 -->

Use the convention dictionary instead of broad context loading. Do not hand-edit generated SDK output unless the task is explicitly about generated artifacts and the source contract is verified. Do not replace generated SDK integration with raw HTTP. Keep changes scoped to the owning module, package, crate, or app root. Record the exact verification commands and important outputs before reporting completion.

## Task-Specific Standards

API work loads `../sdkwork-specs/API_SPEC.md` and its validators. List/search work loads `../sdkwork-specs/PAGINATION_SPEC.md` and `check-pagination.mjs`. Source configuration work loads `../sdkwork-specs/SOURCE_CONFIG_SPEC.md` and `check-source-config-standard.mjs`. Link these authorities instead of copying their normative bodies into `AGENTS.md`.

## Human Review Rules

Request human review before breaking SDKWORK standards, changing public naming, altering security/auth behavior, changing database migrations or production deployment config, deleting data/files, or changing generated SDK ownership. Surface unresolved spec paths, app identity conflicts, component ownership conflicts, and API authority ambiguity instead of guessing.

## Additional Build Commands

- `pnpm install --frozen-lockfile`: install the workspace exactly as CI expects.
- `pnpm dev:test-runner`: start the test-mode web host.
- `pnpm build:server`: build the Rust server host.
- `pnpm dev:desktop` / `pnpm build:desktop`: run the desktop host.
- `pnpm check:desktop` / `pnpm check:server` / `pnpm check:multi-mode`: verify target-specific delivery layers.
- `pnpm docs:build`: build the VitePress documentation site.

## Testing

Contract tests are script-based and live in `scripts/*.test.mjs` and `scripts/release/*.test.mjs`. Add focused tests beside the release or architecture script you change. Before submitting work, run at least `pnpm lint`; for release or deployment changes also run `pnpm check:release-flow` and the relevant `pnpm release:smoke:*` command.

## Commit Guidelines

Use short imperative commits with scope, for example `fix release asset manifest layout` or `chore align ci flow`. Pull requests should summarize the changed architecture area, list touched packages or deployment layers, include the exact verification commands run, and attach screenshots only for UI-visible shell changes.
