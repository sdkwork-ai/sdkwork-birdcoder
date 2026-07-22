use std::sync::Arc;

use axum::Router;
use sdkwork_routes_system_app_api::SystemAppState;
use sdkwork_routes_workspace_app_api::WorkspaceAppState;
use sdkwork_web_core::{HttpMetricsDimensions, HttpMetricsRegistry};

use crate::bootstrap::auth::{build_protected_app_router, with_gateway_cors};
use crate::bootstrap::config::BirdServerConfig;
use crate::bootstrap::route_manifest::birdcoder_app_api_routes;
use crate::bootstrap::state::AppState;
use crate::business_metrics::BusinessMetricsRegistry;
use crate::{health, observability, openapi};

fn resolve_http_metrics_dimensions(config: &BirdServerConfig) -> HttpMetricsDimensions {
    let mut dimensions = HttpMetricsDimensions::default()
        .with_service("sdkwork-api-birdcoder-standalone-gateway")
        .with_deployment_profile(config.deployment_profile.as_str())
        .with_runtime_target(config.runtime_target.as_str());
    dimensions.environment = config.environment.as_str().to_owned();
    dimensions
}

pub async fn build_router(
    state: AppState,
    config: &BirdServerConfig,
) -> Result<Router, Box<dyn std::error::Error>> {
    let metrics = HttpMetricsRegistry::with_dimensions(resolve_http_metrics_dimensions(config));
    let business_metrics = BusinessMetricsRegistry::new();
    let owned_routes = birdcoder_app_api_routes();

    let system_router = sdkwork_routes_system_app_api::build_system_app_router().with_state(
        SystemAppState::with_runtime(
            owned_routes,
            config.host.clone(),
            config.port,
            "sdkwork.app.config.json",
        ),
    );
    let workspace_router = sdkwork_routes_workspace_app_api::build_workspace_app_router()
        .with_state(WorkspaceAppState {
            workspace_service: state.services.workspace.clone(),
            project_service: state.services.project.clone(),
            document_binding_service: state.services.document_binding.clone(),
            sandbox_binding_service: state.services.sandbox_binding.clone(),
            runtime_location_service: state.services.runtime_location.clone(),
        });

    let protected = Router::new().merge(system_router).merge(workspace_router);
    let readiness_check = health::BirdCoderReadinessCheck::new(state.database_host.pool().clone());
    let app = Router::new()
        .merge(build_protected_app_router(protected, config, metrics.clone()).await?)
        .route(
            "/openapi.json",
            axum::routing::get(openapi::serve_openapi_json),
        )
        .route(
            "/metrics",
            axum::routing::get({
                let metrics = metrics.clone();
                let business_metrics = business_metrics.clone();
                move || {
                    let metrics = metrics.clone();
                    let business_metrics = business_metrics.clone();
                    async move { observability::metrics_handler(metrics, business_metrics).await }
                }
            }),
        );

    let app = sdkwork_web_bootstrap::mount_infra_routes(
        app,
        sdkwork_web_bootstrap::ServiceRouterConfig::default()
            .with_readiness_check(Arc::new(readiness_check))
            .skip_metrics(),
    );
    let app = with_gateway_cors(app, config);
    Ok(observability::with_business_metrics(app, business_metrics))
}
