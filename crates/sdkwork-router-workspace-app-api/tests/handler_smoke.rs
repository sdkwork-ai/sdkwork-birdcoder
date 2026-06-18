use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

use sdkwork_router_workspace_app_api::{build_workspace_app_router, WorkspaceAppState};

fn test_state() -> WorkspaceAppState {
    // Create a minimal state for testing
    // In a real test, you'd wire up actual services
    todo!("Wire up test state with mock services")
}

#[test]
fn platform_router_builds_without_error() {
    // Just verify the router can be constructed
    let _router = build_workspace_app_router();
}

// All other tests require a real state with services wired up
// They are marked as ignored for now
