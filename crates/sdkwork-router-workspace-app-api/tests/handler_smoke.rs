use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

use sdkwork_router_workspace_app_api::build_platform_app_router;

fn test_app() -> axum::Router {
    build_platform_app_router()
}

#[test]
fn platform_router_builds_without_error() {
    let _router = build_platform_app_router();
}

#[tokio::test]
async fn list_workspaces_returns_ok_with_items_array() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .uri("/workspaces")
                .body(Body::empty())
                .expect("build list workspaces request"),
        )
        .await
        .expect("serve list workspaces request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert!(json["items"].is_array());
}

#[tokio::test]
async fn get_workspace_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .uri("/workspaces/ws-1")
                .body(Body::empty())
                .expect("build get workspace request"),
        )
        .await
        .expect("serve get workspace request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert_eq!(json["status"], "todo");
    assert_eq!(json["id"], "ws-1");
}

#[tokio::test]
async fn create_workspace_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/workspaces")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({ "name": "Test Workspace" }).to_string(),
                ))
                .expect("build create workspace request"),
        )
        .await
        .expect("serve create workspace request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert_eq!(json["action"], "create");
}

#[tokio::test]
async fn update_workspace_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/workspaces/ws-1")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({ "name": "Updated" }).to_string(),
                ))
                .expect("build update workspace request"),
        )
        .await
        .expect("serve update workspace request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn delete_workspace_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/workspaces/ws-1")
                .body(Body::empty())
                .expect("build delete workspace request"),
        )
        .await
        .expect("serve delete workspace request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn list_projects_returns_ok_with_items_array() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .uri("/projects?workspaceId=ws-1")
                .body(Body::empty())
                .expect("build list projects request"),
        )
        .await
        .expect("serve list projects request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert!(json["items"].is_array());
    assert_eq!(json["workspaceId"], "ws-1");
}

#[tokio::test]
async fn get_project_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .uri("/projects/proj-1")
                .body(Body::empty())
                .expect("build get project request"),
        )
        .await
        .expect("serve get project request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert_eq!(json["id"], "proj-1");
}

#[tokio::test]
async fn create_project_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({ "workspaceId": "ws-1", "name": "Test" }).to_string(),
                ))
                .expect("build create project request"),
        )
        .await
        .expect("serve create project request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn get_project_git_overview_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .uri("/projects/proj-1/git/overview")
                .body(Body::empty())
                .expect("build git overview request"),
        )
        .await
        .expect("serve git overview request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn create_git_branch_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects/proj-1/git/branches")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({ "branchName": "feature/test" }).to_string(),
                ))
                .expect("build create branch request"),
        )
        .await
        .expect("serve create branch request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn switch_git_branch_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects/proj-1/git/branch_switch")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({ "branchName": "main" }).to_string(),
                ))
                .expect("build switch branch request"),
        )
        .await
        .expect("serve switch branch request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn commit_git_changes_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects/proj-1/git/commits")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({ "message": "test commit" }).to_string(),
                ))
                .expect("build commit request"),
        )
        .await
        .expect("serve commit request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn push_git_branch_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects/proj-1/git/pushes")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({ "branchName": "main" }).to_string(),
                ))
                .expect("build push request"),
        )
        .await
        .expect("serve push request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn list_project_collaborators_returns_ok_with_items() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .uri("/projects/proj-1/collaborators")
                .body(Body::empty())
                .expect("build list collaborators request"),
        )
        .await
        .expect("serve list collaborators request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert!(json["items"].is_array());
}

#[tokio::test]
async fn list_deployments_returns_ok_with_items() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .uri("/deployments")
                .body(Body::empty())
                .expect("build list deployments request"),
        )
        .await
        .expect("serve list deployments request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");
    assert!(json["items"].is_array());
}

#[tokio::test]
async fn publish_project_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects/proj-1/publish")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({ "environmentKey": "production" }).to_string(),
                ))
                .expect("build publish request"),
        )
        .await
        .expect("serve publish request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn workspace_realtime_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .uri("/workspaces/ws-1/realtime")
                .body(Body::empty())
                .expect("build realtime request"),
        )
        .await
        .expect("serve realtime request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn list_workspace_members_returns_ok_with_items() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .uri("/workspaces/ws-1/members")
                .body(Body::empty())
                .expect("build list members request"),
        )
        .await
        .expect("serve list members request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn create_git_worktree_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects/proj-1/git/worktrees")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({ "branchName": "feature/test", "path": "/tmp/wt" })
                        .to_string(),
                ))
                .expect("build create worktree request"),
        )
        .await
        .expect("serve create worktree request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn remove_git_worktree_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects/proj-1/git/worktree_removals")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({ "path": "/tmp/wt" }).to_string(),
                ))
                .expect("build remove worktree request"),
        )
        .await
        .expect("serve remove worktree request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn prune_git_worktrees_returns_todo_status() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects/proj-1/git/worktree_prune")
                .body(Body::empty())
                .expect("build prune worktrees request"),
        )
        .await
        .expect("serve prune worktrees request");

    assert_eq!(response.status(), StatusCode::OK);
}

