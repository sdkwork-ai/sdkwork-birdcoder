# Packages

BirdCoder uses the same package-first workspace approach as other SDKWork applications, with BirdCoder-specific product behavior isolated in product modules.

- Directory layer: `packages/sdkwork-birdcoder-*`
- Package manifest and import layer: `@sdkwork/birdcoder-*`
- Shared third-party version ownership: root `pnpm-workspace.yaml` `catalog`
- Enforced contract: `pnpm check:package-governance`

## Foundation Packages

- `@sdkwork/birdcoder-core`: runtime primitives and shared boot logic
- `@sdkwork/birdcoder-types`: shared contracts
- `@sdkwork/birdcoder-i18n`: i18n bootstrap and locale resources
- `@sdkwork/birdcoder-infrastructure`: service interfaces, runtime utilities, SDK-backed services
- `@sdkwork/birdcoder-ui-shell`: lightweight shell-safe UI primitives
- `@sdkwork/birdcoder-ui`: heavy workbench UI runtime surfaces
- `@sdkwork/birdcoder-commons`: React providers, hooks, event bus, composition helpers

## Host And Shell Packages

- `@sdkwork/birdcoder-shell`: unified application shell
- `@sdkwork/birdcoder-host-core`: host metadata and boundary contracts
- `@sdkwork/birdcoder-host-studio`: native host extension point aligned with SDKWork topology

## Delivery Packages

- `@sdkwork/birdcoder-web`: browser host
- `@sdkwork/birdcoder-desktop`: Tauri desktop host
- `@sdkwork/birdcoder-server`: native server host
- `@sdkwork/birdcoder-distribution`: release-profile and delivery metadata

## Business Packages

BirdCoder business modules stay product-specific and remain outside shared IAM ownership. The workspace keeps packages for chat, code, settings, templates, terminal, and skills, while `@sdkwork/birdcoder-auth` and `@sdkwork/birdcoder-user` form the BirdCoder-facing IAM surface for `auth`, `user`, and `vip` flows. `@sdkwork/birdcoder-auth` owns login-facing route contracts and shared auth UI entrypoints. `@sdkwork/birdcoder-user` owns user profile, membership, and user-facing pages. Both consume SDKWork IAM through generated app SDK clients and shared runtime services; neither package owns an app-local identity authority.

`check:iam-standard` protects those boundaries from drifting away from the canonical SDKWork IAM architecture.
