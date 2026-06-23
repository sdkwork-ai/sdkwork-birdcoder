use axum::Router;

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

pub async fn build_router(
    state: AppState,
    config: &BirdServerConfig,
) -> Result<Router, Box<dyn std::error::Error>> {
    let product_routes = birdcoder_product_app_api_routes();
    let system_router = sdkwork_router_system_app_api::build_system_app_router()
        .with_state(SystemAppState::with_sqlite_pool(
            state.repositories.sqlite_pool.clone(),
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
            realtime_hub: state.services.realtime_hub.clone(),
        });

    let engine_catalog_router = sdkwork_router_engine_catalog_app_api::build_engine_catalog_app_router()
        .with_state(EngineCatalogAppState::default());

    let document_router = sdkwork_router_document_app_api::build_document_app_router()
        .with_state(DocumentAppState::new(state.repositories.sqlite_pool.clone()));

    let skill_packages_router = sdkwork_router_skill_packages_app_api::build_skill_packages_app_router()
        .with_state(SkillPackagesAppState::new(
            state.repositories.sqlite_pool.clone(),
            state.services.workspace.clone(),
            state.services.project.clone(),
        ));

    let membership_router = sdkwork_router_membership_app_api::build_membership_app_router()
        .with_state(MembershipAppState::new(state.repositories.sqlite_pool.clone()));

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

    let sqlite_pool = state.repositories.sqlite_pool.clone();
    let app = Router::new()
        .merge(iam_router)
        .merge(build_protected_app_router(protected, config).await)
        .route(
            "/health",
            axum::routing::get(move || health::health_check(sqlite_pool.clone())),
        );

    Ok(app)
}
