use std::collections::HashSet;

use sdkwork_routes_workspace_app_api::manifest::WORKSPACE_APP_API_ROUTES;
use sdkwork_routes_workspace_app_api::mapper::request::{
    CreateProjectRuntimeLocationBody, CreateWorkspaceBody, RebindProjectRuntimeLocationBody,
};
use sdkwork_routes_workspace_app_api::{
    build_workspace_app_router, workspace_app_api_route_manifest,
};

const FORBIDDEN_PATH_FRAGMENTS: &[&str] = &[
    "/realtime",
    "/members",
    "/collaborators",
    "/deployments",
    "/deployment_targets",
    "/publish",
    "/teams",
    "/coding_sessions",
    "/chat/conversations",
    "/skill_packages",
];

#[test]
fn router_and_manifest_expose_exactly_the_workbench_surface() {
    let _router = build_workspace_app_router();
    let manifest = workspace_app_api_route_manifest();

    assert_eq!(manifest.routes().len(), 35);
    assert_eq!(manifest.routes(), WORKSPACE_APP_API_ROUTES);

    let mut operation_ids = HashSet::new();
    for route in manifest.routes() {
        assert!(
            route.path.starts_with("/app/v3/api/workspaces")
                || route.path.starts_with("/app/v3/api/projects"),
            "unexpected BirdCoder-owned path: {}",
            route.path,
        );
        assert!(
            FORBIDDEN_PATH_FRAGMENTS
                .iter()
                .all(|fragment| !route.path.contains(fragment)),
            "dependency-owned path leaked into Workbench: {}",
            route.path,
        );
        assert!(
            operation_ids.insert(route.operation_id),
            "duplicate operationId: {}",
            route.operation_id,
        );
        assert!(
            route
                .required_permission
                .is_some_and(|permission| permission.starts_with("birdcoder.intelligence-")),
            "non-Workbench permission on {}",
            route.operation_id,
        );
    }
}

#[test]
fn document_binding_routes_are_first_class_workbench_operations() {
    let manifest = workspace_app_api_route_manifest();

    for (method, path, operation_id) in [
        (
            "GET",
            "/app/v3/api/projects/300001/document_bindings",
            "projects.documentBindings.list",
        ),
        (
            "POST",
            "/app/v3/api/projects/300001/document_bindings",
            "projects.documentBindings.create",
        ),
        (
            "GET",
            "/app/v3/api/projects/300001/document_bindings/400001",
            "projects.documentBindings.retrieve",
        ),
        (
            "DELETE",
            "/app/v3/api/projects/300001/document_bindings/400001",
            "projects.documentBindings.delete",
        ),
    ] {
        let route = manifest
            .match_route(method, path)
            .unwrap_or_else(|| panic!("missing {method} {path}"));
        assert_eq!(route.operation_id, operation_id);
    }
}

#[test]
fn workspace_create_body_rejects_server_owned_legacy_fields() {
    let result = serde_json::from_value::<CreateWorkspaceBody>(serde_json::json!({
        "name": "Workbench",
        "tenantId": "caller-controlled-tenant"
    }));

    assert!(result.is_err());
}

#[test]
fn runtime_location_bodies_reject_removed_root_locator() {
    let create = serde_json::from_value::<CreateProjectRuntimeLocationBody>(serde_json::json!({
        "runtimeTargetId": "desktop-primary",
        "runtimeTargetKind": "desktop",
        "locationKind": "local_directory",
        "pathFlavor": "windows",
        "rootLocator": "legacy-root",
        "absolutePath": "C:\\work\\project"
    }));
    assert!(create.is_err());

    let rebind = serde_json::from_value::<RebindProjectRuntimeLocationBody>(serde_json::json!({
        "pathFlavor": "windows",
        "rootLocator": "legacy-root",
        "absolutePath": "C:\\work\\project"
    }));
    assert!(rebind.is_err());
}
