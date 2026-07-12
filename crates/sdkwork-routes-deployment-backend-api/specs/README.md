# SDKWork BirdCoder Deployment Backend API Routes Specs

This directory is the module-local SDKWork spec system for the sdkwork-routes-deployment-backend-api Rust crate.

Root SDKWork standards remain authoritative. This module spec records only the route-crate integration contract and does not copy root standard text.

## Component

| Field | Value |
| --- | --- |
| Name | sdkwork-routes-deployment-backend-api |
| Type | rust-route-crate |
| Root | sdkwork-birdcoder/crates/sdkwork-routes-deployment-backend-api |
| Domain | platform |
| Capability | deployment |
| Surface | backend-api |
| Layer role | backend-route |
| Languages | rust |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable contract.
- Package-root router export: sdkwork_routes_deployment_backend_api::build_deployment_backend_router.
- Package-root route-manifest export: sdkwork_routes_deployment_backend_api::deployment_backend_api_route_manifest; source anchor: src/manifest.rs#deployment_backend_api_route_manifest.
- Required composition state port: sdkwork_routes_deployment_backend_api::DeploymentBackendAppState. DeploymentBackendAppState carries DeploymentService and TeamService.

## Verification

- cargo test --offline --locked -p sdkwork-routes-deployment-backend-api --test handler_smoke -- --nocapture
- node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root crates/sdkwork-routes-deployment-backend-api

