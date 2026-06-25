use axum::Router;
use sdkwork_web_core::{HttpMetricsDimensions, HttpMetricsRegistry};

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
use crate::bootstrap::route_manifest::birdcoder_product_app_api_routes;
use crate::bootstrap::state::AppState;
use crate::health;
use crate::observability;
use crate::openapi;

fn resolve_http_metrics_dimensions() -> HttpMetricsDimensions {
    let mut dimensions = HttpMetricsDimensions::default()
        .with_service("sdkwork-birdcoder-api-server")
        .with_deployment_profile(
            std::env::var("SDKWORK_DEPLOYMENT_PROFILE").unwrap_or_else(|_| "standalone".into()),
        )
        .with_runtime_target(
            std::env::var("SDKWORK_RUNTIME_TARGET").unwrap_or_else(|_| "server".into()),
        );

    if let Ok(environment) = std::env::var("SDKWORK_ENVIRONMENT") {
        let normalized = environment.trim();
        if !normalized.is_empty() {
            dimensions.environment = normalized.to_owned();
        }
    }

    dimensions
}

pub async fn build_router(
    state: AppState,
    config: &BirdServerConfig,
) -> Result<Router, Box<dyn std::error::Error>> {
    let metrics = HttpMetricsRegistry::with_dimensions(resolve_http_metrics_dimensions());
    let product_routes = birdcoder_product_app_api_routes();
    let system_router = sdkwork_router_system_app_api::build_system_app_router()
        .with_state(SystemAppState::with_repository_pool(
            state.repositories.any_pool.clone(),
            product_routes,
        ));

    let intelligence_router = sdkwork_router_coding_sessions_app_api::build_coding_sessions_app_api_router()
        .with_state(CodingSessionsAppState {
            service: state.services.coding_session.clone(),
        });

    let workspace_router = sdkwork_router_workspace_app_api::build_workspace_app_router()
        .with_state(WorkspaceAppState {
            workspace_service: state.services.workspace.clone(),
            project_service: state.services.project.clone(),
            deployment_service: state.services.deployment.clone(),
            team_service: state.services.team.clone(),
            realtime_hub: state.services.realtime_hub.clone(),
        });

    let engine_catalog_router = sdkwork_router_engine_catalog_app_api::build_engine_catalog_app_router()
        .with_state(EngineCatalogAppState::default());

    let document_router = sdkwork_router_document_app_api::build_document_app_router()
        .with_state(DocumentAppState::new(state.repositories.any_pool.clone()));

    let skill_packages_router = sdkwork_router_skill_packages_app_api::build_skill_packages_app_router()
        .with_state(SkillPackagesAppState::new(
            state.repositories.any_pool.clone(),
            state.services.workspace.clone(),
            state.services.project.clone(),
        ));

    let membership_router = sdkwork_router_membership_app_api::build_membership_app_router()
        .with_state(MembershipAppState::new(state.repositories.any_pool.clone()));

    let deployment_backend_router = sdkwork_router_deployment_backend_api::build_deployment_backend_router()
        .with_state(DeploymentBackendAppState {
            service: state.services.deployment.clone(),
            team_service: state.services.team.clone(),
        });

    let iam_router = crate::bootstrap::iam::wire_iam_routers()
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

    let database_pool = state.database_pool.clone();
    let app = Router::new()
        .merge(iam_router)
        .merge(build_protected_app_router(protected, config, metrics.clone()).await?)
        .route("/openapi.json", axum::routing::get(openapi::serve_openapi_json))
        .route(
            "/health",
            axum::routing::get(move || {
                let database_pool = database_pool.clone();
                async move { health::health_check((*database_pool).clone()).await }
            }),
        )
        .route(
            "/metrics",
            axum::routing::get({
                let metrics = metrics.clone();
                move || {
                    let metrics = metrics.clone();
                    async move { observability::metrics_handler(metrics).await }
                }
            }),
        );

    Ok(app)
}
