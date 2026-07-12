# SDKWork BirdCoder Skill Packages App API Routes Specs

This directory is the module-local SDKWork spec system for the sdkwork-routes-skill-packages-app-api Rust crate.

Root SDKWork standards remain authoritative. This module spec records only the route-crate integration contract and does not copy root standard text.

## Component

| Field | Value |
| --- | --- |
| Name | sdkwork-routes-skill-packages-app-api |
| Type | rust-route-crate |
| Root | sdkwork-birdcoder/crates/sdkwork-routes-skill-packages-app-api |
| Domain | ecosystem |
| Capability | skill-packages |
| Surface | app-api |
| Layer role | backend-route |
| Languages | rust |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable contract.
- Package-root router export: sdkwork_routes_skill_packages_app_api::build_skill_packages_app_router.
- Package-root route-manifest export: sdkwork_routes_skill_packages_app_api::skill_packages_app_api_route_manifest; source anchor: src/manifest.rs#skill_packages_app_api_route_manifest.
- Required composition state port: sdkwork_routes_skill_packages_app_api::SkillPackagesAppState. SkillPackagesAppState carries SkillPackageService, AppTemplateService, WorkspaceService, and ProjectService.

## Verification

- cargo test --offline --locked -p sdkwork-routes-skill-packages-app-api --lib -- --nocapture
- node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root crates/sdkwork-routes-skill-packages-app-api

