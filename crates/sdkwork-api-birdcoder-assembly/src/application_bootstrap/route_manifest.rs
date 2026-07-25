use sdkwork_web_contract::HttpRoute;
use sdkwork_web_core::HttpRouteManifest;

/// BirdCoder-owned System App API routes.
///
/// These protected business APIs are distinct from the gateway-owned
/// `/healthz`, `/livez`, and `/readyz` infrastructure probes.
pub fn birdcoder_app_api_routes() -> &'static [HttpRoute] {
    sdkwork_routes_system_app_api::manifest::SYSTEM_APP_API_ROUTES
}

/// BirdCoder-owned System App API route manifest.
pub fn birdcoder_app_api_route_manifest() -> HttpRouteManifest {
    sdkwork_routes_system_app_api::system_app_api_route_manifest()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_contains_only_birdcoder_owned_system_routes() {
        let routes = birdcoder_app_api_routes();
        assert_eq!(routes.len(), 4);
        assert!(routes.iter().all(|route| {
            matches!(
                route.path,
                "/app/v3/api/system/descriptor"
                    | "/app/v3/api/system/health"
                    | "/app/v3/api/system/routes"
                    | "/app/v3/api/system/runtime"
            )
        }));
    }

    #[test]
    fn owner_manifest_classifies_system_routes_as_protected() {
        let manifest = birdcoder_app_api_route_manifest();
        assert!(manifest
            .match_route("GET", "/app/v3/api/system/health")
            .is_some());
        assert!(!manifest.is_public_route("GET", "/app/v3/api/system/health"));
    }
}
