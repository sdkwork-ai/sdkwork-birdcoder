use std::path::PathBuf;
use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::events::ProjectEventPublisher;
use sdkwork_birdcoder_project_service::ports::git::{
    GitMutationError, GitOperations, GitProjectDiff, GitProjectOverview,
};
use sdkwork_birdcoder_project_service::ports::project_workspace_root::ProjectWorkspaceRootResolver;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_workspace_repository_sqlx::db::schema::ALL_TABLES_DDL;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::deployment::SqliteDeploymentRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project::SqliteProjectRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::team::SqliteTeamRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqliteWorkspaceRepository;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_birdcoder_workspace_service::ports::events::WorkspaceEventPublisher;
use sdkwork_birdcoder_workspace_service::service::team_service::TeamService;
use sdkwork_birdcoder_workspace_service::service::workspace_service::WorkspaceService;
use sdkwork_database_config::{DatabaseConfig, DatabaseEngine, DeploymentMode};
use sdkwork_database_sqlx::create_any_pool_from_config;
use sdkwork_iam_context_service::{
    AuthLevel, DeploymentMode as IamDeploymentMode, Environment, IamAppContext,
};
use sdkwork_routes_workspace_app_api::{
    build_workspace_app_router, WorkspaceAppState, WorkspaceRealtimeHub,
};
use sdkwork_web_core::{
    ServerRequestId, WebApiSurface, WebAuthMode, WebRequestContext, WebTransportFacts,
};
use sqlx::AnyPool;
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

struct UnavailableProjectWorkspaceRootResolver;

impl ProjectWorkspaceRootResolver for UnavailableProjectWorkspaceRootResolver {
    fn resolve_project_root(
        &self,
        _context: &sdkwork_birdcoder_project_service::context::ProjectContext,
        _workspace_id: &str,
        _project_id: &str,
    ) -> Result<PathBuf, ProjectError> {
        Err(ProjectError::GitOperation(
            "server project workspace is unavailable in handler smoke".to_owned(),
        ))
    }
}

#[async_trait]
impl GitOperations for UnavailableGitOperations {
    async fn inspect_overview(
        &self,
        _project_root_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "git unavailable in handler smoke".into(),
        ))
    }

    async fn inspect_diff(
        &self,
        _project_root_path: &str,
    ) -> Result<GitProjectDiff, GitMutationError> {
        Err(GitMutationError::Mutate(
            "git unavailable in handler smoke".into(),
        ))
    }

    async fn create_branch(
        &self,
        _project_root_path: &str,
        _branch_name: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "git unavailable in handler smoke".into(),
        ))
    }

    async fn switch_branch(
        &self,
        _project_root_path: &str,
        _branch_name: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "git unavailable in handler smoke".into(),
        ))
    }

    async fn commit_changes(
        &self,
        _project_root_path: &str,
        _message: &str,
        _include_unstaged: bool,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "git unavailable in handler smoke".into(),
        ))
    }

    async fn push_branch(
        &self,
        _project_root_path: &str,
        _branch_name: Option<&str>,
        _remote_name: Option<&str>,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "git unavailable in handler smoke".into(),
        ))
    }

    async fn create_worktree(
        &self,
        _project_root_path: &str,
        _branch_name: &str,
        _worktree_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "git unavailable in handler smoke".into(),
        ))
    }

    async fn remove_worktree(
        &self,
        _project_root_path: &str,
        _worktree_path: &str,
        _force: bool,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "git unavailable in handler smoke".into(),
        ))
    }

    async fn prune_worktrees(
        &self,
        _project_root_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        Err(GitMutationError::Mutate(
            "git unavailable in handler smoke".into(),
        ))
    }
}

fn test_iam_context() -> IamAppContext {
    IamAppContext::new(
        "100001",
        None,
        "100001",
        "handler-smoke-session",
        "birdcoder",
        Environment::Dev,
        IamDeploymentMode::Local,
        AuthLevel::Password,
        vec![],
        vec![],
    )
}

async fn execute_sql_batch(pool: &AnyPool, sql: &str) -> Result<(), sqlx::Error> {
    for statement in sql
        .split(';')
        .map(str::trim)
        .filter(|part| !part.is_empty())
    {
        sqlx::query(statement).execute(pool).await?;
    }
    Ok(())
}

async fn test_any_pool() -> AnyPool {
    sqlx::any::install_default_drivers();
    create_any_pool_from_config(DatabaseConfig {
        engine: DatabaseEngine::Sqlite,
        url: "sqlite::memory:".to_string(),
        mode: DeploymentMode::Standalone,
        max_connections: 1,
        ..DatabaseConfig::default()
    })
    .await
    .expect("open in-memory sqlite any pool")
}

