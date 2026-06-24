> Migrated from `docs/guide/getting-started.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Getting Started

SDKWork BirdCoder is a package-first AI IDE workspace aligned with the SDKWork application architecture standard.

## Install Dependencies

```bash
pnpm install
```

## Start The Default Local Web Sample Stack

```bash
pnpm dev
```

## Start The Canonical Sample Modes

```bash
pnpm dev:local
pnpm dev:cloud
pnpm tauri:dev
pnpm server:dev
pnpm server:dev:cloud
```

BirdCoder keeps one frontend-facing SDKWork IAM facade while switching deployment mode underneath it:

- `pnpm dev:local` or `pnpm tauri:dev` for the desktop-local sample with local SDKWork IAM storage
- `pnpm dev`, `pnpm dev:private`, or `pnpm stack:web:private` for the private BirdCoder web sample stack with automatic server startup
- `pnpm dev:cloud` or `pnpm server:dev:cloud` for the cloud-backed SDKWork IAM lane

When the resolved startup env needs inspection before running a mode, use:

```bash
pnpm iam:show:desktop:local
pnpm iam:show:server:private
pnpm iam:show:server:cloud
```

## Useful Next Steps

- Read [Application Modes](./application-modes.md)
- Review [Architecture](/core/architecture)
- Check [Release And Deployment](/core/release-and-deployment)

