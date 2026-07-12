# SDKWork BirdCoder Document App API Routes Specs

This directory is the module-local SDKWork spec system for the sdkwork-routes-document-app-api Rust crate.

Root SDKWork standards remain authoritative. This module spec records only the route-crate integration contract and does not copy root standard text.

## Component

| Field | Value |
| --- | --- |
| Name | sdkwork-routes-document-app-api |
| Type | rust-route-crate |
| Root | sdkwork-birdcoder/crates/sdkwork-routes-document-app-api |
| Domain | content |
| Capability | document |
| Surface | app-api |
| Layer role | backend-route |
| Languages | rust |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable contract.
- Package-root router export: sdkwork_routes_document_app_api::build_document_app_router.
- Package-root route-manifest export: sdkwork_routes_document_app_api::document_app_api_route_manifest; source anchor: src/manifest.rs#document_app_api_route_manifest.
- Required composition state port: sdkwork_routes_document_app_api::DocumentAppState. DocumentAppState carries DocumentService<SqliteDocumentRepository> and can be constructed from sqlx::AnyPool.

## Verification

- cargo test --offline --locked -p sdkwork-routes-document-app-api --lib -- --nocapture
- node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root crates/sdkwork-routes-document-app-api

