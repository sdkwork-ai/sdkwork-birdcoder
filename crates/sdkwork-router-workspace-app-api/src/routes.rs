use axum::{routing::get, routing::post, Router};

use crate::handlers;
use crate::handlers::WorkspaceAppState;
use crate::paths;

pub fn build_workspace_app_router() -> Router<WorkspaceAppState> {
    Router::new()
        .route(
            paths::WORKSPACES_PATH,
            get(handlers::list_workspaces).post(handlers::create_workspace),
        )
        .route(
            paths::WORKSPACE_DETAIL_PATH,
            get(handlers::get_workspace)
                .patch(handlers::update_workspace)
                .delete(handlers::delete_workspace),
        )
        .route(
            paths::WORKSPACE_REALTIME_PATH,
            get(handlers::subscribe_workspace_realtime),
        )
        .route(
            paths::WORKSPACE_MEMBERS_PATH,
            get(handlers::list_workspace_members).post(handlers::upsert_workspace_member),
        )
        .route(
            paths::PROJECTS_PATH,
            get(handlers::list_projects).post(handlers::create_project),
        )
        .route(
            paths::PROJECT_DETAIL_PATH,
            get(handlers::get_project)
                .patch(handlers::update_project)
                .delete(handlers::delete_project),
        )
        .route(
            paths::PROJECT_GIT_OVERVIEW_PATH,
            get(handlers::get_project_git_overview),
        )
        .route(
            paths::PROJECT_GIT_BRANCHES_PATH,
            post(handlers::create_project_git_branch),
        )
        .route(
            paths::PROJECT_GIT_BRANCH_SWITCH_PATH,
            post(handlers::switch_project_git_branch),
        )
        .route(
            paths::PROJECT_GIT_COMMITS_PATH,
            post(handlers::commit_project_git_changes),
        )
        .route(
            paths::PROJECT_GIT_PUSHES_PATH,
            post(handlers::push_project_git_branch),
        )
        .route(
            paths::PROJECT_GIT_WORKTREES_PATH,
            post(handlers::create_project_git_worktree),
        )
        .route(
            paths::PROJECT_GIT_WORKTREE_REMOVALS_PATH,
            post(handlers::remove_project_git_worktree),
        )
        .route(
            paths::PROJECT_GIT_WORKTREE_PRUNE_PATH,
            post(handlers::prune_project_git_worktrees),
        )
        .route(
            paths::PROJECT_COLLABORATORS_PATH,
            get(handlers::list_project_collaborators).post(handlers::upsert_project_collaborator),
        )
        .route(paths::DEPLOYMENTS_PATH, get(handlers::list_deployments))
        .route(
            paths::PROJECT_DEPLOYMENT_TARGETS_PATH,
            get(handlers::list_project_deployment_targets),
        )
        .route(
            paths::PROJECT_PUBLISH_PATH,
            post(handlers::publish_project),
        )
}
