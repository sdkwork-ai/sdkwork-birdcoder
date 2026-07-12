# SDKWork BirdCoder Chat App API Routes Specs

This directory is the module-local SDKWork spec system for the sdkwork-routes-chat-app-api Rust crate.

Root SDKWork standards remain authoritative. This module spec records only the route-crate integration contract and does not copy root standard text.

## Component

| Field | Value |
| --- | --- |
| Name | sdkwork-routes-chat-app-api |
| Type | rust-route-crate |
| Root | sdkwork-birdcoder/crates/sdkwork-routes-chat-app-api |
| Domain | system |
| Capability | chat |
| Surface | app-api |
| Layer role | backend-route |
| Languages | rust |

## Contract Manifest

- [component.spec.json](./component.spec.json) is the machine-readable contract.
- Package-root router export: sdkwork_routes_chat_app_api::build_chat_app_router.
- Package-root route-manifest export: sdkwork_routes_chat_app_api::chat_app_api_route_manifest; source anchor: src/manifest.rs#chat_app_api_route_manifest.
- Required composition state port: sdkwork_routes_chat_app_api::ChatAppState. ChatAppState carries ChatService<SqliteChatRepository> and can be constructed from sqlx::AnyPool.

## Verification

- cargo test --offline --locked -p sdkwork-routes-chat-app-api --lib -- --nocapture
- node ../sdkwork-specs/tools/check-component-port-bindings.mjs --root crates/sdkwork-routes-chat-app-api

