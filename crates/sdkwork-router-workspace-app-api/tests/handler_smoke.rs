use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use async_trait::async_trait;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::events::ProjectEventPublisher;
use sdkwork_birdcoder_project_service::ports::git::{GitMutationError, GitOperations, GitProjectOverview};
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_workspace_repository_sqlx::db::schema::ALL_TABLES_DDL;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::deployment::SqliteDeploymentRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project::SqliteProjectRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqliteWorkspaceRepository;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_birdcoder_workspace_service::ports::events::WorkspaceEventPublisher;
use sdkwork_birdcoder_workspace_service::service::workspace_service::WorkspaceService;
use sdkwork_iam_context_service::{AuthLevel, DeploymentMode, Environment, IamAppContext};
use sdkwork_router_workspace_app_api::{build_workspace_app_router, WorkspaceAppState, WorkspaceRealtimeHub};
use sdkwork_web_core::{
    ServerRequestId, WebApiSurface, WebAuthMode, WebRequestContext, WebTransportFacts,
};
use sqlx::SqlitePool;
use tower::ServiceExt;

struct NoopWorkspaceEvents;

#[async_trait]
impl WorkspaceEventPublisher for NoopWorkspaceEvents {
    async fn publish_workspace_created(&self, _workspace_id: &str) -> Result<(), WorkspaceError> {
        Ok(())
    }

    async fn publish_workspace_updated(&self, _workspace_id: &str) -> Result<(), WorkspaceError> {
        Ok(())
    }

    async fn publish_workspace_deleted(&self, _workspace_id: &str) -> Result<(), WorkspaceError> {
        Ok(())
    }

    async fn publish_workspace_member_added(
        &self,
        _workspace_id: &str,
        _user_id: &str,
    ) -> Result<(), WorkspaceError> {
        Ok(())
    }

    async fn publish_workspace_member_removed(
        &self,
        _workspace_id: &str,
        _user_id: &str,
    ) -> Result<(), WorkspaceError> {
        Ok(())
    }
}

struct NoopProjectEvents;

#[async_trait]
impl ProjectEventPublisher for NoopProjectEvents {
    async fn publish_project_created(
        &self,
        _workspace_id: &str,
        _project_id: &str,
    ) -> Result<(), ProjectError> {
        Ok(())
    }

    async fn publish_project_updated(
        &self,
        _workspace_id: &str,
        _project_id: &str,
    ) -> Result<(), ProjectError> {
        Ok(())
    }

    async fn publish_project_deleted(
        &self,
        _workspace_id: &str,
        _project_id: &str,
    ) -> Result<(), ProjectError> {
        Ok(())
    }

    async fn publish_project_collaborator_added(
        &self,
        _workspace_id: &str,
        _project_id: &str,
        _user_id: &str,
    ) -> Result<(), ProjectError> {
        Ok(())
    }

    async fn publish_project_collaborator_removed(
        &self,
        _workspace_id: &str,
        _project_id: &str,
        _user_id: &str,
    ) -> Result<(), ProjectError> {
        Ok(())
    }
}

struct NoopDeploymentEvents;

#[async_trait]
impl sdkwork_birdcoder_deployment_service::ports::events::DeploymentEventPublisher
    for NoopDeploymentEvents
{
    async fn publish_deployment_created(
        &self,
        _workspace_id: &str,
        _project_id: &str,
        _deployment_id: &str,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn publish_deployment_status_changed(
        &self,
        _workspace_id: &str,
        _project_id: &str,
        _deployment_id: &str,
        _status: &str,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn publish_release_created(
        &self,
        _workspace_id: &str,
        _project_id: &str,
        _release_id: &str,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn publish_audit_event(
        &self,
        _workspace_id: &str,
        _project_id: &str,
        _scope_type: &str,
        _scope_id: &str,
        _event_type: &str,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }
}

struct UnavailableGitOperations;

#[async_trait]
impl GitOperations for UnavailableGitOperations {
    async fn inspect_overview(
        &self,
        _project_root_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate("git unavailable in handler smoke".into()))
    }

    async fn create_branch(
        &self,
        _project_root_path: &str,
        _branch_name: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate("git unavailable in handler smoke".into()))
    }

    async fn switch_branch(
        &self,
        _project_root_path: &str,
        _branch_name: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate("git unavailable in handler smoke".into()))
    }

    async fn commit_changes(
        &self,
        _project_root_path: &str,
        _message: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate("git unavailable in handler smoke".into()))
    }

    async fn push_branch(
        &self,
        _project_root_path: &str,
        _branch_name: Option<&str>,
        _remote_name: Option<&str>,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate("git unavailable in handler smoke".into()))
    }

    async fn create_worktree(
        &self,
        _project_root_path: &str,
        _branch_name: &str,
        _worktree_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate("git unavailable in handler smoke".into()))
    }

    async fn remove_worktree(
        &self,
        _project_root_path: &str,
        _worktree_path: &str,
        _force: bool,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate("git unavailable in handler smoke".into()))
    }

    async fn prune_worktrees(
        &self,
        _project_root_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate("git unavailable in handler smoke".into()))
    }
}

