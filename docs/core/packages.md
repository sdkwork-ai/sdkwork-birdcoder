# Packages

BirdCoder uses the same package-first workspace approach as Claw Studio, with BirdCoder-specific product behavior.

- Directory layer: `packages/sdkwork-birdcoder-*`
- Package manifest and import layer: `@sdkwork/birdcoder-*`
- Shared third-party version ownership: root `pnpm-workspace.yaml` `catalog`
- Enforced contract: `pnpm check:package-governance`

## Foundation packages

- `@sdkwork/birdcoder-core`: runtime primitives and shared boot logic
- `@sdkwork/birdcoder-types`: shared contracts
- `@sdkwork/birdcoder-i18n`: i18n bootstrap and locale resources
- `@sdkwork/birdcoder-infrastructure`: service interfaces, mock implementations, runtime utilities
- `@sdkwork/birdcoder-ui`: shared UI building blocks
- `@sdkwork/birdcoder-commons`: React providers, hooks, event bus, composition helpers

## Host and shell packages

- `@sdkwork/birdcoder-shell`: unified application shell
- `@sdkwork/birdcoder-host-core`: host metadata and boundary contracts
- `@sdkwork/birdcoder-host-studio`: native host extension point aligned with Claw topology

## Delivery packages

- `@sdkwork/birdcoder-web`: browser host
- `@sdkwork/birdcoder-desktop`: Tauri desktop host
- `@sdkwork/birdcoder-server`: native server host
- `@sdkwork/birdcoder-distribution`: release-profile and delivery metadata

## Business packages

BirdCoder business modules stay product-specific and remain outside the Claw feature set. The current workspace keeps packages for chat, code, settings, templates, terminal, and skills, while `@sdkwork/birdcoder-appbase` becomes the single BirdCoder bridge for appbase-aligned `auth`, `user`, and `vip` capability flows. That bridge is not page-only: it owns the shared catalog, registry, appbase manifest, per-capability workspace manifest, package meta, route intent, and storage-key standards, and `check:appbase-parity` protects those boundaries from drifting away from the sibling `sdkwork-appbase` reference architecture.
