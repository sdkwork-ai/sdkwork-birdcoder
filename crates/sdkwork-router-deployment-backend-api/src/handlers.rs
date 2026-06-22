use axum::extract::{Query, State};
use axum::Json;

use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;
use sdkwork_birdcoder_errors::trace_id_from_request_id;
use sdkwork_birdcoder_router_context::{deployment_context, RequiredIamContext, WebRequestContext};

use crate::error;
use crate::mapper::request::DeploymentTargetListQuery;

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

#[derive(Clone)]
pub struct DeploymentBackendAppState {
    pub service: DeploymentService,
}

pub async fn admin_deployment_targets(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<DeploymentBackendAppState>,
    Query(query): Query<DeploymentTargetListQuery>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let trace_id = request_trace_id(&web);
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
        Err(e) => Err(error::map_service_error(e, trace_id)),
    }
}

pub async fn admin_releases(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<DeploymentBackendAppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let trace_id = request_trace_id(&web);
    let ctx = deployment_context(&iam);
    match state.service.list_releases(&ctx).await {
        Ok(items) => Ok(Json(serde_json::json!({ "items": items }))),
        Err(e) => Err(error::map_service_error(e, trace_id)),
    }
}

pub async fn admin_deployments(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<DeploymentBackendAppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let trace_id = request_trace_id(&web);
    let ctx = deployment_context(&iam);
    match state.service.list_deployments(&ctx).await {
        Ok(items) => Ok(Json(serde_json::json!({ "items": items }))),
        Err(e) => Err(error::map_service_error(e, trace_id)),
    }
}
