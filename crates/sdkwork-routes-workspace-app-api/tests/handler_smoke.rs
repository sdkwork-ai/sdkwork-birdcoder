use std::path::PathBuf;
use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use sdkwork_birdcoder_deployment_service::context::DeploymentContext;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;
use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::events::ProjectEventPublisher;
use sdkwork_birdcoder_project_service::ports::git::{
    GitMutationError, GitOperations, GitProjectDiff, GitProjectOverview,
};
use sdkwork_birdcoder_project_service::ports::project_workspace_root::ProjectWorkspaceRootResolver;
use sdkwork_birdcoder_project_service::ports::repository::ProjectRepository;
use sdkwork_birdcoder_project_service::ports::runtime_location_execution::DenyRuntimeLocationTargetExecutionAuthority;
use sdkwork_birdcoder_project_service::ports::runtime_location_path_cipher::AesGcmRuntimeLocationPathCipher;
use sdkwork_birdcoder_project_service::ports::runtime_location_verification::{
    DenyRuntimeLocationVerificationAuthority, DenyRuntimeLocationVerificationRequestDispatcher,
};
use sdkwork_birdcoder_project_service::service::project_runtime_location_service::ProjectRuntimeLocationService;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_project_service::domain::sandbox_binding::{
    NewProjectSandboxBinding, ProjectSandboxBindingAuditEntry, ProjectSandboxBindingPayload,
};
use sdkwork_birdcoder_project_service::ports::sandbox_binding_repository::ProjectSandboxBindingRepository;
use sdkwork_birdcoder_project_service::service::project_sandbox_binding_service::ProjectSandboxBindingService;
use sdkwork_birdcoder_workspace_repository_sqlx::db::schema::ALL_TABLES_DDL;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::deployment::SqliteDeploymentRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project::SqliteProjectRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project_runtime_location::SqliteProjectRuntimeLocationRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::team::SqliteTeamRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqliteWorkspaceRepository;
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
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
use std::sync::Mutex;
use tower::ServiceExt;

struct NoopWorkspaceEvents;

#[derive(Clone, Default)]
struct TestSandboxBindingRepository {
    binding: Arc<Mutex<Option<ProjectSandboxBindingPayload>>>,
}

#[async_trait]
impl ProjectSandboxBindingRepository for TestSandboxBindingRepository {
    async fn get_sandbox_binding(
        &self,
        _context: &sdkwork_birdcoder_project_service::context::ProjectContext,
        project_id: &str,
    ) -> Result<Option<ProjectSandboxBindingPayload>, ProjectError> {
        Ok(self
            .binding
            .lock()
            .expect("read sandbox binding")
            .clone()
            .filter(|binding| binding.project_id == project_id))
    }

    async fn upsert_sandbox_binding(
        &self,
        _context: &sdkwork_birdcoder_project_service::context::ProjectContext,
        binding: &NewProjectSandboxBinding,
        _audit: &ProjectSandboxBindingAuditEntry,
    ) -> Result<ProjectSandboxBindingPayload, ProjectError> {
        let mut stored = self.binding.lock().expect("write sandbox binding");
        let version = match stored.as_ref() {
            Some(current) => {
                let current_version = current
                    .version
                    .parse::<i64>()
                    .map_err(|_| ProjectError::Internal("invalid test version".to_owned()))?;
                if binding.expected_version != Some(current_version) {
                    return Err(ProjectError::PreconditionFailed(
                        "Sandbox-binding version does not match If-Match.".to_owned(),
                    ));
                }
                current_version + 1
            }
            None if binding.expected_version.is_some() => {
                return Err(ProjectError::PreconditionFailed(
                    "Project sandbox binding does not exist for the supplied If-Match.".to_owned(),
                ));
            }
            None => 0,
        };
        let value = ProjectSandboxBindingPayload {
            id: "700000000000000001".to_owned(),
            project_id: binding.project_id.clone(),
            sandbox_id: binding.sandbox_id.clone(),
            root_entry_id: binding.root_entry_id.clone(),
            logical_path: binding.logical_path.clone(),
            status: binding.status.clone(),
            version: version.to_string(),
            created_at: "2026-01-01T00:00:00Z".to_owned(),
            updated_at: "2026-01-01T00:00:00Z".to_owned(),
        };
        *stored = Some(value.clone());
        Ok(value)
    }

