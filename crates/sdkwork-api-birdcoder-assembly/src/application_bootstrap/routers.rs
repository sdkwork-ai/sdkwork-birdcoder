use axum::Router;
use sdkwork_web_core::{HttpMetricsDimensions, HttpMetricsRegistry};
use std::sync::Arc;

use sdkwork_routes_chat_app_api::handlers::ChatAppState;
use sdkwork_routes_coding_sessions_app_api::handlers::CodingSessionsAppState;
use sdkwork_routes_commerce_app_api::CommerceAppState as CommerceTransactionsAppState;
use sdkwork_routes_deployment_backend_api::DeploymentBackendAppState;
use sdkwork_routes_document_app_api::DocumentAppState;
use sdkwork_routes_engine_catalog_app_api::EngineCatalogAppState;
use sdkwork_routes_skill_packages_app_api::SkillPackagesAppState;
use sdkwork_routes_system_app_api::SystemAppState;
use sdkwork_routes_workspace_app_api::WorkspaceAppState;
use sdkwork_terminal_runtime_node::RuntimeNodeHost;

use crate::bootstrap::auth::{
    build_protected_app_router, with_gateway_cors, with_gateway_realtime_websocket_credentials,
};
use crate::bootstrap::config::BirdServerConfig;
use crate::bootstrap::realtime_hub::CodingSessionRealtimeReplayProvider;
use crate::bootstrap::route_manifest::birdcoder_product_app_api_routes;
use crate::bootstrap::state::AppState;
use crate::bootstrap::terminal_execution::wire_project_terminal_execution_resolver;
use crate::business_metrics::BusinessMetricsRegistry;
use crate::health;
use crate::observability;
use crate::openapi;

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
    let product_routes = birdcoder_product_app_api_routes();
    let system_router = sdkwork_routes_system_app_api::build_system_app_router().with_state(
        SystemAppState::with_repository_pool(state.repositories.any_pool.clone(), product_routes),
    );

    let intelligence_router =
        sdkwork_routes_coding_sessions_app_api::build_coding_sessions_app_api_router().with_state(
            CodingSessionsAppState {
                service: state.services.coding_session.clone(),
                commerce_pool: Some(state.repositories.any_pool.clone()),
            },
        );

    let workspace_router = sdkwork_routes_workspace_app_api::build_workspace_app_router()
        .with_state(WorkspaceAppState {
            workspace_service: state.services.workspace.clone(),
            project_service: state.services.project.clone(),
            runtime_location_service: state.services.runtime_location.clone(),
            sandbox_binding_service: state.services.sandbox_binding.clone(),
            deployment_service: state.services.deployment.clone(),
            team_service: state.services.team.clone(),
            realtime_hub: state.services.realtime_hub.clone(),
            realtime_replay_provider: Some(Arc::new(CodingSessionRealtimeReplayProvider::new(
                state.services.coding_session.clone(),
            ))),
        });

    let engine_catalog_router =
        sdkwork_routes_engine_catalog_app_api::build_engine_catalog_app_router()
            .with_state(EngineCatalogAppState::default());

    let document_router = sdkwork_routes_document_app_api::build_document_app_router()
        .with_state(DocumentAppState::new(state.repositories.any_pool.clone()));

    let chat_router = sdkwork_routes_chat_app_api::build_chat_app_router()
        .with_state(ChatAppState::new(state.repositories.any_pool.clone()));

    let skill_packages_router =
        sdkwork_routes_skill_packages_app_api::build_skill_packages_app_router().with_state(
            SkillPackagesAppState::new(
                state.repositories.any_pool.clone(),
                state.services.workspace.clone(),
                state.services.project.clone(),
            ),
        );

    let commerce_transactions_router = sdkwork_routes_commerce_app_api::build_commerce_app_router()
        .with_state(CommerceTransactionsAppState::new(
            state.repositories.any_pool.clone(),
        ));

    let deployment_backend_router =
        sdkwork_routes_deployment_backend_api::build_deployment_backend_router().with_state(
            DeploymentBackendAppState {
                service: state.services.deployment.clone(),
                team_service: state.services.team.clone(),
            },
        );

    let iam_router = crate::bootstrap::iam::wire_iam_routers()
        .await
        .map_err(|error| -> Box<dyn std::error::Error> { error.into() })?;

    let agents_router = crate::bootstrap::agents::wire_agents_app_router()
        .await
        .map_err(|error| -> Box<dyn std::error::Error> { error.into() })?;

    let terminal_host = Arc::new(
        RuntimeNodeHost::new_default()
            .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?,
    );
    let terminal_execution_resolver = wire_project_terminal_execution_resolver(
        Arc::new(state.services.project.clone()),
        Arc::new(state.services.runtime_location.clone()),
    );
    let terminal_state =
        sdkwork_routes_terminal_app_api::TerminalAppState::with_project_execution_resolver(
            terminal_host,
            terminal_execution_resolver,
        );
    let terminal_router =
        sdkwork_routes_terminal_app_api::build_terminal_app_api_router().with_state(terminal_state);

    let protected = Router::new()
        .merge(system_router)
        .merge(engine_catalog_router)
        .merge(agents_router)
        .merge(intelligence_router)
        .merge(workspace_router)
        .merge(document_router)
        .merge(chat_router)
        .merge(skill_packages_router)
        .merge(commerce_transactions_router)
        .merge(deployment_backend_router)
        .merge(terminal_router);

    let database_pool = state.database_pool.clone();
    let readiness_check = health::BirdCoderReadinessCheck::new((*database_pool).clone());
    let app = Router::new()
        .merge(iam_router)
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
    let app = with_gateway_realtime_websocket_credentials(app);
    let app = with_gateway_cors(app, config);
    let app = observability::with_business_metrics(app, business_metrics);
    Ok(app)
}
