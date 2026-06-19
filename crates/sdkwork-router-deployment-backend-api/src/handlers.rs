use axum::extract::{Query, State};
use axum::Json;

use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;
use sdkwork_birdcoder_router_context::{deployment_context, RequiredIamContext, WebRequestContext};

use crate::error;
use crate::mapper::request::DeploymentTargetListQuery;

#[derive(Clone)]
pub struct DeploymentBackendAppState {
    pub service: DeploymentService,
}

pub async fn admin_deployment_targets(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<DeploymentBackendAppState>,
    Query(query): Query<DeploymentTargetListQuery>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let ctx = deployment_context(&iam);
    let result = if let Some(ref project_id) = query.project_id {
        state
            .service
            .list_deployment_targets_by_project(&ctx, project_id)
            .await
    } else {
        state.service.list_deployment_targets(&ctx).await
    };
    match result {
        Ok(items) => Ok(Json(serde_json::json!({ "items": items }))),
        Err(e) => Err(error::map_service_error(e)),
    }
}

pub async fn admin_releases(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<DeploymentBackendAppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let ctx = deployment_context(&iam);
    match state.service.list_releases(&ctx).await {
        Ok(items) => Ok(Json(serde_json::json!({ "items": items }))),
        Err(e) => Err(error::map_service_error(e)),
    }
}

pub async fn admin_deployments(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<DeploymentBackendAppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let ctx = deployment_context(&iam);
    match state.service.list_deployments(&ctx).await {
        Ok(items) => Ok(Json(serde_json::json!({ "items": items }))),
        Err(e) => Err(error::map_service_error(e)),
    }
}
