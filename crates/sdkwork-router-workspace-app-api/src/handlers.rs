use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::response::IntoResponse;
use axum::Json;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;

use sdkwork_birdcoder_errors::{
    build_data_envelope, build_offset_list_envelope, trace_id_from_request_id, ApiDataEnvelope,
    ApiListEnvelope,
};
use sdkwork_birdcoder_project_service::pagination::paginate_vec;
use sdkwork_birdcoder_router_context::{
    deployment_context, project_context, workspace_context, RequiredIamContext, WebRequestContext,
};
use sdkwork_birdcoder_workspace_service::domain::commands::{
    CreateWorkspaceRequest, UpdateWorkspaceRequest, UpsertWorkspaceMemberRequest,
};
use sdkwork_birdcoder_workspace_service::domain::models::WorkspaceScopedQuery;
use sdkwork_birdcoder_workspace_service::domain::results::WorkspacePayload;
use sdkwork_birdcoder_workspace_service::service::workspace_service::WorkspaceService;

use sdkwork_birdcoder_project_service::domain::commands::{
    CreateProjectRequest, UpdateProjectRequest, UpsertProjectCollaboratorRequest,
    CreateProjectGitBranchRequest, SwitchProjectGitBranchRequest,
    CommitProjectGitChangesRequest, PushProjectGitBranchRequest,
    CreateProjectGitWorktreeRequest, RemoveProjectGitWorktreeRequest,
};
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;

use sdkwork_birdcoder_deployment_service::domain::commands::PublishProjectCommand;
use sdkwork_birdcoder_deployment_service::domain::commands::PublishProjectRequest as DeployPublishRequest;
use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;

use crate::error;
use crate::mapper::request::{
    CreateGitBranchBody, CreateGitWorktreeBody, CreateProjectBody, CreateWorkspaceBody,
    CommitGitChangesBody, ProjectListQuery, ProjectPathParams, PublishProjectBody,
    PushGitBranchBody, RemoveGitWorktreeBody, SwitchGitBranchBody, UpdateProjectBody,
    UpdateWorkspaceBody, UpsertProjectCollaboratorBody, UpsertWorkspaceMemberBody,
    WorkspaceListQuery, WorkspacePathParams,
};
use crate::realtime_hub::{build_workspace_ready_message, WorkspaceRealtimeHub};

#[derive(Clone)]
pub struct WorkspaceAppState {
    pub workspace_service: WorkspaceService,
    pub project_service: ProjectService,
    pub deployment_service: DeploymentService,
    pub realtime_hub: WorkspaceRealtimeHub,
}

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceRealtimeQuery {
    session_id: String,
}

// ── Workspace handlers ───────────────────────────────────────────────

pub async fn list_workspaces(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Query(query): Query<WorkspaceListQuery>,
) -> Result<Json<ApiListEnvelope<WorkspacePayload>>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = workspace_context(&iam);
    let scoped = WorkspaceScopedQuery {
        root_path: None,
        user_id: query.user_id.clone(),
        workspace_id: None,
    };
    let trace_id = request_trace_id(&web);
    match state.workspace_service.list_workspaces(&ctx, &scoped).await {
        Ok(workspaces) => {
            let (items, offset, limit, total) =
                paginate_vec(workspaces, query.offset, query.limit);
            let page_size = limit.unwrap_or(sdkwork_birdcoder_project_service::pagination::DEFAULT_LIST_PAGE_SIZE);
            Ok(Json(build_offset_list_envelope(
                items,
                offset,
                page_size,
                total,
                request_id(&web),
            )))
        }
        Err(e) => Err(error::map_workspace_error(e, trace_id)),
    }
}

pub async fn get_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<ApiDataEnvelope<WorkspacePayload>>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = workspace_context(&iam);
    match state.workspace_service.get_workspace(&ctx, &params.workspace_id).await {
        Ok(workspace) => Ok(Json(build_data_envelope(workspace, request_id(&web)))),
        Err(e) => Err(error::map_workspace_error(e, request_trace_id(&web))),
    }
}

