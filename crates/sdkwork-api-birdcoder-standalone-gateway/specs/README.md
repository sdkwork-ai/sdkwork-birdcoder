# SDKWork BirdCoder Standalone Gateway Specs

This directory is the module-local SDKWork spec system for the `sdkwork-api-birdcoder-standalone-gateway` Rust crate.

Root SDKWork standards remain authoritative. This module spec records only the gateway integration contract and does not copy root standard text.

## Component

| Field | Value |
| --- | --- |
| Name | `sdkwork-api-birdcoder-standalone-gateway` |
| Type | `rust-api-standalone-gateway` |
| Root | `crates/sdkwork-api-birdcoder-standalone-gateway` |
| Domain | `intelligence` |
| Capability | `api-gateway` |
| Surface | `gateway-api` |
| Languages | `rust` |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable contract.
- Public runtime integration is through `sdkwork_api_birdcoder_standalone_gateway::build_app` and the binary `sdkwork-api-birdcoder-standalone-gateway`.
- The gateway mounts BirdCoder-owned System routes, federated IAM routes, and sdkwork-agents app-api routes. BirdCoder agent behavior must remain behind sdkwork-agents and must not call sdkwork-kernel directly.
- `/healthz` and `/livez` report listener liveness. `/readyz` composes the readiness check supplied by the Agents application runtime and returns a client-safe `503` when that dependency is unavailable.

## Verification

- `cargo test -p sdkwork-api-birdcoder-standalone-gateway --test bootstrap_smoke -- --nocapture`
- `node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root .`
- `node ../sdkwork-specs/tools/check-route-path-collisions.mjs --root .`