    async fn delete_sandbox_binding(
        &self,
        _context: &sdkwork_birdcoder_project_service::context::ProjectContext,
        project_id: &str,
        expected_version: i64,
        _audit: &ProjectSandboxBindingAuditEntry,
    ) -> Result<(), ProjectError> {
        let mut stored = self.binding.lock().expect("delete sandbox binding");
        let current = stored
            .as_ref()
            .filter(|binding| binding.project_id == project_id)
            .ok_or_else(|| {
                ProjectError::NotFound("Project sandbox binding was not found.".to_owned())
            })?;
        if current.version != expected_version.to_string() {
            return Err(ProjectError::PreconditionFailed(
                "Sandbox-binding version does not match If-Match.".to_owned(),
            ));
        }
        *stored = None;
        Ok(())
    }
}

#[async_trait]
impl WorkspaceEventPublisher for NoopWorkspaceEvents {
    async fn publish_workspace_created(
        &self,
        _ctx: &WorkspaceContext,
        _workspace_id: &str,
    ) -> Result<(), WorkspaceError> {
        Ok(())
    }

    async fn publish_workspace_updated(
        &self,
        _ctx: &WorkspaceContext,
        _workspace_id: &str,
    ) -> Result<(), WorkspaceError> {
        Ok(())
    }

    async fn publish_workspace_deleted(
        &self,
        _ctx: &WorkspaceContext,
        _workspace_id: &str,
    ) -> Result<(), WorkspaceError> {
        Ok(())
    }

    async fn publish_workspace_member_added(
        &self,
        _ctx: &WorkspaceContext,
        _workspace_id: &str,
        _user_id: &str,
    ) -> Result<(), WorkspaceError> {
        Ok(())
    }

    async fn publish_workspace_member_removed(
        &self,
        _ctx: &WorkspaceContext,
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
        _ctx: &ProjectContext,
        _workspace_id: &str,
        _project_id: &str,
    ) -> Result<(), ProjectError> {
        Ok(())
    }

    async fn publish_project_updated(
        &self,
        _ctx: &ProjectContext,
        _workspace_id: &str,
        _project_id: &str,
    ) -> Result<(), ProjectError> {
        Ok(())
    }

    async fn publish_project_deleted(
        &self,
        _ctx: &ProjectContext,
        _workspace_id: &str,
        _project_id: &str,
    ) -> Result<(), ProjectError> {
        Ok(())
    }

    async fn publish_project_collaborator_added(
        &self,
        _ctx: &ProjectContext,
        _workspace_id: &str,
        _project_id: &str,
        _user_id: &str,
    ) -> Result<(), ProjectError> {
        Ok(())
    }

