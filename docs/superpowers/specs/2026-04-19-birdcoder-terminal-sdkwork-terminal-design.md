# BirdCoder Terminal Full sdkwork-terminal Adoption Design

**Context**

`@sdkwork/birdcoder-terminal` still owns local launch/session glue even though BirdCoder already resolves the sibling `sdkwork-terminal` source tree directly. That leaves BirdCoder with terminal-specific page logic, local type bridges, and duplicated host orchestration that should belong to the terminal standard stack.

**Decision**

BirdCoder will stop implementing terminal behavior inside `@sdkwork/birdcoder-terminal`.

The terminal standard will be:

1. `@sdkwork/terminal-shell` owns the reusable desktop host surface that consumes launch intents, creates runtime sessions, and feeds `ShellApp`.
2. BirdCoder-specific request normalization lives in a shared BirdCoder terminal adapter under `@sdkwork/birdcoder-commons/terminal/*`.
3. `@sdkwork/birdcoder-terminal` becomes a thin facade that only composes BirdCoder preferences/toasts/Tauri bridge wiring with the standard `sdkwork-terminal` host surface.
4. Legacy BirdCoder terminal implementation files are removed, including the old `pages/*` layout and local `type-bridges/*`.

**Architecture**

The `sdkwork-terminal` source tree gets a new standard React surface component for desktop-integrated terminal hosting. It accepts:

- a runtime client
- an optional launch request
- a stable launch request key
- a launch-plan resolver
- host-level error callbacks
- an optional working-directory picker

The component owns request deduplication, session creation, and `DesktopSessionReattachIntent` state. `ShellApp` remains the rendered terminal UI.

BirdCoder keeps its app-specific concerns outside the terminal standard stack:

- workbench preference lookup
- toast presentation
- CLI profile availability and blocked-message policy
- mapping `TerminalCommandRequest` to terminal launch plans

Those concerns move to `@sdkwork/birdcoder-commons/terminal/sdkworkTerminalLaunch.ts`, so they are shared and testable without keeping page logic in `@sdkwork/birdcoder-terminal`.

**Data Flow**

1. BirdCoder emits a `TerminalCommandRequest`.
2. The thin BirdCoder terminal facade reads preferences and creates the desktop runtime client.
3. The facade passes the request into `DesktopTerminalSurface`.
4. `DesktopTerminalSurface` asks the BirdCoder resolver for a normalized launch plan.
5. The resolver either returns a blocked message or a standard local-shell/local-process plan.
6. `DesktopTerminalSurface` creates the runtime session and hands the resulting session attachment to `ShellApp`.

**Removal Scope**

The following BirdCoder terminal-local artifacts are deleted:

- `packages/sdkwork-birdcoder-terminal/src/pages/TerminalPage.tsx`
- `packages/sdkwork-birdcoder-terminal/src/pages/terminalRequestLaunch.ts`
- `packages/sdkwork-birdcoder-terminal/src/type-bridges/*`

The replacement package surface is a minimal `TerminalPage` facade plus a direct re-export entry.

**Verification**

The regression contract must assert:

- BirdCoder terminal package no longer keeps local page/launch/type-bridge implementation.
- BirdCoder terminal facade delegates to `DesktopTerminalSurface` from `@sdkwork/terminal-shell`.
- BirdCoder launch normalization lives under `@sdkwork/birdcoder-commons/terminal/*`.
- `sdkwork-terminal-shell` exports the reusable host surface.
- Existing desktop/runtime bridge and xterm compatibility constraints remain intact.