async fn test_state() -> WorkspaceAppState {
    let pool = test_any_pool().await;
    execute_sql_batch(&pool, ALL_TABLES_DDL)
        .await
        .expect("apply workspace schema");

    let realtime_hub = WorkspaceRealtimeHub::new();
    let workspace_service = WorkspaceService::new(
        Arc::new(SqliteWorkspaceRepository::new(pool.clone())),
        Arc::new(NoopWorkspaceEvents),
    );
    let team_service = TeamService::new(
        Arc::new(SqliteTeamRepository::new(pool.clone())),
        Arc::new(SqliteWorkspaceRepository::new(pool.clone())),
    );
    let project_service = ProjectService::new(
        Arc::new(SqliteProjectRepository::new(pool.clone())),
        Arc::new(NoopProjectEvents),
        Arc::new(UnavailableGitOperations),
        Arc::new(UnavailableProjectWorkspaceRootResolver),
    );
    let deployment_service = DeploymentService::new(
        Arc::new(SqliteDeploymentRepository::new(pool)),
        Arc::new(NoopDeploymentEvents),
    );

    WorkspaceAppState {
        workspace_service,
        project_service,
        deployment_service,
        team_service,
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
            agent_token_present: false,
        },
        principal: None,
        locale: None,
        client_kind: None,
        operation: None,
        trace_id: None,
        idempotency_key: None,
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
    let json: serde_json::Value =
        serde_json::from_slice(&body).expect("parse list workspaces JSON");
    assert_eq!(json["code"], 0);
    assert_eq!(json["traceId"], "handler-smoke-request");
    assert_eq!(json["data"]["items"].as_array().map(Vec::len), Some(0));
    assert_eq!(json["data"]["pageInfo"]["mode"], "offset");
    assert_eq!(json["data"]["pageInfo"]["pageSize"], 20);
    assert_eq!(json["data"]["pageInfo"]["page"], 1);
    assert_eq!(json["data"]["pageInfo"]["totalItems"], "0");
}

#[tokio::test]
async fn personal_session_can_create_and_list_projects() {
    let app = build_workspace_app_router().with_state(test_state().await);
    let workspace_response = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("POST")
                .uri("/app/v3/api/workspaces")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"name":"Personal workspace"}"#))
                .expect("build create workspace request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve create workspace request");
    assert_eq!(workspace_response.status(), StatusCode::OK);
    let workspace_body = axum::body::to_bytes(workspace_response.into_body(), 64 * 1024)
        .await
        .expect("read create workspace body");
    let workspace_json: serde_json::Value =
        serde_json::from_slice(&workspace_body).expect("parse create workspace JSON");
    let workspace_id = workspace_json["data"]["item"]["id"]
        .as_str()
        .expect("created workspace id");

    let project_response = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("POST")
                .uri("/app/v3/api/projects")
                .header("content-type", "application/json")
                .body(Body::from(format!(
                    r#"{{"workspaceId":"{workspace_id}","name":"Personal project"}}"#
                )))
                .expect("build create project request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve create project request");
    assert_eq!(project_response.status(), StatusCode::OK);

    let list_response = app
        .oneshot(with_request_context(
            Request::builder()
                .uri(format!(
                    "/app/v3/api/projects?workspaceId={workspace_id}&page=1&page_size=20"
                ))
                .body(Body::empty())
                .expect("build list projects request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve list projects request");
    assert_eq!(list_response.status(), StatusCode::OK);
    let list_body = axum::body::to_bytes(list_response.into_body(), 64 * 1024)
        .await
        .expect("read list projects body");
    let list_json: serde_json::Value =
        serde_json::from_slice(&list_body).expect("parse list projects JSON");
    assert_eq!(list_json["code"], 0);
    assert_eq!(list_json["data"]["items"].as_array().map(Vec::len), Some(1));
    assert_eq!(list_json["data"]["items"][0]["name"], "Personal project");
    assert_eq!(list_json["data"]["items"][0]["organizationId"], "0");
    assert_eq!(list_json["data"]["pageInfo"]["totalItems"], "1");
}

#[tokio::test]
async fn list_workspaces_rejects_over_max_page_size_before_repository_access() {
    let response = build_workspace_app_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/workspaces?page_size=201")
                .body(Body::empty())
                .expect("build invalid list workspaces request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve invalid list workspaces request");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok()),
        Some("application/problem+json")
    );
    let body = axum::body::to_bytes(response.into_body(), 64 * 1024)
        .await
        .expect("read bounded invalid pagination response");
    let problem: serde_json::Value =
        serde_json::from_slice(&body).expect("parse invalid pagination problem");
    assert_eq!(problem["code"], 40003);
    assert_eq!(problem["traceId"], "handler-smoke-request");
}

#[tokio::test]
async fn list_teams_requires_authentication() {
    let response = build_workspace_app_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/teams")
                .body(Body::empty())
                .expect("build list teams request"),
            None,
        ))
        .await
        .expect("serve list teams request");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_teams_returns_ok_with_empty_inventory() {
    let response = build_workspace_app_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/teams")
                .body(Body::empty())
                .expect("build list teams request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve list teams request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read list teams body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse list teams JSON");
    assert_eq!(json["code"], 0);
    assert_eq!(json["traceId"], "handler-smoke-request");
    assert_eq!(json["data"]["items"].as_array().map(Vec::len), Some(0));
    assert_eq!(json["data"]["pageInfo"]["totalItems"], "0");
}
