# Getting Started

SDKWork BirdCoder is a multi-surface coding workbench aligned with the SDKWork
application architecture and topology standards.

## Install Dependencies

```bash
pnpm install
```

## Start The Default Standalone Browser Topology

```bash
pnpm dev
```

## Select A Runtime Target

```bash
pnpm dev:browser:standalone
pnpm dev:desktop:standalone
pnpm dev:server:standalone
pnpm dev:browser:cloud
pnpm dev:desktop:cloud
```

The root commands delegate to `sdkwork-app`. `deploymentProfile` selects
`standalone` or `cloud`; `runtimeTarget` independently selects `browser`,
`desktop`, `server`, or another target declared in the topology contract. The
selection does not create another IAM, database, or session architecture.

Inspect the exact process and environment plan before startup:

```bash
pnpm topology:validate
pnpm topology:plan -- --deployment-profile standalone --environment development --runtime-target browser
pnpm topology:plan -- --deployment-profile standalone --environment development --runtime-target desktop
pnpm topology:plan -- --deployment-profile cloud --environment development --runtime-target browser
```

`cloud.development` requires explicit deployed endpoints and never substitutes
standalone loopback defaults.

## Useful Next Steps

- Read [Deployment Profiles And Runtime Targets](./application-modes.md)
- Review [Architecture](/core/architecture)
- Check [Release And Deployment](/core/release-and-deployment)
