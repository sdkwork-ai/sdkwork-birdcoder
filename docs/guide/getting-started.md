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
pnpm dev:desktop:local
pnpm dev:browser:postgres:cloud
pnpm dev:desktop
pnpm dev:server:postgres:standalone
pnpm dev:server:cloud
```

BirdCoder keeps one frontend-facing SDKWork IAM facade while switching deployment mode underneath it:

- `pnpm dev:desktop:local` or `pnpm dev:desktop` for the desktop-local sample with local SDKWork IAM storage
- `pnpm dev`, `pnpm dev:browser:postgres:standalone`, or `pnpm dev:browser:standalone` for the private BirdCoder web sample stack with automatic server startup
- `pnpm dev:browser:postgres:cloud` or `pnpm dev:server:cloud` for the cloud-backed SDKWork IAM lane

When the resolved startup env needs inspection before running a mode, use:

```bash
pnpm check:env:desktop:local
pnpm check:env:server:standalone
pnpm check:env:server:cloud
```

## Useful Next Steps

- Read [Application Modes](./application-modes.md)
- Review [Architecture](/core/architecture)
- Check [Release And Deployment](/core/release-and-deployment)
