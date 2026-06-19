use axum::extract::{Path, Query, State};
use axum::Json;

use sdkwork_birdcoder_router_context::{
    deployment_context, project_context, workspace_context, RequiredIamContext, WebRequestContext,
};
use sdkwork_birdcoder_workspace_service::domain::commands::{
    CreateWorkspaceRequest, UpdateWorkspaceRequest, UpsertWorkspaceMemberRequest,
};
use sdkwork_birdcoder_workspace_service::domain::models::WorkspaceScopedQuery;
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
    WorkspacePathParams,
};

#[derive(Clone)]
pub struct WorkspaceAppState {
    pub workspace_service: WorkspaceService,
    pub project_service: ProjectService,
    pub deployment_service: DeploymentService,
}

// ── Workspace handlers ───────────────────────────────────────────────

pub async fn list_workspaces(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Query(_query): Query<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = workspace_context(&iam);
    let query = WorkspaceScopedQuery {
        root_path: None,
        user_id: None,
        workspace_id: None,
    };
    match state.workspace_service.list_workspaces(&ctx, &query).await {
        Ok(workspaces) => Ok(Json(serde_json::json!({ "items": workspaces }))),
        Err(e) => Err(error::map_workspace_error(e)),
    }
}

pub async fn get_workspace(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = workspace_context(&iam);
    match state.workspace_service.get_workspace(&ctx, &params.workspace_id).await {
        Ok(workspace) => Ok(Json(serde_json::json!(workspace))),
        Err(e) => Err(error::map_workspace_error(e)),
    }
}

pub async fn create_workspace(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Json(body): Json<CreateWorkspaceBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
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
        Ok(workspace) => Ok(Json(serde_json::json!(workspace))),
        Err(e) => Err(error::map_workspace_error(e)),
    }
}

pub async fn update_workspace(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
    Json(body): Json<UpdateWorkspaceBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
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
        Ok(workspace) => Ok(Json(serde_json::json!(workspace))),
        Err(e) => Err(error::map_workspace_error(e)),
    }
}

pub async fn delete_workspace(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = workspace_context(&iam);
    match state.workspace_service.delete_workspace(&ctx, &params.workspace_id).await {
        Ok(result) => Ok(Json(serde_json::json!(result))),
        Err(e) => Err(error::map_workspace_error(e)),
    }
}

pub async fn subscribe_workspace_realtime(
    RequiredIamContext(_iam): RequiredIamContext,
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    Err(error::map_not_implemented(format!(
        "Workspace realtime subscription is not implemented yet (workspaceId={}).",
        params.workspace_id
    )))
}

pub async fn list_workspace_members(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = workspace_context(&iam);
    match state.workspace_service.list_workspace_members(&ctx, &params.workspace_id).await {
        Ok(members) => Ok(Json(serde_json::json!({ "items": members }))),
        Err(e) => Err(error::map_workspace_error(e)),
    }
}

pub async fn upsert_workspace_member(
    _web: WebRequestContext,
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
        Err(e) => Err(error::map_workspace_error(e)),
    }
}

// ── Project handlers ─────────────────────────────────────────────────

pub async fn list_projects(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Query(query): Query<ProjectListQuery>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    let workspace_id = query.workspace_id.as_deref().unwrap_or("default");
    match state.project_service.list_projects(&ctx, workspace_id).await {
        Ok(projects) => Ok(Json(serde_json::json!({ "items": projects }))),
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn get_project(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    match state.project_service.get_project(&ctx, &params.project_id).await {
        Ok(project) => Ok(Json(serde_json::json!(project))),
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn create_project(
    _web: WebRequestContext,
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
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn update_project(
    _web: WebRequestContext,
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
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn delete_project(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    match state.project_service.delete_project(&ctx, &params.project_id).await {
        Ok(result) => Ok(Json(serde_json::json!(result))),
        Err(e) => Err(error::map_project_error(e)),
    }
}

// ── Git handlers ─────────────────────────────────────────────────────

pub async fn get_project_git_overview(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    match state.project_service.get_project_git_overview(&ctx, &params.project_id).await {
        Ok(overview) => Ok(Json(serde_json::json!(overview))),
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn create_project_git_branch(
    _web: WebRequestContext,
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
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn switch_project_git_branch(
    _web: WebRequestContext,
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
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn commit_project_git_changes(
    _web: WebRequestContext,
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
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn push_project_git_branch(
    _web: WebRequestContext,
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
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn create_project_git_worktree(
    _web: WebRequestContext,
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
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn remove_project_git_worktree(
    _web: WebRequestContext,
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
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn prune_project_git_worktrees(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    match state.project_service.prune_project_git_worktrees(&ctx, &params.project_id).await {
        Ok(overview) => Ok(Json(serde_json::json!(overview))),
        Err(e) => Err(error::map_project_error(e)),
    }
}

// ── Collaborator handlers ────────────────────────────────────────────

pub async fn list_project_collaborators(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = project_context(&iam);
    match state.project_service.list_project_collaborators(&ctx, &params.project_id).await {
        Ok(collaborators) => Ok(Json(serde_json::json!({ "items": collaborators }))),
        Err(e) => Err(error::map_project_error(e)),
    }
}

pub async fn upsert_project_collaborator(
    _web: WebRequestContext,
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
        Err(e) => Err(error::map_project_error(e)),
    }
}

// ── Deployment handlers ──────────────────────────────────────────────

pub async fn list_deployments(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = deployment_context(&iam);
    match state.deployment_service.list_deployments(&ctx).await {
        Ok(deployments) => Ok(Json(serde_json::json!({ "items": deployments }))),
        Err(e) => Err(error::map_deployment_error(e)),
    }
}

pub async fn publish_project(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<PublishProjectBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    let ctx = deployment_context(&iam);
    let command = PublishProjectCommand {
        project_id: params.project_id,
        project_name: String::new(),
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
    match state.deployment_service.publish_project(&ctx, &command).await {
        Ok(result) => Ok(Json(serde_json::json!(result))),
        Err(e) => Err(error::map_deployment_error(e)),
    }
}
