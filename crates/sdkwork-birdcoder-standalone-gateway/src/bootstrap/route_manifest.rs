use std::sync::OnceLock;

use sdkwork_web_contract::HttpRoute;
use sdkwork_web_core::HttpRouteManifest;

fn birdcoder_product_app_api_routes_slice() -> &'static [HttpRoute] {
    static ROUTES: OnceLock<&'static [HttpRoute]> = OnceLock::new();
    ROUTES.get_or_init(|| {
        let routes: Vec<HttpRoute> = [
            sdkwork_routes_system_app_api::manifest::SYSTEM_APP_API_ROUTES,
            sdkwork_routes_engine_catalog_app_api::manifest::ENGINE_CATALOG_APP_API_ROUTES,
            sdkwork_routes_coding_sessions_app_api::manifest::CODING_SESSIONS_APP_API_ROUTES,
            sdkwork_routes_workspace_app_api::manifest::WORKSPACE_APP_API_ROUTES,
            sdkwork_routes_document_app_api::manifest::DOCUMENT_APP_API_ROUTES,
            sdkwork_routes_chat_app_api::manifest::CHAT_APP_API_ROUTES,
            sdkwork_routes_skill_packages_app_api::manifest::SKILL_PACKAGES_APP_API_ROUTES,
            sdkwork_routes_membership_app_api::manifest::MEMBERSHIP_APP_API_ROUTES,
            sdkwork_routes_commerce_app_api::manifest::COMMERCE_APP_API_ROUTES,
            sdkwork_routes_deployment_backend_api::manifest::DEPLOYMENT_BACKEND_API_ROUTES,
            sdkwork_routes_terminal_app_api::manifest::TERMINAL_APP_API_ROUTES,
        ]
        .into_iter()
        .flat_map(|slice| slice.iter().copied())
        .collect();
        Box::leak(routes.into_boxed_slice())
    })
}

pub fn birdcoder_product_app_api_routes() -> &'static [HttpRoute] {
    birdcoder_product_app_api_routes_slice()
}

pub fn birdcoder_product_app_api_route_manifest() -> HttpRouteManifest {
    static MANIFEST: OnceLock<HttpRouteManifest> = OnceLock::new();
    *MANIFEST.get_or_init(|| HttpRouteManifest::new(birdcoder_product_app_api_routes_slice()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use sdkwork_web_contract::{HttpMethod, RouteAuth};

    #[test]
    fn terminal_routes_are_registered_as_protected_app_api_operations() {
        let routes = birdcoder_product_app_api_routes();
        let create = routes
            .iter()
            .find(|route| {
                route.method == HttpMethod::Post
                    && route.path == "/app/v3/api/device/terminal/sessions"
            })
            .expect("Terminal App API create route must be registered");

        assert_eq!(create.auth, RouteAuth::DualToken);
        assert_eq!(create.operation_id, "device.terminal.sessions.create");
        assert_eq!(create.rate_limit_tier, None);
        assert!(routes
            .iter()
            .all(|route| !route.path.starts_with("/terminal/api/v1")));
    }
}
