use axum::Router;
use http::HeaderValue;
use tower_http::cors::{AllowOrigin, CorsLayer};

use sdkwork_router_coding_sessions_app_api::handlers::CodingSessionsAppState;
use sdkwork_router_deployment_backend_api::DeploymentBackendAppState;
use sdkwork_router_document_app_api::DocumentAppState;
use sdkwork_router_engine_catalog_app_api::EngineCatalogAppState;
use sdkwork_router_membership_app_api::MembershipAppState;
use sdkwork_router_skill_packages_app_api::SkillPackagesAppState;
use sdkwork_router_system_app_api::SystemAppState;
use sdkwork_router_workspace_app_api::WorkspaceAppState;

use crate::bootstrap::auth::build_protected_app_router;
use crate::bootstrap::config::BirdServerConfig;
use crate::bootstrap::state::AppState;
use crate::health;

pub async fn build_router(
    state: AppState,
    config: &BirdServerConfig,
) -> Result<Router, Box<dyn std::error::Error>> {
    let cors = build_cors_layer(config);

    let system_router = sdkwork_router_system_app_api::build_system_app_router()
        .with_state(SystemAppState::new());

    let intelligence_router = sdkwork_router_coding_sessions_app_api::build_coding_sessions_app_api_router()
        .with_state(CodingSessionsAppState {
            service: state.services.coding_session.clone(),
        });

    let workspace_router = sdkwork_router_workspace_app_api::build_workspace_app_router()
        .with_state(WorkspaceAppState {
            workspace_service: state.services.workspace.clone(),
            project_service: state.services.project.clone(),
            deployment_service: state.services.deployment.clone(),
        });

    let engine_catalog_router = sdkwork_router_engine_catalog_app_api::build_engine_catalog_app_router()
        .with_state(EngineCatalogAppState::default());

    let document_router = sdkwork_router_document_app_api::build_document_app_router()
        .with_state(DocumentAppState::new(state.repositories.document_conn.clone()));

    let skill_packages_router = sdkwork_router_skill_packages_app_api::build_skill_packages_app_router()
        .with_state(SkillPackagesAppState::new(state.repositories.skill_package_conn.clone()));

    let membership_router = sdkwork_router_membership_app_api::build_membership_app_router()
        .with_state(MembershipAppState::new(state.repositories.membership_conn.clone()));

    let deployment_backend_router = sdkwork_router_deployment_backend_api::build_deployment_backend_router()
        .with_state(DeploymentBackendAppState {
            service: state.services.deployment.clone(),
        });

    let iam_router = crate::bootstrap::iam::wire_iam_app_router()
        .await
        .map_err(|error| -> Box<dyn std::error::Error> { error.into() })?;

    let protected = Router::new()
        .merge(system_router)
        .merge(engine_catalog_router)
        .merge(intelligence_router)
        .merge(workspace_router)
        .merge(document_router)
        .merge(skill_packages_router)
        .merge(membership_router)
        .merge(deployment_backend_router);

    let sqlite_file = config.sqlite_file.clone();
    let app = Router::new()
        .merge(iam_router)
        .merge(build_protected_app_router(protected).await)
        .route(
            "/health",
            axum::routing::get(move || health::health_check(sqlite_file.clone())),
        )
        .layer(cors);

    Ok(app)
}

fn build_cors_layer(config: &BirdServerConfig) -> CorsLayer {
    let origins: Vec<HeaderValue> = config
        .allowed_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    let uses_wildcard = config.allowed_origins.iter().any(|origin| origin == "*");
    if uses_wildcard && is_loopback_host(&config.host) {
        let loopback_origins: Vec<HeaderValue> = default_loopback_cors_origins()
            .into_iter()
            .filter_map(|origin| origin.parse().ok())
            .collect();
        return CorsLayer::new()
            .allow_origin(AllowOrigin::list(loopback_origins))
            .allow_methods(tower_http::cors::Any)
            .allow_headers(tower_http::cors::Any);
    }

    if uses_wildcard {
        CorsLayer::permissive()
    } else {
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(origins))
            .allow_methods(tower_http::cors::Any)
            .allow_headers(tower_http::cors::Any)
    }
}

fn is_loopback_host(host: &str) -> bool {
    host == "127.0.0.1" || host.eq_ignore_ascii_case("localhost")
}

fn default_loopback_cors_origins() -> Vec<String> {
    vec![
        "http://127.0.0.1:5173".to_string(),
        "http://localhost:5173".to_string(),
        "http://127.0.0.1:4173".to_string(),
        "http://localhost:4173".to_string(),
        "tauri://localhost".to_string(),
        "https://tauri.localhost".to_string(),
    ]
}
