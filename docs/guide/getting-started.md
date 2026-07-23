# Getting Started

The current development scope is the Rust backend and PC browser/Tauri
application.

## Prerequisites

- Node.js and `pnpm` 10
- Rust and Cargo
- Tauri platform prerequisites for desktop development

## Install

```bash
pnpm install --frozen-lockfile
```

Sibling SDKWork repositories referenced by `pnpm-workspace.yaml` must resolve
from the same workspace root.

## Run

```bash
pnpm dev:browser:standalone
pnpm dev:desktop:standalone
pnpm dev:server:standalone
```

Inspect topology before starting a non-default target:

```bash
pnpm test:topology-validate
pnpm topology:plan -- --deployment-profile standalone --environment development --runtime-target desktop
```

Runtime selection changes process placement and endpoints, not domain
ownership. Project and Session remain Agents facts and the BirdCoder gateway
remains stateless.

## Next Steps

- [Development](development.md)
- [Deployment profiles and runtime targets](application-modes.md)
- [Technical architecture](../architecture/tech/TECH_ARCHITECTURE.md)
- [Desktop runtime](../core/desktop.md)
