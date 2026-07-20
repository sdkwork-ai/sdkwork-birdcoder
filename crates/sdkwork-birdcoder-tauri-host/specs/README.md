# SDKWork BirdCoder Tauri Host Specs

This directory is the module-local SDKWork spec system for the `sdkwork-birdcoder-tauri-host` Rust crate.

Root SDKWork standards remain authoritative. This module spec records only the native host integration contract and does not copy root standard text.

## Component

| Field | Value |
| --- | --- |
| Name | `sdkwork-birdcoder-tauri-host` |
| Type | `tauri-host` |
| Root | `sdkwork-birdcoder/crates/sdkwork-birdcoder-tauri-host` |
| Domain | `device` |
| Capability | `tauri-host` |
| Surface | `native-host` |
| Languages | `rust` |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable contract.
- Public runtime integration is through `setup_tauri_host`, Tauri commands, and the embedded BirdCoder API startup helpers.
- The native host embeds `sdkwork-api-birdcoder-standalone-gateway` for local desktop API access; it does not own business HTTP routes and must not bypass sdkwork-agents for agent workflows.

## Verification

- `cargo test -p sdkwork-birdcoder-tauri-host`
- `node ../../../../sdkwork-specs/tools/check-component-port-bindings.mjs --root .`
