use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use sdkwork_birdcoder_deployment_service::context::DeploymentContext;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;
use sdkwork_birdcoder_workspace_repository_sqlx::db::schema::ALL_TABLES_DDL;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::deployment::SqliteDeploymentRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::team::SqliteTeamRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqliteWorkspaceRepository;
use sdkwork_birdcoder_workspace_service::service::team_service::TeamService;
use sdkwork_database_config::{DatabaseConfig, DatabaseEngine, DeploymentMode};
use sdkwork_database_sqlx::create_any_pool_from_config;
use sdkwork_iam_context_service::{
    AuthLevel, DeploymentMode as IamDeploymentMode, Environment, IamAppContext,
};
use sdkwork_routes_deployment_backend_api::{
    build_deployment_backend_router, DeploymentBackendAppState,
};
use sdkwork_web_core::{
    ServerRequestId, WebApiSurface, WebAuthMode, WebRequestContext, WebTransportFacts,
};
use sqlx::AnyPool;
use tower::ServiceExt;

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

async fn test_state() -> DeploymentBackendAppState {
    let pool = test_any_pool().await;
    execute_sql_batch(&pool, ALL_TABLES_DDL)
        .await
        .expect("apply workspace schema");

    DeploymentBackendAppState {
        service: DeploymentService::new(
            Arc::new(SqliteDeploymentRepository::new(pool.clone())),
            Arc::new(NoopDeploymentEvents),
        ),
        team_service: TeamService::new(
            Arc::new(SqliteTeamRepository::new(pool.clone())),
            Arc::new(SqliteWorkspaceRepository::new(pool)),
        ),
    }
}

fn with_request_context(mut request: Request<Body>, iam: Option<IamAppContext>) -> Request<Body> {
    let path = request.uri().path().to_owned();
    let method = request.method().as_str().to_owned();
    request.extensions_mut().insert(WebRequestContext {
        request_id: ServerRequestId("handler-smoke-request".to_owned()),
        api_surface: WebApiSurface::BackendApi,
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
    let _router = build_deployment_backend_router();
}

#[tokio::test]
async fn admin_teams_requires_authentication() {
    let response = build_deployment_backend_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/backend/v3/api/iam/teams")
                .body(Body::empty())
                .expect("build admin teams request"),
            None,
        ))
        .await
        .expect("serve admin teams request");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn admin_teams_returns_ok_with_empty_inventory() {
    let response = build_deployment_backend_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/backend/v3/api/iam/teams")
                .body(Body::empty())
                .expect("build admin teams request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve admin teams request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read admin teams body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse admin teams JSON");
    assert_eq!(json["code"], 0);
    assert_eq!(json["traceId"], "handler-smoke-request");
    assert_eq!(json["data"]["items"].as_array().map(Vec::len), Some(0));
    assert_eq!(json["data"]["pageInfo"]["totalItems"], "0");
}

#[tokio::test]
async fn admin_teams_rejects_over_max_page_size_before_repository_access() {
    let response = build_deployment_backend_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/backend/v3/api/iam/teams?page_size=201")
                .body(Body::empty())
                .expect("build invalid admin teams request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve invalid admin teams request");

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
async fn admin_team_members_returns_not_found_for_missing_team() {
    let response = build_deployment_backend_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/backend/v3/api/iam/teams/1/members")
                .body(Body::empty())
                .expect("build admin team members request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve admin team members request");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn admin_team_members_rejects_invalid_team_id() {
    let response = build_deployment_backend_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/backend/v3/api/iam/teams/not-a-team-id/members")
                .body(Body::empty())
                .expect("build admin team members request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve admin team members request");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}
