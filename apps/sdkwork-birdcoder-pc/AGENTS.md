# SDKWork BirdCoder PC Application

<!-- SDKWORK-AGENTS-GENERATED: v1 -->

## SDKWORK Soul

Read `../../sdkwork-specs/SOUL.md` before executing tasks in this root. Follow specs before memory, dictionary before context, stop on ambiguity, and evidence before completion.

## SDKWORK Standards

Canonical SDKWORK specs path from this root:

- `../../sdkwork-specs/README.md`
- `../../sdkwork-specs/SOUL.md`
- `../../sdkwork-specs/AGENTS_SPEC.md`
- `../../sdkwork-specs/APP_PC_ARCHITECTURE_SPEC.md`
- `../../sdkwork-specs/APP_PC_REACT_UI_SPEC.md`
- `../../sdkwork-specs/DESKTOP_APP_ARCHITECTURE_SPEC.md`

Do not copy root standard text into this application. If these relative paths do not resolve, stop and report the broken workspace layout.

## Application Identity

This is the PC application root for sdkwork-birdcoder. It supports:
- Browser web mode (Vite dev server + production build)
- Desktop mode (Tauri native host)

Read `../../sdkwork.app.config.json` before changing application behavior.

## Local Dictionary Structure

- `src/`: Root shell entry (main.tsx, App.tsx, AuthGate.tsx, bootstrap/)
- `packages/`: All PC and shared packages
- `sdks/`: SDK families and generation manifests
- `specs/`: Component specs
- `config/`: Runtime config templates (browser/desktop/server/container)
- `scripts/`: App-specific build/validation scripts
- `tests/`: App-level integration tests
- `index.html`: Browser entry point
- `vite.config.ts`: Vite build configuration
- `tsconfig.json`: TypeScript configuration
- `Cargo.toml`: Rust workspace for server/desktop crates

## Spec Resolution Order

1. Read this `AGENTS.md` and any nearer component-level `AGENTS.md`.
2. Read `../../sdkwork.app.config.json` when present.
3. Read local `specs/README.md` and `specs/component.spec.json` when present.
4. Read `../../sdkwork-specs/README.md` and the task-specific root specs.
5. Inspect implementation files only after the relevant dictionary entries are clear.

## Build, Test, and Development

- `pnpm dev`: Start browser web dev server
- `pnpm build`: Build browser web production bundle
- `pnpm tauri:dev`: Start desktop Tauri dev mode
- `pnpm tauri:build`: Build desktop Tauri bundle
- `pnpm typecheck`: Run TypeScript type checks
- `pnpm lint`: Run lint and static checks
