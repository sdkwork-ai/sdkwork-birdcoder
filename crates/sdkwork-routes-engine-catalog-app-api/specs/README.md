# SDKWork BirdCoder Engine Catalog App API Routes Specs

This directory is the module-local SDKWork spec system for the sdkwork-routes-engine-catalog-app-api Rust crate.

Root SDKWork standards remain authoritative. This module spec records only the route-crate integration contract and does not copy root standard text.

## Component

| Field | Value |
| --- | --- |
| Name | sdkwork-routes-engine-catalog-app-api |
| Type | rust-route-crate |
| Root | sdkwork-birdcoder/crates/sdkwork-routes-engine-catalog-app-api |
| Domain | runtime |
| Capability | engine-catalog |
| Surface | app-api |
| Layer role | backend-route |
| Languages | rust |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable contract.
- Package-root router export: sdkwork_routes_engine_catalog_app_api::build_engine_catalog_app_router.
- Package-root route-manifest export: sdkwork_routes_engine_catalog_app_api::engine_catalog_app_api_route_manifest; source anchor: src/manifest.rs#engine_catalog_app_api_route_manifest.
- Required composition state port: sdkwork_routes_engine_catalog_app_api::EngineCatalogAppState. EngineCatalogAppState carries EngineCatalogService<RealEngineCatalogProvider>.

## Pagination Boundaries

- Engine, model, and native-session-provider catalogs come from the immutable build-time catalog loaded through `OnceLock`. `EngineCatalogService` enforces `MAX_BOUNDED_CATALOG_ITEMS = 100`, so these three endpoints use the bounded-collection exception in `PAGINATION_SPEC.md` section 11.
- Coding sessions are owned by the intelligence coding-session API. Provider-native history discovery remains an internal service concern and is not exposed by this route crate.

## Verification

- cargo test --offline --locked -p sdkwork-routes-engine-catalog-app-api --lib -- --nocapture
- node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root crates/sdkwork-routes-engine-catalog-app-api
