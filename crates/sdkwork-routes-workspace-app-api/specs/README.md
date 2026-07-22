# SDKWork BirdCoder Workspace App API Routes Specs

This directory is the module-local SDKWork spec system for the sdkwork-routes-workspace-app-api Rust crate.

Root SDKWork standards remain authoritative. This module spec records only the route-crate integration contract and does not copy root standard text.

## Component

| Field | Value |
| --- | --- |
| Name | sdkwork-routes-workspace-app-api |
| Type | rust-route-crate |
| Root | sdkwork-birdcoder/crates/sdkwork-routes-workspace-app-api |
| Domain | intelligence |
| Capability | coding-workbench |
| Surface | app-api |
| Layer role | backend-route |
| Languages | rust |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable contract.
- Package-root router export: sdkwork_routes_workspace_app_api::build_workspace_app_router.
- Package-root route-manifest export: sdkwork_routes_workspace_app_api::workspace_app_api_route_manifest; source anchor: src/manifest.rs#workspace_app_api_route_manifest.
- Required composition state port: sdkwork_routes_workspace_app_api::WorkspaceAppState.
- `WorkspaceAppState` carries only `WorkspaceService`, `ProjectService`,
  `ProjectDocumentBindingService`, `ProjectSandboxBindingService`, and
  `ProjectRuntimeLocationService`.
- The route authority contains exactly 35 BirdCoder-owned Workbench operations
  below `/app/v3/api/workspaces` and `/app/v3/api/projects`.
- IAM membership, Agents sessions, human IM, Skills, Documents content,
  Deployments, and realtime transport remain dependency-owned and are not
  re-declared by this crate.

## Verification

- cargo test --locked -p sdkwork-routes-workspace-app-api -- --nocapture
- node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root crates/sdkwork-routes-workspace-app-api
