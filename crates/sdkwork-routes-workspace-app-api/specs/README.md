# SDKWork BirdCoder Workspace App API Routes Specs

This directory is the module-local SDKWork spec system for the sdkwork-routes-workspace-app-api Rust crate.

Root SDKWork standards remain authoritative. This module spec records only the route-crate integration contract and does not copy root standard text.

## Component

| Field | Value |
| --- | --- |
| Name | sdkwork-routes-workspace-app-api |
| Type | rust-route-crate |
| Root | sdkwork-birdcoder/crates/sdkwork-routes-workspace-app-api |
| Domain | platform |
| Capability | workspace |
| Surface | app-api |
| Layer role | backend-route |
| Languages | rust |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable contract.
- Package-root router export: sdkwork_routes_workspace_app_api::build_workspace_app_router.
- Package-root route-manifest export: sdkwork_routes_workspace_app_api::workspace_app_api_route_manifest; source anchor: src/manifest.rs#workspace_app_api_route_manifest.
- Required composition state port: sdkwork_routes_workspace_app_api::WorkspaceAppState. WorkspaceAppState carries WorkspaceService, ProjectService, DeploymentService, TeamService, and WorkspaceRealtimeHub.

## Verification

- cargo test --offline --locked -p sdkwork-routes-workspace-app-api --test handler_smoke -- --nocapture
- node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root crates/sdkwork-routes-workspace-app-api