    async fn publish_project_collaborator_removed(
        &self,
        _ctx: &ProjectContext,
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
        _ctx: &DeploymentContext,
        _workspace_id: &str,
        _project_id: &str,
        _deployment_id: &str,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn publish_deployment_status_changed(
        &self,
        _ctx: &DeploymentContext,
        _workspace_id: &str,
        _project_id: &str,
        _deployment_id: &str,
        _status: &str,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn publish_release_created(
        &self,
        _ctx: &DeploymentContext,
        _workspace_id: &str,
        _project_id: &str,
        _release_id: &str,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn publish_audit_event(
        &self,
        _ctx: &DeploymentContext,
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
    let project_repository: Arc<dyn ProjectRepository> =
        Arc::new(SqliteProjectRepository::new(pool.clone()));
    let project_workspace_root_resolver: Arc<dyn ProjectWorkspaceRootResolver> =
        Arc::new(UnavailableProjectWorkspaceRootResolver);
    let runtime_location_service = ProjectRuntimeLocationService::new(
        project_repository.clone(),
        Arc::new(SqliteProjectRuntimeLocationRepository::new(pool.clone())),
        Arc::new(
            AesGcmRuntimeLocationPathCipher::new(
                b"handler-smoke-runtime-location-master-key-material",
                "handler-smoke-v1",
            )
            .expect("construct test runtime-location cipher"),
        ),
        Arc::new(DenyRuntimeLocationVerificationAuthority),
        Arc::new(DenyRuntimeLocationVerificationRequestDispatcher),
        project_workspace_root_resolver.clone(),
        Arc::new(DenyRuntimeLocationTargetExecutionAuthority),
    );
    let project_service = ProjectService::new(
        project_repository.clone(),
        Arc::new(NoopProjectEvents),
        Arc::new(UnavailableGitOperations),
        project_workspace_root_resolver.clone(),
        Arc::new(runtime_location_service.clone()),
    );
    let sandbox_binding_service = ProjectSandboxBindingService::new(
        project_repository,
        Arc::new(TestSandboxBindingRepository::default()),
    );
    let deployment_service = DeploymentService::new(
        Arc::new(SqliteDeploymentRepository::new(pool)),
        Arc::new(NoopDeploymentEvents),
    );

    WorkspaceAppState {
        workspace_service,
        project_service,
        runtime_location_service,
        sandbox_binding_service,
        deployment_service,
        team_service,
        realtime_hub,
        realtime_replay_provider: None,
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

async fn create_project_for_runtime_location_test(app: &axum::Router) -> String {
    let workspace_response = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("POST")
                .uri("/app/v3/api/workspaces")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"name":"Runtime location workspace"}"#))
                .expect("build runtime-location workspace request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("create runtime-location workspace");
    assert_eq!(workspace_response.status(), StatusCode::CREATED);
    let workspace_body = axum::body::to_bytes(workspace_response.into_body(), 64 * 1024)
        .await
        .expect("read runtime-location workspace body");
    let workspace_json: serde_json::Value =
        serde_json::from_slice(&workspace_body).expect("parse runtime-location workspace JSON");
    let workspace_id = workspace_json["data"]["item"]["id"]
        .as_str()
        .expect("created runtime-location workspace id");

    let project_response = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("POST")
                .uri("/app/v3/api/projects")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "workspaceId": workspace_id,
                        "name": "Runtime location project",
                    })
                    .to_string(),
                ))
                .expect("build runtime-location project request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("create runtime-location project");
    assert_eq!(project_response.status(), StatusCode::OK);
    let project_body = axum::body::to_bytes(project_response.into_body(), 64 * 1024)
        .await
        .expect("read runtime-location project body");
    let project_json: serde_json::Value =
        serde_json::from_slice(&project_body).expect("parse runtime-location project JSON");
    project_json["data"]["item"]["id"]
        .as_str()
        .expect("created runtime-location project id")
        .to_owned()
}

async fn read_response_json(response: axum::response::Response) -> serde_json::Value {
    let body = axum::body::to_bytes(response.into_body(), 64 * 1024)
        .await
        .expect("read JSON response body");
    serde_json::from_slice(&body).expect("parse JSON response body")
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
    assert_eq!(workspace_response.status(), StatusCode::CREATED);
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
async fn sandbox_binding_handlers_close_idempotency_concurrency_and_redaction_contracts() {
    let app = build_workspace_app_router().with_state(test_state().await);
    let project_id = create_project_for_runtime_location_test(&app).await;
    let path = format!("/app/v3/api/projects/{project_id}/sandbox_binding");

    let missing = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .uri(&path)
                .body(Body::empty())
                .expect("build missing sandbox-binding request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve missing sandbox-binding request");
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);
    assert_eq!(read_response_json(missing).await["code"], 40401);

    let create_body = serde_json::json!({
        "sandboxId": "sandbox:handler-smoke",
        "rootEntryId": "entry:handler-smoke-root",
        "logicalPath": "source files",
    })
    .to_string();
    let missing_idempotency = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("PUT")
                .uri(&path)
                .header("content-type", "application/json")
                .body(Body::from(create_body.clone()))
                .expect("build sandbox-binding request without idempotency"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve sandbox-binding request without idempotency");
    assert_eq!(
        missing_idempotency.status(),
        StatusCode::PRECONDITION_REQUIRED
    );
    assert_eq!(read_response_json(missing_idempotency).await["code"], 42801);

    let physical_path_injection = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("PUT")
                .uri(&path)
                .header("content-type", "application/json")
                .header("idempotency-key", "sandbox-binding-invalid-1")
                .body(Body::from(
                    serde_json::json!({
                        "sandboxId": "sandbox:handler-smoke",
                        "rootEntryId": "entry:handler-smoke-root",
                        "logicalPath": "source files",
                        "physicalPath": r"C:\\private\\project",
                    })
                    .to_string(),
                ))
                .expect("build sandbox-binding physical-path injection request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve sandbox-binding physical-path injection request");
    assert_eq!(physical_path_injection.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        physical_path_injection
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok()),
        Some("application/problem+json")
    );
    let physical_path_problem = read_response_json(physical_path_injection).await;
    assert_eq!(physical_path_problem["code"], 40001);
    assert!(!physical_path_problem.to_string().contains("C:\\\\private"));

    let created = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("PUT")
                .uri(&path)
                .header("content-type", "application/json")
                .header("idempotency-key", "sandbox-binding-create-1")
                .body(Body::from(create_body.clone()))
                .expect("build sandbox-binding create request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve sandbox-binding create request");
    assert_eq!(created.status(), StatusCode::OK);
    let created_json = read_response_json(created).await;
    assert_eq!(created_json["code"], 0);
    assert_eq!(created_json["traceId"], "handler-smoke-request");
    assert_eq!(
        created_json["data"]["item"]["sandboxId"],
        "sandbox:handler-smoke"
    );
    assert_eq!(
        created_json["data"]["item"]["rootEntryId"],
        "entry:handler-smoke-root"
    );
    assert_eq!(created_json["data"]["item"]["logicalPath"], "source files");
    assert_eq!(created_json["data"]["item"]["version"], "0");
    let binding_id = created_json["data"]["item"]["id"]
        .as_str()
        .expect("created sandbox-binding id")
        .to_owned();
    for forbidden in [
        "absolutePath",
        "browserHandle",
        "filesystemHandle",
        "physicalPath",
        "providerRoot",
        "tauriPath",
    ] {
        assert!(created_json["data"]["item"].get(forbidden).is_none());
    }

    let replay = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("PUT")
                .uri(&path)
                .header("content-type", "application/json")
                .header("idempotency-key", "sandbox-binding-create-1")
                .body(Body::from(create_body))
                .expect("build sandbox-binding replay request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve sandbox-binding replay request");
    assert_eq!(replay.status(), StatusCode::OK);
    let replay_json = read_response_json(replay).await;
    assert_eq!(replay_json["data"]["item"]["id"], binding_id);
    assert_eq!(replay_json["data"]["item"]["version"], "0");

    let changed_body = serde_json::json!({
        "sandboxId": "sandbox:handler-smoke-updated",
        "rootEntryId": "entry:handler-smoke-updated",
        "logicalPath": " source files / feature ",
    })
    .to_string();
    let conflicting_replay = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("PUT")
                .uri(&path)
                .header("content-type", "application/json")
                .header("idempotency-key", "sandbox-binding-create-1")
                .body(Body::from(changed_body.clone()))
                .expect("build conflicting sandbox-binding replay"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve conflicting sandbox-binding replay");
    assert_eq!(conflicting_replay.status(), StatusCode::CONFLICT);
    assert_eq!(read_response_json(conflicting_replay).await["code"], 40901);

    let missing_if_match = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("PUT")
                .uri(&path)
                .header("content-type", "application/json")
                .header("idempotency-key", "sandbox-binding-update-missing-1")
                .body(Body::from(changed_body.clone()))
                .expect("build sandbox-binding update without If-Match"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve sandbox-binding update without If-Match");
    assert_eq!(missing_if_match.status(), StatusCode::PRECONDITION_REQUIRED);
    assert_eq!(read_response_json(missing_if_match).await["code"], 42801);

    let stale_if_match = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("PUT")
                .uri(&path)
                .header("content-type", "application/json")
                .header("idempotency-key", "sandbox-binding-update-stale-1")
                .header("if-match", "7")
                .body(Body::from(changed_body.clone()))
                .expect("build stale sandbox-binding update"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve stale sandbox-binding update");
    assert_eq!(stale_if_match.status(), StatusCode::PRECONDITION_FAILED);
    assert_eq!(read_response_json(stale_if_match).await["code"], 41201);

    let updated = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("PUT")
                .uri(&path)
                .header("content-type", "application/json")
                .header("idempotency-key", "sandbox-binding-update-1")
                .header("if-match", "0")
                .body(Body::from(changed_body))
                .expect("build sandbox-binding update"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve sandbox-binding update");
    assert_eq!(updated.status(), StatusCode::OK);
    let updated_json = read_response_json(updated).await;
    assert_eq!(updated_json["data"]["item"]["id"], binding_id);
    assert_eq!(updated_json["data"]["item"]["version"], "1");
    assert_eq!(
        updated_json["data"]["item"]["logicalPath"],
        " source files / feature "
    );

    let retrieved = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .uri(&path)
                .body(Body::empty())
                .expect("build sandbox-binding get request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve sandbox-binding get request");
    assert_eq!(retrieved.status(), StatusCode::OK);
    let retrieved_json = read_response_json(retrieved).await;
    assert_eq!(retrieved_json["data"]["item"], updated_json["data"]["item"]);

    let delete_without_if_match = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("DELETE")
                .uri(&path)
                .body(Body::empty())
                .expect("build sandbox-binding delete without If-Match"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve sandbox-binding delete without If-Match");
    assert_eq!(
        delete_without_if_match.status(),
        StatusCode::PRECONDITION_REQUIRED
    );
    assert_eq!(
        read_response_json(delete_without_if_match).await["code"],
        42801
    );

    let stale_delete = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("DELETE")
                .uri(&path)
                .header("if-match", "0")
                .body(Body::empty())
                .expect("build stale sandbox-binding delete"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve stale sandbox-binding delete");
    assert_eq!(stale_delete.status(), StatusCode::PRECONDITION_FAILED);
    assert_eq!(read_response_json(stale_delete).await["code"], 41201);

    let deleted = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("DELETE")
                .uri(&path)
                .header("if-match", "1")
                .body(Body::empty())
                .expect("build sandbox-binding delete"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve sandbox-binding delete");
    assert_eq!(deleted.status(), StatusCode::NO_CONTENT);
    let deleted_body = axum::body::to_bytes(deleted.into_body(), 64 * 1024)
        .await
        .expect("read sandbox-binding delete body");
    assert!(deleted_body.is_empty());

    let after_delete = app
        .oneshot(with_request_context(
            Request::builder()
                .uri(&path)
                .body(Body::empty())
                .expect("build deleted sandbox-binding get request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve deleted sandbox-binding get request");
    assert_eq!(after_delete.status(), StatusCode::NOT_FOUND);
    assert_eq!(read_response_json(after_delete).await["code"], 40401);
}

#[tokio::test]
async fn runtime_location_handlers_enforce_preconditions_and_redact_paths() {
    let app = build_workspace_app_router().with_state(test_state().await);
    let project_id = create_project_for_runtime_location_test(&app).await;
    let collection_path = format!("/app/v3/api/projects/{project_id}/runtime_locations");
    let location_body = serde_json::json!({
        "runtimeTargetId": "desktop-device:handler-smoke",
        "runtimeTargetKind": "desktop_device",
        "locationKind": "desktop_checkout",
        "pathFlavor": "windows",
        "rootLocator": "desktop-root:handler-smoke",
        "absolutePath": r"C:\\runtime-location-handler-smoke\\private-project",
        "displayName": "Handler smoke checkout",
    })
    .to_string();

    let missing_idempotency = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("POST")
                .uri(&collection_path)
                .header("content-type", "application/json")
                .body(Body::from(location_body.clone()))
                .expect("build missing Idempotency-Key request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve missing Idempotency-Key request");
    assert_eq!(
        missing_idempotency.status(),
        StatusCode::PRECONDITION_REQUIRED
    );
    let missing_idempotency_body = axum::body::to_bytes(missing_idempotency.into_body(), 64 * 1024)
        .await
        .expect("read missing Idempotency-Key body");
    let missing_idempotency_problem: serde_json::Value =
        serde_json::from_slice(&missing_idempotency_body).expect("parse precondition problem");
    assert_eq!(missing_idempotency_problem["code"], 42801);

    let created = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("POST")
                .uri(&collection_path)
                .header("content-type", "application/json")
                .header("idempotency-key", "runtime-location-create-1")
                .body(Body::from(location_body))
                .expect("build runtime-location create request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve runtime-location create request");
    assert_eq!(created.status(), StatusCode::CREATED);
    let created_body = axum::body::to_bytes(created.into_body(), 64 * 1024)
        .await
        .expect("read runtime-location create body");
    let created_json: serde_json::Value =
        serde_json::from_slice(&created_body).expect("parse runtime-location create JSON");
    assert_eq!(created_json["code"], 0);
    assert_eq!(created_json["data"]["item"]["hasAbsolutePath"], true);
    assert_eq!(
        created_json["data"]["item"]["healthStatus"],
        "pending_verification"
    );
    assert_eq!(created_json["data"]["item"]["terminalAvailable"], false);
    let created_text = created_json.to_string();
    assert!(!created_text.contains("absolutePath"));
    assert!(!created_text.contains("C:\\\\runtime-location-handler-smoke"));
    let runtime_location_id = created_json["data"]["item"]["id"]
        .as_str()
        .expect("created runtime-location id")
        .to_owned();

    let detail_path = format!("{collection_path}/{runtime_location_id}");
    let invalid_if_match = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("PATCH")
                .uri(&detail_path)
                .header("content-type", "application/json")
                .header("idempotency-key", "runtime-location-update-1")
                .header("if-match", "not-a-version")
                .body(Body::from(r#"{"displayName":"Updated checkout"}"#))
                .expect("build invalid If-Match request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve invalid If-Match request");
    assert_eq!(invalid_if_match.status(), StatusCode::BAD_REQUEST);

    let paged = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .uri(format!("{collection_path}?page=1&page_size=1"))
                .body(Body::empty())
                .expect("build runtime-location list request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve runtime-location list request");
    assert_eq!(paged.status(), StatusCode::OK);
    let paged_body = axum::body::to_bytes(paged.into_body(), 64 * 1024)
        .await
        .expect("read runtime-location list body");
    let paged_json: serde_json::Value =
        serde_json::from_slice(&paged_body).expect("parse runtime-location list JSON");
    assert_eq!(
        paged_json["data"]["items"].as_array().map(Vec::len),
        Some(1)
    );
    assert_eq!(paged_json["data"]["pageInfo"]["pageSize"], 1);
    assert_eq!(paged_json["data"]["pageInfo"]["totalItems"], "1");

    let unavailable_git = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .uri(format!(
                    "/app/v3/api/projects/{project_id}/git/overview?runtime_location_id={runtime_location_id}"
                ))
                .body(Body::empty())
                .expect("build runtime-bound Git overview request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve runtime-bound Git overview request");
    assert_eq!(unavailable_git.status(), StatusCode::SERVICE_UNAVAILABLE);

    let rejected_preference = app
        .clone()
        .oneshot(with_request_context(
            Request::builder()
                .method("PUT")
                .uri(format!(
                    "/app/v3/api/projects/{project_id}/runtime_location_preferences/terminal"
                ))
                .header("content-type", "application/json")
                .header("idempotency-key", "runtime-location-preference-1")
                .body(Body::from(
                    serde_json::json!({ "runtimeLocationId": runtime_location_id }).to_string(),
                ))
                .expect("build unverified runtime-location preference request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve unverified runtime-location preference request");
    assert_eq!(rejected_preference.status(), StatusCode::CONFLICT);

    let deleted = app
        .oneshot(with_request_context(
            Request::builder()
                .method("DELETE")
                .uri(&detail_path)
                .header("if-match", "0")
                .body(Body::empty())
                .expect("build runtime-location delete request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve runtime-location delete request");
    assert_eq!(deleted.status(), StatusCode::NO_CONTENT);
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
