use std::sync::OnceLock;

use sdkwork_web_contract::HttpRoute;
use sdkwork_web_core::HttpRouteManifest;

pub fn birdcoder_product_app_api_route_manifest() -> HttpRouteManifest {
    static MANIFEST: OnceLock<HttpRouteManifest> = OnceLock::new();
    *MANIFEST.get_or_init(|| {
        let routes: Vec<HttpRoute> = [
            sdkwork_router_system_app_api::manifest::SYSTEM_APP_API_ROUTES,
            sdkwork_router_engine_catalog_app_api::manifest::ENGINE_CATALOG_APP_API_ROUTES,
            sdkwork_router_coding_sessions_app_api::manifest::CODING_SESSIONS_APP_API_ROUTES,
            sdkwork_router_workspace_app_api::manifest::WORKSPACE_APP_API_ROUTES,
            sdkwork_router_document_app_api::manifest::DOCUMENT_APP_API_ROUTES,
            sdkwork_router_skill_packages_app_api::manifest::SKILL_PACKAGES_APP_API_ROUTES,
            sdkwork_router_membership_app_api::manifest::MEMBERSHIP_APP_API_ROUTES,
            sdkwork_router_deployment_backend_api::manifest::DEPLOYMENT_BACKEND_API_ROUTES,
        ]
        .into_iter()
        .flat_map(|slice| slice.iter().copied())
        .collect();
        let leaked: &'static [HttpRoute] = Box::leak(routes.into_boxed_slice());
        HttpRouteManifest::new(leaked)
    })
}
