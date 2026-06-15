# SDKWork Birdcoder H5 Application

<!-- SDKWORK-AGENTS-GENERATED: v1 -->

## SDKWORK Soul

Read `../../sdkwork-specs/SOUL.md` before executing tasks in this root. Follow specs before memory, dictionary before context, stop on ambiguity, and evidence before completion.

## SDKWORK Standards

Canonical SDKWORK specs path from this root:

- `../../sdkwork-specs/README.md`
- `../../sdkwork-specs/SOUL.md`
- `../../sdkwork-specs/AGENTS_SPEC.md`
- `../../sdkwork-specs/APP_H5_ARCHITECTURE_SPEC.md`
- `../../sdkwork-specs/APP_MOBILE_REACT_UI_SPEC.md`

Do not copy root standard text into this application. If these relative paths do not resolve, stop and report the broken workspace layout.

## Application Identity

This is the H5 application root for sdkwork-birdcoder. It supports:
- H5 browser mode (Vite dev server + production build)
- Capacitor iOS/Android native mode

Read `sdkwork.app.config.json` before changing application behavior.

## Local Dictionary Structure

- `src/`: Root shell entry (main.tsx, App.tsx, AuthGate.tsx, bootstrap/)
- `packages/`: H5-specific packages
- `sdks/`: SDK families and generation manifests
- `specs/`: Component specs
- `config/`: Runtime config templates (browser/host/server/container)
- `scripts/`: App-specific build/validation scripts
- `tests/`: App-level integration tests
- `index.html`: Browser entry point
- `vite.config.ts`: Vite build configuration
- `tsconfig.json`: TypeScript configuration

## Spec Resolution Order

1. Read this `AGENTS.md` and any nearer component-level `AGENTS.md`.
2. Read `sdkwork.app.config.json` when present.
3. Read local `specs/README.md` and `specs/component.spec.json` when present.
4. Read `../../sdkwork-specs/README.md` and the task-specific root specs.
5. Inspect implementation files only after the relevant dictionary entries are clear.

## Build, Test, and Development

- `pnpm dev`: Start H5 browser dev server
- `pnpm build`: Build H5 browser production bundle
- `pnpm cap:sync`: Sync Capacitor native projects
- `pnpm cap:ios:build`: Build for iOS via Capacitor
- `pnpm cap:android:build`: Build for Android via Capacitor
- `pnpm typecheck`: Run TypeScript type checks
- `pnpm lint`: Run lint and static checks
