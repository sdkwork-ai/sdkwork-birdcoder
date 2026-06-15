# Crates Directory

## Purpose
Rust crates, including route crates, service crates, repository crates, API server/service-host/native-host/Tauri-host/gateway/worker crates, and reusable Rust libraries.

## Owner
SDKWork Birdcoder team.

## Allowed Content
- Rust crates following SDKWork naming conventions:
  - `sdkwork-router-<capability>-<surface>/`
  - `sdkwork-<domain>-<capability>-service/`
  - `sdkwork-<domain>-<capability>-repository-sqlx/`
  - `sdkwork-<app>-api-server/`
  - `sdkwork-<app>-service-host/`
  - `sdkwork-<app>-native-host/`
  - `sdkwork-<app>-tauri-host/`
  - `sdkwork-<domain>-<capability>-worker/`
  - `sdkwork-<app>-gateway/`
- Cargo.toml workspace configuration
- Rust source code following RUST_CODE_SPEC.md

## Forbidden Content
- Non-Rust source code (unless explicitly documented)
- Generated SDK transport output
- Runtime secrets or credentials
- Temporary build artifacts (target/)

## Related Specs
- [RUST_CODE_SPEC.md](../sdkwork-specs/RUST_CODE_SPEC.md)
- [RUST_RPC_SPEC.md](../sdkwork-specs/RUST_RPC_SPEC.md)
- [NAMING_SPEC.md](../sdkwork-specs/NAMING_SPEC.md)
- [WEB_BACKEND_SPEC.md](../sdkwork-specs/WEB_BACKEND_SPEC.md)

## Verification
- [ ] All Rust crates follow SDKWork naming conventions
- [ ] No forbidden crate names (sdkwork-<app>-product, sdkwork-<app>-runtime, etc.)
- [ ] src/lib.rs is a module assembly and re-export boundary
- [ ] Crates are named by responsibility, not vague application tier

## Notes
Rust crates for sdkwork-birdcoder desktop/Tauri host should be placed here following the naming conventions.
