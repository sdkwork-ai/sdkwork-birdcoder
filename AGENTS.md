# Repository Guidelines

## Project Structure & Module Organization
This workspace keeps the `packages/sdkwork-birdcoder-*` directory layout, but package manifest names now follow the scoped `@sdkwork/birdcoder-*` standard. Foundational layers live in `@sdkwork/birdcoder-core`, `-types`, `-i18n`, `-infrastructure`, `-commons`, and `-shell`. Delivery targets live in `@sdkwork/birdcoder-web`, `-desktop`, and `-server`. Product modules such as `@sdkwork/birdcoder-code`, `-studio`, `-terminal`, `-skills`, `-templates`, and `-appbase` keep BirdCoder business behavior isolated from the architecture shell. Deployment assets are in `deploy/docker` and `deploy/kubernetes`; release automation is in `scripts/release`; docs are in `docs/`.

## Build, Test, and Development Commands
- `pnpm install --frozen-lockfile` installs the workspace exactly as CI expects.
- `pnpm dev` runs the web host locally; `pnpm dev:test` starts the test-mode web host.
- `pnpm build` builds the shared workspace and web shell; `pnpm server:build` builds the Rust server host.
- `pnpm tauri:dev` and `pnpm tauri:build` run the desktop host.
- `pnpm lint` runs TypeScript, architecture, structure, CI, and release-flow checks.
- `pnpm check:package-governance` validates scoped package naming, internal `workspace:*` dependencies, and root-owned shared dependency versions.
- `pnpm check:desktop`, `pnpm check:server`, and `pnpm check:multi-mode` verify target-specific delivery layers.
- `pnpm docs:build` builds the VitePress documentation site.

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation and keep exports centered in each package `src/index.ts`. React components and providers use `PascalCase`; hooks and helpers use `camelCase`. Directory names stay on `sdkwork-birdcoder-*`, package manifest names and import specifiers use `@sdkwork/birdcoder-*`, internal workspace dependencies use `workspace:*`, and repeated third-party versions must be governed from the root `pnpm-workspace.yaml` `catalog` instead of being re-versioned per package. Prefer editing standardized package layers instead of adding new root-level glue. Keep deployment and release metadata explicit: `platform`, `arch`, and `accelerator` are required naming dimensions.

## Testing Guidelines
Contract tests are script-based and live in `scripts/*.test.mjs` and `scripts/release/*.test.mjs`. Add focused tests beside the release or architecture script you change. Before submitting work, run at least `pnpm lint`; for release or deployment changes also run `pnpm check:release-flow` and the relevant `pnpm release:smoke:*` command.

## Commit & Pull Request Guidelines
Use short imperative commits with scope, for example `fix release asset manifest layout` or `chore align ci flow`. Pull requests should summarize the changed architecture area, list touched packages or deployment layers, include the exact verification commands run, and attach screenshots only for UI-visible shell changes.

## Security & Configuration Tips
Keep secrets out of the repo. Use `.env.example` as the baseline, never commit real API keys, and prefer immutable container image tags or digests in release artifacts instead of mutable `latest` references.
