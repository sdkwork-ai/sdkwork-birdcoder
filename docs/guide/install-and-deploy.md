# Install And Deploy

BirdCoder separates local development from release packaging, but both paths use the same workspace sources and release scripts.

## Development

```bash
pnpm dev
pnpm dev:desktop:standalone
pnpm dev:server:standalone
pnpm dev:browser:cloud
pnpm topology:validate
```

These commands delegate to `sdkwork-app`; the selected deployment profile and
runtime target remain independent topology inputs.

## Release families

```bash
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
pnpm release:package:standalone
pnpm release:package:cloud
```

Target-family commands package a concrete delivery surface. Profile-family
commands use the application manifest and topology contract to select the
declared package set. For the full delivery contract, use
[Release And Deployment](/core/release-and-deployment).
