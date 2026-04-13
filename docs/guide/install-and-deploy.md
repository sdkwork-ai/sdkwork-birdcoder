# Install And Deploy

BirdCoder separates local development from release packaging, but both paths use the same workspace sources and release scripts.

## Local development

```bash
pnpm dev
pnpm tauri:dev
pnpm server:dev
```

## Release families

```bash
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
```

For the full delivery contract, use [Release And Deployment](/core/release-and-deployment).
