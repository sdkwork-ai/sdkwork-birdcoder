use std::sync::OnceLock;

use sdkwork_web_contract::HttpRoute;
use sdkwork_web_core::HttpRouteManifest;

fn birdcoder_app_api_routes_slice() -> &'static [HttpRoute] {
    static ROUTES: OnceLock<&'static [HttpRoute]> = OnceLock::new();
    ROUTES.get_or_init(|| {
        let routes: Vec<HttpRoute> = [
            sdkwork_routes_system_app_api::manifest::SYSTEM_APP_API_ROUTES,
            sdkwork_routes_workspace_app_api::manifest::WORKSPACE_APP_API_ROUTES,
        ]
        .into_iter()
        .flat_map(|slice| slice.iter().copied())
        .collect();
        Box::leak(routes.into_boxed_slice())
    })
}

pub fn birdcoder_app_api_routes() -> &'static [HttpRoute] {
    birdcoder_app_api_routes_slice()
}

pub fn birdcoder_app_api_route_manifest() -> HttpRouteManifest {
    static MANIFEST: OnceLock<HttpRouteManifest> = OnceLock::new();
    *MANIFEST.get_or_init(|| HttpRouteManifest::new(birdcoder_app_api_routes_slice()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_contains_only_birdcoder_owned_system_and_workbench_routes() {
        let routes = birdcoder_app_api_routes();
        assert_eq!(routes.len(), 39);
        assert!(routes.iter().all(|route| {
            route.path.starts_with("/app/v3/api/workspaces")
                || route.path.starts_with("/app/v3/api/projects")
                || matches!(
                    route.path,
                    "/app/v3/api/system/descriptor"
                        | "/app/v3/api/system/health"
                        | "/app/v3/api/system/routes"
                        | "/app/v3/api/system/runtime"
                )
        }));
    }
}
