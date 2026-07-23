use sdkwork_web_contract::{
    infer_api_surface_from_path, ApiSurface, HttpMethod, HttpRoute, RouteAuth,
};

use crate::domain::models::RouteCatalogEntryPayload;

pub fn build_route_catalog_entries(routes: &[HttpRoute]) -> Vec<RouteCatalogEntryPayload> {
    routes.iter().map(build_route_catalog_entry).collect()
}

pub fn count_route_catalog_entries_by_surface(routes: &[HttpRoute]) -> (usize, usize) {
    let mut app_count = 0usize;
    let mut backend_count = 0usize;

    for route in routes {
        match infer_api_surface_from_path(route.path) {
            ApiSurface::AppApi => app_count += 1,
            ApiSurface::BackendApi => backend_count += 1,
            _ => {}
        }
    }

    (app_count, backend_count)
}

fn build_route_catalog_entry(route: &HttpRoute) -> RouteCatalogEntryPayload {
    let surface = infer_api_surface_from_path(route.path);
    RouteCatalogEntryPayload {
        auth_mode: route_catalog_auth_mode(route.auth, surface).to_string(),
        method: http_method_label(route.method).to_string(),
        open_api_path: to_open_api_path_template(route.path),
        operation_id: route.operation_id.to_string(),
        path: route.path.to_string(),
        surface: route_catalog_surface_label(surface).to_string(),
        summary: route.operation_id.to_string(),
    }
}

fn route_catalog_surface_label(surface: ApiSurface) -> &'static str {
    match surface {
        ApiSurface::AppApi => "app",
        ApiSurface::BackendApi => "backend",
        ApiSurface::OpenApi => "open-api",
        ApiSurface::GatewayApi => "gateway",
        _ => "unknown",
    }
}

fn route_catalog_auth_mode(auth: RouteAuth, surface: ApiSurface) -> &'static str {
    if auth.skips_credential_resolution() {
        return "host";
    }

    match surface {
        ApiSurface::BackendApi => "admin",
        ApiSurface::AppApi | ApiSurface::OpenApi | ApiSurface::GatewayApi => "user",
        _ => "user",
    }
}

fn to_open_api_path_template(path: &str) -> String {
    path.split('/')
        .map(|segment| {
            if let Some(parameter_name) = segment.strip_prefix(':') {
                let normalized = parameter_name.trim();
                if normalized.is_empty() {
                    return segment.to_string();
                }
                return format!("{{{normalized}}}");
            }

            segment.to_string()
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn http_method_label(method: HttpMethod) -> &'static str {
    match method {
        HttpMethod::Get => "GET",
        HttpMethod::Post => "POST",
        HttpMethod::Put => "PUT",
        HttpMethod::Patch => "PATCH",
        HttpMethod::Delete => "DELETE",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_manifest_route_to_catalog_entry() {
        let route = HttpRoute::dual_token(
            HttpMethod::Get,
            "/app/v3/api/system/routes",
            "system",
            "routes.list",
        );
        let entry = build_route_catalog_entry(&route);

        assert_eq!(entry.auth_mode, "user");
        assert_eq!(entry.method, "GET");
        assert_eq!(entry.open_api_path, "/app/v3/api/system/routes");
        assert_eq!(entry.operation_id, "routes.list");
        assert_eq!(entry.path, "/app/v3/api/system/routes");
        assert_eq!(entry.surface, "app");
    }

    #[test]
    fn converts_express_style_path_params_to_openapi_templates() {
        let route = HttpRoute::dual_token(
            HttpMethod::Get,
            "/app/v3/api/projects/:projectId/runtime_locations/:runtimeLocationId",
            "project-runtime-locations",
            "projects.runtimeLocations.retrieve",
        );
        let entry = build_route_catalog_entry(&route);

        assert_eq!(
            entry.open_api_path,
            "/app/v3/api/projects/{projectId}/runtime_locations/{runtimeLocationId}"
        );
    }
}