pub async fn create_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Json(body): Json<CreateWorkspaceBody>,
) -> Result<Json<ApiDataEnvelope<WorkspacePayload>>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = workspace_context(&iam);
    let request = CreateWorkspaceRequest {
        name: body.name,
        description: body.description,
        tenant_id: None,
        organization_id: None,
        data_scope: None,
        code: None,
        title: None,
        owner_id: None,
        leader_id: None,
        created_by_user_id: None,
        icon: None,
        color: None,
        entity_type: None,
        start_time: None,
        end_time: None,
        max_members: None,
        current_members: None,
        member_count: None,
        max_storage: None,
        used_storage: None,
        settings: None,
        is_public: None,
        is_template: None,
    };
    match state.workspace_service.create_workspace(&ctx, &request).await {
        Ok(workspace) => Ok(Json(build_data_envelope(workspace, request_id(&web)))),
        Err(e) => Err(error::map_workspace_error(e, request_trace_id(&web))),
    }
}

pub async fn update_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
    Json(body): Json<UpdateWorkspaceBody>,
) -> Result<Json<ApiDataEnvelope<WorkspacePayload>>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = workspace_context(&iam);
    let request = UpdateWorkspaceRequest {
        name: body.name,
        description: body.description,
        data_scope: None,
        code: None,
        title: None,
        owner_id: None,
        leader_id: None,
        icon: None,
        color: None,
        entity_type: None,
        start_time: None,
        end_time: None,
        max_members: None,
        current_members: None,
        member_count: None,
        max_storage: None,
        used_storage: None,
        settings: None,
        is_public: None,
        is_template: None,
        status: None,
    };
    match state.workspace_service.update_workspace(&ctx, &params.workspace_id, &request).await {
        Ok(workspace) => Ok(Json(build_data_envelope(workspace, request_id(&web)))),
        Err(e) => Err(error::map_workspace_error(e, request_trace_id(&web))),
    }
}

pub async fn delete_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<ApiDataEnvelope<serde_json::Value>>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = workspace_context(&iam);
    match state.workspace_service.delete_workspace(&ctx, &params.workspace_id).await {
        Ok(result) => Ok(Json(build_data_envelope(result, request_id(&web)))),
        Err(e) => Err(error::map_workspace_error(e, request_trace_id(&web))),
    }
}

pub async fn subscribe_workspace_realtime(
    ws: WebSocketUpgrade,
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    Path(params): Path<WorkspacePathParams>,
    Query(query): Query<WorkspaceRealtimeQuery>,
    State(state): State<WorkspaceAppState>,
) -> Result<impl IntoResponse, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let trace_id = request_trace_id(&web);
    let session_id = query.session_id.trim();
    if session_id.is_empty() || session_id != iam.session_id {
        return Err(error::map_validation_error(
            "A valid SDKWork IAM session id is required for workspace realtime subscription.",
            trace_id,
        ));
    }

    let workspace_id = params.workspace_id.clone();
    let ctx = workspace_context(&iam);
    if state
        .workspace_service
        .get_workspace(&ctx, &workspace_id)
        .await
        .is_err()
    {
        return Err(error::map_not_found(
            format!("Workspace '{workspace_id}' was not found."),
            trace_id,
        ));
    }

    let user_id = iam.user_id.clone();
    let hub = state.realtime_hub.clone();
    Ok(ws.on_upgrade(move |socket| handle_workspace_realtime(socket, hub, workspace_id, user_id)))
}

