# Getting Started

SDKWork BirdCoder is a package-first AI IDE workspace aligned with the Claw Studio architecture standard.

## Install dependencies

```bash
pnpm install
```

## Start the default local web sample stack

```bash
pnpm dev
```

## Start the canonical sample modes

```bash
pnpm dev:local
pnpm dev:external
pnpm dev:cloud
pnpm tauri:dev
pnpm tauri:dev:external
pnpm server:dev
pnpm server:dev:external
pnpm server:dev:cloud
```

BirdCoder keeps one frontend-facing auth facade while switching deployment and provider authority underneath it:

- `pnpm dev:local` or `pnpm tauri:dev` for the local single-machine sample with builtin local user center
- `pnpm dev`, `pnpm dev:private`, or `pnpm stack:web:private` for the private BirdCoder web sample stack with builtin local authority, default dev account prefill, and automatic server startup
- `pnpm dev:external` or `pnpm server:dev:external` for a private BirdCoder server that delegates identity to `external-user-center`
- `pnpm dev:cloud` or `pnpm server:dev:cloud` for a BirdCoder server that delegates identity to `sdkwork-cloud-app-api`

When you need to inspect the resolved startup env before running a mode, use:

```bash
pnpm identity:show:desktop:local
pnpm identity:show:server:private
pnpm identity:show:server:external
pnpm identity:show:server:cloud
```

## Useful next steps

- Read [Application Modes](./application-modes.md)
- Review [Architecture](/core/architecture)
- Check [Release And Deployment](/core/release-and-deployment)