fn test_iam_context() -> IamAppContext {
    IamAppContext::new(
        "1",
        None,
        "handler-smoke-user",
        "handler-smoke-session",
        "birdcoder",
        Environment::Dev,
        DeploymentMode::Local,
        AuthLevel::Password,
        vec![],
        vec![],
    )
}

async fn execute_sql_batch(pool: &SqlitePool, sql: &str) -> Result<(), sqlx::Error> {
    for statement in sql.split(';').map(str::trim).filter(|part| !part.is_empty()) {
        sqlx::query(statement).execute(pool).await?;
    }
    Ok(())
}

async fn test_state() -> WorkspaceAppState {
    let pool = SqlitePool::connect("sqlite::memory:")
        .await
        .expect("open in-memory sqlite");
    execute_sql_batch(&pool, ALL_TABLES_DDL)
        .await
        .expect("apply workspace schema");

    let realtime_hub = WorkspaceRealtimeHub::new();
    let workspace_service = WorkspaceService::new(
        Arc::new(SqliteWorkspaceRepository::new(pool.clone())),
        Arc::new(NoopWorkspaceEvents),
    );
    let project_service = ProjectService::new(
        Arc::new(SqliteProjectRepository::new(pool.clone())),
        Arc::new(NoopProjectEvents),
        Arc::new(UnavailableGitOperations),
    );
    let deployment_service = DeploymentService::new(
        Arc::new(SqliteDeploymentRepository::new(pool)),
        Arc::new(NoopDeploymentEvents),
    );

    WorkspaceAppState {
        workspace_service,
        project_service,
        deployment_service,
        realtime_hub,
    }
}

fn with_request_context(mut request: Request<Body>, iam: Option<IamAppContext>) -> Request<Body> {
    let path = request.uri().path().to_owned();
    let method = request.method().as_str().to_owned();
    request.extensions_mut().insert(WebRequestContext {
        request_id: ServerRequestId("handler-smoke-request".to_owned()),
        api_surface: WebApiSurface::AppApi,
        auth_mode: WebAuthMode::DualToken,
        transport: WebTransportFacts {
            path,
            method,
            auth_token_present: true,
            access_token_present: true,
            api_key_present: false,
            oauth_bearer_present: false,
        },
        principal: None,
        locale: None,
        client_kind: None,
        operation: None,
    });
    if let Some(iam) = iam {
        request.extensions_mut().insert(iam);
    }
    request
}

#[test]
fn platform_router_builds_without_error() {
    let _router = build_workspace_app_router();
}

#[tokio::test]
async fn list_workspaces_requires_authentication() {
    let response = build_workspace_app_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/workspaces")
                .body(Body::empty())
                .expect("build list workspaces request"),
            None,
        ))
        .await
        .expect("serve list workspaces request");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_workspaces_returns_ok_with_empty_inventory() {
    let response = build_workspace_app_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/workspaces")
                .body(Body::empty())
                .expect("build list workspaces request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve list workspaces request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read list workspaces body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse list workspaces JSON");
    assert_eq!(json["items"].as_array().map(Vec::len), Some(0));
    assert_eq!(json["meta"]["total"], 0);
    assert_eq!(json["meta"]["pageSize"], 20);
    assert_eq!(json["meta"]["page"], 1);
    assert_eq!(json["meta"]["version"], "v1");
    assert_eq!(json["requestId"], "handler-smoke-request");
    assert!(json["timestamp"].is_string());
}
