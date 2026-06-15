use axum::Router;
use http::HeaderValue;
use tower_http::cors::{AllowOrigin, CorsLayer};

use sdkwork_router_coding_sessions_app_api::handlers::IntelligenceAppState;

use crate::bootstrap::config::BirdServerConfig;
use crate::bootstrap::state::AppState;
use crate::health;

pub fn build_router(state: AppState, config: &BirdServerConfig) -> Router {
    let cors = build_cors_layer(config);

    let intelligence_router = sdkwork_router_coding_sessions_app_api::build_intelligence_app_api_router()
        .with_state(IntelligenceAppState {
            service: state.services.coding_session.clone(),
        });

    let app = Router::new()
        .merge(sdkwork_router_system_app_api::build_system_app_router())
        .merge(sdkwork_router_engine_catalog_app_api::build_runtime_app_router())
        .merge(intelligence_router)
        .merge(sdkwork_router_workspace_app_api::build_platform_app_router())
        .merge(sdkwork_router_document_app_api::build_content_app_router())
        .merge(sdkwork_router_skill_packages_app_api::build_ecosystem_app_router())
        .merge(sdkwork_router_membership_app_api::build_commerce_app_router())
        .merge(sdkwork_router_deployment_backend_api::build_platform_backend_router())
        .route("/health", axum::routing::get(health::health_check))
        .layer(cors);

    app
}

fn build_cors_layer(config: &BirdServerConfig) -> CorsLayer {
    let origins: Vec<HeaderValue> = config
        .allowed_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    if origins.iter().any(|o| o == "*") {
        CorsLayer::permissive()
    } else {
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(origins))
            .allow_methods(tower_http::cors::Any)
            .allow_headers(tower_http::cors::Any)
    }
}

