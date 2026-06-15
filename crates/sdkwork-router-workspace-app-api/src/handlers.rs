use axum::extract::{Path, Query};
use axum::Json;

use crate::error;
use crate::mapper::request::{
    CreateGitBranchBody, CreateGitWorktreeBody, CreateProjectBody, CreateWorkspaceBody,
    CommitGitChangesBody, ProjectListQuery, ProjectPathParams, PublishProjectBody,
    PushGitBranchBody, RemoveGitWorktreeBody, SwitchGitBranchBody, UpdateProjectBody,
    UpdateWorkspaceBody, UpsertProjectCollaboratorBody, UpsertWorkspaceMemberBody,
    WorkspacePathParams,
};

// ── Workspace handlers ───────────────────────────────────────────────

pub async fn list_workspaces(
    Query(_query): Query<serde_json::Value>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "todo", "items": [] }))
}

pub async fn get_workspace(
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = &params.workspace_id;
    Ok(Json(serde_json::json!({ "status": "todo", "id": params.workspace_id })))
}

pub async fn create_workspace(
    Json(body): Json<CreateWorkspaceBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = body.name;
    Ok(Json(serde_json::json!({ "status": "todo", "action": "create" })))
}

pub async fn update_workspace(
    Path(params): Path<WorkspacePathParams>,
    Json(body): Json<UpdateWorkspaceBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.workspace_id, &body.name);
    Ok(Json(serde_json::json!({ "status": "todo", "id": params.workspace_id })))
}

pub async fn delete_workspace(
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = &params.workspace_id;
    Ok(Json(serde_json::json!({ "status": "todo", "id": params.workspace_id })))
}

pub async fn subscribe_workspace_realtime(
    Path(params): Path<WorkspacePathParams>,
) -> Json<serde_json::Value> {
    let _ = &params.workspace_id;
    Json(serde_json::json!({ "status": "todo", "workspaceId": params.workspace_id }))
}

pub async fn list_workspace_members(
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = &params.workspace_id;
    Ok(Json(serde_json::json!({ "status": "todo", "items": [] })))
}

pub async fn upsert_workspace_member(
    Path(params): Path<WorkspacePathParams>,
    Json(body): Json<UpsertWorkspaceMemberBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.workspace_id, &body.user_id);
    Ok(Json(serde_json::json!({ "status": "todo", "action": "upsert" })))
}

// ── Project handlers ─────────────────────────────────────────────────

pub async fn list_projects(
    Query(query): Query<ProjectListQuery>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "todo", "items": [], "workspaceId": query.workspace_id }))
}

pub async fn get_project(
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = &params.project_id;
    Ok(Json(serde_json::json!({ "status": "todo", "id": params.project_id })))
}

pub async fn create_project(
    Json(body): Json<CreateProjectBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&body.workspace_id, &body.name);
    Ok(Json(serde_json::json!({ "status": "todo", "action": "create" })))
}

pub async fn update_project(
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<UpdateProjectBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.project_id, &body.name);
    Ok(Json(serde_json::json!({ "status": "todo", "id": params.project_id })))
}

pub async fn delete_project(
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = &params.project_id;
    Ok(Json(serde_json::json!({ "status": "todo", "id": params.project_id })))
}

// ── Project Git handlers ─────────────────────────────────────────────

pub async fn get_project_git_overview(
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = &params.project_id;
    Ok(Json(serde_json::json!({ "status": "todo", "projectId": params.project_id })))
}

pub async fn create_project_git_branch(
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CreateGitBranchBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.project_id, &body.branch_name);
    Ok(Json(serde_json::json!({ "status": "todo", "action": "create_branch" })))
}

pub async fn switch_project_git_branch(
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<SwitchGitBranchBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.project_id, &body.branch_name);
    Ok(Json(serde_json::json!({ "status": "todo", "action": "switch_branch" })))
}

pub async fn commit_project_git_changes(
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CommitGitChangesBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.project_id, &body.message);
    Ok(Json(serde_json::json!({ "status": "todo", "action": "commit" })))
}

pub async fn push_project_git_branch(
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<PushGitBranchBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.project_id, &body.branch_name);
    Ok(Json(serde_json::json!({ "status": "todo", "action": "push" })))
}

pub async fn create_project_git_worktree(
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CreateGitWorktreeBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.project_id, &body.branch_name, &body.path);
    Ok(Json(serde_json::json!({ "status": "todo", "action": "create_worktree" })))
}

pub async fn remove_project_git_worktree(
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<RemoveGitWorktreeBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.project_id, &body.path);
    Ok(Json(serde_json::json!({ "status": "todo", "action": "remove_worktree" })))
}

pub async fn prune_project_git_worktrees(
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = &params.project_id;
    Ok(Json(serde_json::json!({ "status": "todo", "action": "prune_worktrees" })))
}

// ── Collaborator handlers ────────────────────────────────────────────

pub async fn list_project_collaborators(
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = &params.project_id;
    Ok(Json(serde_json::json!({ "status": "todo", "items": [] })))
}

pub async fn upsert_project_collaborator(
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<UpsertProjectCollaboratorBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.project_id, &body.user_id);
    Ok(Json(serde_json::json!({ "status": "todo", "action": "upsert" })))
}

// ── Deployment handlers ──────────────────────────────────────────────

pub async fn list_deployments() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "todo", "items": [] }))
}

pub async fn publish_project(
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<PublishProjectBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.project_id, &body.environment_key);
    Ok(Json(serde_json::json!({ "status": "todo", "action": "publish" })))
}
