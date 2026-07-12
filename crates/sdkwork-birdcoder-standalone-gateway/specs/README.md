# SDKWork BirdCoder Standalone Gateway Specs

This directory is the module-local SDKWork spec system for the `sdkwork-birdcoder-standalone-gateway` Rust crate.

Root SDKWork standards remain authoritative. This module spec records only the gateway integration contract and does not copy root standard text.

## Component

| Field | Value |
| --- | --- |
| Name | `sdkwork-birdcoder-standalone-gateway` |
| Type | `rust-standalone-gateway` |
| Root | `sdkwork-birdcoder/crates/sdkwork-birdcoder-standalone-gateway` |
| Domain | `platform` |
| Capability | `standalone-gateway` |
| Surface | `gateway-api` |
| Languages | `rust` |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable contract.
- Public runtime integration is through `sdkwork_birdcoder_standalone_gateway::bootstrap::build_app` and the binary `sdkwork-birdcoder-standalone-gateway`.
- The gateway mounts BirdCoder product routes, federated IAM routes, and sdkwork-agents app-api routes. BirdCoder agent behavior must remain behind sdkwork-agents and must not call sdkwork-kernel directly.

## Verification

- `cargo test -p sdkwork-birdcoder-standalone-gateway --test bootstrap_smoke -- --nocapture`
- `node ../../../../sdkwork-specs/tools/check-component-port-bindings.mjs --root .`
- `node ../../../../sdkwork-specs/tools/check-route-path-collisions.mjs --root .`
