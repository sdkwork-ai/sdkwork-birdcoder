use axum::Router;
use sdkwork_agents_kernel_bridge::build_agent_http_state;
use sdkwork_routes_agents_app_api::build_router;

/// Federates sdkwork-agents managed-store app-api routes into the BirdCoder gateway.
///
/// Business HTTP (`/app/v3/api/ai/*`) is owned by sdkwork-agents; BirdCoder must not
/// reimplement agent CRUD, sessions, or catalog handlers locally.
pub async fn wire_agents_app_router() -> Result<Router, String> {
    let state = tokio::task::spawn_blocking(build_agent_http_state)
        .await
        .map_err(|error| format!("agents managed store bootstrap task failed: {error}"))?
        .map_err(|error| format!("agents managed store bootstrap failed: {error}"))?;
    Ok(build_router().with_state(state))
}
