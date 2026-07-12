use axum::extract::{Path, Query, State};
use axum::Json;

use sdkwork_birdcoder_deployment_service::domain::results::{
    DeploymentPayload, DeploymentTargetPayload, ReleasePayload,
};
use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;
use sdkwork_birdcoder_errors::{
    build_offset_list_envelope, trace_id_from_request_id, ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{
    deployment_context, workspace_context, RequiredIamContext, StrictOffsetListQuery,
    WebRequestContext,
};
use sdkwork_birdcoder_workspace_service::domain::results::{TeamMemberPayload, TeamPayload};
use sdkwork_birdcoder_workspace_service::service::team_service::TeamService;

use crate::error;
use crate::mapper::request::{ProjectIdPathParams, TeamIdPathParams, TeamListQuery};

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

#[derive(Clone)]
pub struct DeploymentBackendAppState {
    pub service: DeploymentService,
    pub team_service: TeamService,
}

pub async fn admin_deployment_targets(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<DeploymentBackendAppState>,
    Path(params): Path<ProjectIdPathParams>,
) -> Result<Json<ApiListEnvelope<DeploymentTargetPayload>>, sdkwork_birdcoder_errors::ProblemJsonBody>
{
    let trace_id = request_trace_id(&web);
    let ctx = deployment_context(&iam);
    // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .service
        .list_deployment_targets_by_project(&ctx, &params.project_id, offset, page_size)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_service_error(e, trace_id)),
    }
}

pub async fn admin_releases(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<DeploymentBackendAppState>,
) -> Result<Json<ApiListEnvelope<ReleasePayload>>, sdkwork_birdcoder_errors::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = deployment_context(&iam);
    // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state.service.list_releases(&ctx, offset, page_size).await {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_service_error(e, trace_id)),
    }
}

pub async fn admin_deployments(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<DeploymentBackendAppState>,
) -> Result<Json<ApiListEnvelope<DeploymentPayload>>, sdkwork_birdcoder_errors::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = deployment_context(&iam);
    // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .service
        .list_deployments(&ctx, offset, page_size)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_service_error(e, trace_id)),
    }
}

pub async fn admin_teams(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<DeploymentBackendAppState>,
    Query(query): Query<TeamListQuery>,
) -> Result<Json<ApiListEnvelope<TeamPayload>>, sdkwork_birdcoder_errors::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = workspace_context(&iam);
    // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .team_service
        .list_teams(
            &ctx,
            query.workspace_id.as_deref(),
            query.user_id.as_deref(),
            offset,
            page_size,
        )
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_workspace_error(e, trace_id)),
    }
}

pub async fn admin_team_members(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<DeploymentBackendAppState>,
    Path(params): Path<TeamIdPathParams>,
) -> Result<Json<ApiListEnvelope<TeamMemberPayload>>, sdkwork_birdcoder_errors::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = workspace_context(&iam);
    // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .team_service
        .list_team_members(&ctx, &params.team_id, offset, page_size)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_workspace_error(e, trace_id)),
    }
}
