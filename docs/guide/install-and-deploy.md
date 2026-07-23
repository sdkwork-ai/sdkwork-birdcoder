# Install And Deploy

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev:browser:standalone
pnpm dev:desktop:standalone
pnpm dev:server:standalone
pnpm test:topology-validate
```

## Build

```bash
pnpm build:prod
pnpm build:desktop
pnpm build:server
```

## Governed Packages

```bash
pnpm release:package:desktop
pnpm release:package:web
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
```

The server families are stateless and must not add database or PC
device-state configuration. Follow
[Release And Deployment](../core/release-and-deployment.md) and
[Deployment Operations](../guides/operator/deployment-operations.md) before
promotion.