async fn handle_workspace_realtime(
    socket: WebSocket,
    hub: WorkspaceRealtimeHub,
    workspace_id: String,
    user_id: String,
) {
    let mut receiver = hub.subscribe(&workspace_id).await;
    let (mut sender, mut inbound) = socket.split();

    if sender
        .send(Message::Text(
            build_workspace_ready_message(&workspace_id, &user_id).into(),
        ))
        .await
        .is_err()
    {
        return;
    }

    loop {
        tokio::select! {
            event = receiver.recv() => {
                match event {
                    Ok(message) => {
                        if sender.send(Message::Text(message.into())).await.is_err() {
                            break;
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
            inbound_message = inbound.next() => {
                match inbound_message {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        if sender.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
        }
    }
}

pub async fn list_workspace_members(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = workspace_context(&iam);
    match state.workspace_service.list_workspace_members(&ctx, &params.workspace_id).await {
        Ok(members) => Ok(Json(serde_json::json!({ "items": members }))),
        Err(e) => Err(error::map_workspace_error(e, request_trace_id(&web))),
    }
}

pub async fn upsert_workspace_member(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
    Json(body): Json<UpsertWorkspaceMemberBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = workspace_context(&iam);
    let request = UpsertWorkspaceMemberRequest {
        user_id: body.user_id,
        email: body.email,
        team_id: body.team_id,
        role: body.role,
        status: None,
        created_by_user_id: None,
        granted_by_user_id: None,
    };
    match state.workspace_service.upsert_workspace_member(&ctx, &params.workspace_id, &request).await {
        Ok(member) => Ok(Json(serde_json::json!(member))),
        Err(e) => Err(error::map_workspace_error(e, request_trace_id(&web))),
    }
}

// ── Project handlers ─────────────────────────────────────────────────

pub async fn list_projects(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Query(query): Query<ProjectListQuery>,
) -> Result<Json<ApiListEnvelope<sdkwork_birdcoder_project_service::domain::results::ProjectPayload>>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    let workspace_id = query.workspace_id.as_deref().unwrap_or("default");
    let trace_id = request_trace_id(&web);
    match state.project_service.list_projects(&ctx, workspace_id).await {
        Ok(mut projects) => {
            if let Some(root_path) = query.root_path.as_deref() {
                projects.retain(|project| project.root_path.as_deref() == Some(root_path));
            }
            if let Some(user_id) = query.user_id.as_deref() {
                projects.retain(|project| project.user_id.as_deref() == Some(user_id));
            }
            let (items, offset, limit, total) =
                paginate_vec(projects, query.offset, query.limit);
            let page_size = limit.unwrap_or(sdkwork_birdcoder_project_service::pagination::DEFAULT_LIST_PAGE_SIZE);
            Ok(Json(build_offset_list_envelope(
                items,
                offset,
                page_size,
                total,
                request_id(&web),
            )))
        }
        Err(e) => Err(error::map_project_error(e, trace_id)),
    }
}

pub async fn get_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    match state.project_service.get_project(&ctx, &params.project_id).await {
        Ok(project) => Ok(Json(serde_json::json!(project))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn create_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Json(body): Json<CreateProjectBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    let request = CreateProjectRequest {
        workspace_id: body.workspace_id,
        name: body.name,
        description: body.description,
        workspace_uuid: None,
        tenant_id: None,
        organization_id: None,
        data_scope: None,
        user_id: None,
        parent_id: None,
        parent_uuid: None,
        parent_metadata: None,
        code: None,
        title: None,
        owner_id: None,
        leader_id: None,
        created_by_user_id: None,
        author: None,
        entity_type: None,
        root_path: None,
        site_path: None,
        domain_prefix: None,
        file_id: None,
        conversation_id: None,
        start_time: None,
        end_time: None,
        budget_amount: None,
        cover_image: None,
        is_template: None,
        app_template_version_id: None,
        template_preset_key: None,
        status: None,
    };
    match state.project_service.create_project(&ctx, &request).await {
        Ok(project) => Ok(Json(serde_json::json!(project))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn update_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<UpdateProjectBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    let request = UpdateProjectRequest {
        name: body.name,
        description: body.description,
        data_scope: None,
        user_id: None,
        parent_id: None,
        parent_uuid: None,
        parent_metadata: None,
        code: None,
        title: None,
        owner_id: None,
        leader_id: None,
        author: None,
        entity_type: None,
        root_path: None,
        site_path: None,
        domain_prefix: None,
        file_id: None,
        conversation_id: None,
        start_time: None,
        end_time: None,
        budget_amount: None,
        cover_image: None,
        is_template: None,
        status: None,
    };
    match state.project_service.update_project(&ctx, &params.project_id, &request).await {
        Ok(project) => Ok(Json(serde_json::json!(project))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn delete_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    match state.project_service.delete_project(&ctx, &params.project_id).await {
        Ok(result) => Ok(Json(serde_json::json!(result))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

// ── Git handlers ─────────────────────────────────────────────────────

pub async fn get_project_git_overview(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    match state.project_service.get_project_git_overview(&ctx, &params.project_id).await {
        Ok(overview) => Ok(Json(serde_json::json!(overview))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn create_project_git_branch(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CreateGitBranchBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    let request = CreateProjectGitBranchRequest {
        branch_name: body.branch_name,
    };
    match state.project_service.create_project_git_branch(&ctx, &params.project_id, &request).await {
        Ok(overview) => Ok(Json(serde_json::json!(overview))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn switch_project_git_branch(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<SwitchGitBranchBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    let request = SwitchProjectGitBranchRequest {
        branch_name: body.branch_name,
    };
    match state.project_service.switch_project_git_branch(&ctx, &params.project_id, &request).await {
        Ok(overview) => Ok(Json(serde_json::json!(overview))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn commit_project_git_changes(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CommitGitChangesBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    let request = CommitProjectGitChangesRequest {
        message: body.message,
    };
    match state.project_service.commit_project_git_changes(&ctx, &params.project_id, &request).await {
        Ok(overview) => Ok(Json(serde_json::json!(overview))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn push_project_git_branch(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<PushGitBranchBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    let request = PushProjectGitBranchRequest {
        branch_name: body.branch_name,
        remote_name: body.remote_name,
    };
    match state.project_service.push_project_git_branch(&ctx, &params.project_id, &request).await {
        Ok(overview) => Ok(Json(serde_json::json!(overview))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn create_project_git_worktree(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CreateGitWorktreeBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    let request = CreateProjectGitWorktreeRequest {
        branch_name: body.branch_name,
        path: body.path,
    };
    match state.project_service.create_project_git_worktree(&ctx, &params.project_id, &request).await {
        Ok(overview) => Ok(Json(serde_json::json!(overview))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn remove_project_git_worktree(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<RemoveGitWorktreeBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    let request = RemoveProjectGitWorktreeRequest {
        path: body.path,
        force: body.force,
    };
    match state.project_service.remove_project_git_worktree(&ctx, &params.project_id, &request).await {
        Ok(overview) => Ok(Json(serde_json::json!(overview))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn prune_project_git_worktrees(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    match state.project_service.prune_project_git_worktrees(&ctx, &params.project_id).await {
        Ok(overview) => Ok(Json(serde_json::json!(overview))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

// ── Collaborator handlers ────────────────────────────────────────────

pub async fn list_project_collaborators(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    match state.project_service.list_project_collaborators(&ctx, &params.project_id).await {
        Ok(collaborators) => Ok(Json(serde_json::json!({ "items": collaborators }))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

pub async fn upsert_project_collaborator(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<UpsertProjectCollaboratorBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    let request = UpsertProjectCollaboratorRequest {
        user_id: body.user_id,
        email: body.email,
        team_id: body.team_id,
        role: body.role,
        status: None,
        created_by_user_id: None,
        granted_by_user_id: None,
    };
    match state.project_service.upsert_project_collaborator(&ctx, &params.project_id, &request).await {
        Ok(collaborator) => Ok(Json(serde_json::json!(collaborator))),
        Err(e) => Err(error::map_project_error(e, request_trace_id(&web))),
    }
}

// ── Deployment handlers ──────────────────────────────────────────────

pub async fn list_deployments(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = deployment_context(&iam);
    match state.deployment_service.list_deployments(&ctx).await {
        Ok(deployments) => Ok(Json(serde_json::json!({ "items": deployments }))),
        Err(e) => Err(error::map_deployment_error(e, request_trace_id(&web))),
    }
}

pub async fn publish_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<PublishProjectBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let project_ctx = project_context(&iam);
    let deployment_ctx = deployment_context(&iam);
    let project = match state.project_service.get_project(&project_ctx, &params.project_id).await {
        Ok(project) => project,
        Err(error) => return Err(error::map_project_error(error, request_trace_id(&web))),
    };
    let command = PublishProjectCommand {
        workspace_id: project.workspace_id,
        project_id: params.project_id,
        project_name: project.name,
        project_tenant_id: iam.tenant_id.clone(),
        project_organization_id: iam.organization_id.clone(),
        project_owner_id: Some(iam.user_id.clone()),
        project_created_by_user_id: Some(iam.user_id.clone()),
        current_user_id: Some(iam.user_id.clone()),
        request: DeployPublishRequest {
            endpoint_url: None,
            environment_key: body.environment_key,
            release_kind: body.release_kind,
            release_version: body.release_version,
            rollout_stage: None,
            runtime: body.runtime,
            target_id: None,
            target_name: body.target_name,
        },
    };
    match state
        .deployment_service
        .publish_project(&deployment_ctx, &command)
        .await
    {
        Ok(result) => Ok(Json(serde_json::json!(result))),
        Err(e) => Err(error::map_deployment_error(e, request_trace_id(&web))),
    }
}
