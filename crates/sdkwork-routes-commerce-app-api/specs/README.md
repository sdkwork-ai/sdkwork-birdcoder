# SDKWork BirdCoder Commerce App API Routes Specs

This directory is the module-local SDKWork spec system for the sdkwork-routes-commerce-app-api Rust crate.

Root SDKWork standards remain authoritative. This module spec records only the route-crate integration contract and does not copy root standard text.

## Component

| Field | Value |
| --- | --- |
| Name | sdkwork-routes-commerce-app-api |
| Type | rust-route-crate |
| Root | sdkwork-birdcoder/crates/sdkwork-routes-commerce-app-api |
| Domain | commerce |
| Capability | commerce |
| Surface | app-api |
| Layer role | backend-route |
| Languages | rust |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable contract.
- Package-root router export: sdkwork_routes_commerce_app_api::build_commerce_app_router.
- Package-root route-manifest export: sdkwork_routes_commerce_app_api::commerce_app_api_route_manifest; source anchor: src/manifest.rs#commerce_app_api_route_manifest.
- Required composition state port: sdkwork_routes_commerce_app_api::CommerceAppState. CommerceAppState carries CommerceService<SqliteCommerceRepository> and can be constructed from sqlx::AnyPool.

## Verification

- cargo test --offline --locked -p sdkwork-routes-commerce-app-api --lib -- --nocapture
- node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root crates/sdkwork-routes-commerce-app-api

