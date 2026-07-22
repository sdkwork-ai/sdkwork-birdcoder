use crate::domain::models::{
    DescriptorPayload, GatewayDescriptorPayload, GatewayRoutesBySurfacePayload,
    GatewaySurfaceDescriptorPayload, HealthPayload, RouteCatalogEntryPayload, RuntimePayload,
};
use crate::route_catalog::{build_route_catalog_entries, count_route_catalog_entries_by_surface};
use sdkwork_web_contract::HttpRoute;

pub trait RouteCatalogProvider: Send + Sync {
    fn list_route_specs(&self) -> Vec<RouteCatalogEntryPayload>;
}

pub struct ManifestRouteCatalogProvider {
    routes: &'static [HttpRoute],
}

impl ManifestRouteCatalogProvider {
    pub const fn new(routes: &'static [HttpRoute]) -> Self {
        Self { routes }
    }
}

impl RouteCatalogProvider for ManifestRouteCatalogProvider {
    fn list_route_specs(&self) -> Vec<RouteCatalogEntryPayload> {
        build_route_catalog_entries(self.routes)
    }
}

pub struct SystemService<R: RouteCatalogProvider> {
    route_catalog_provider: R,
}

impl<R: RouteCatalogProvider> SystemService<R> {
    pub fn new(route_catalog_provider: R) -> Self {
        Self {
            route_catalog_provider,
        }
    }

    pub fn health(&self) -> HealthPayload {
        HealthPayload {
            status: "healthy".to_owned(),
        }
    }

    pub fn descriptor_from_routes(
        &self,
        host_mode: &str,
        module_id: &str,
        api_version: &str,
        routes: &[HttpRoute],
        open_api_path: &str,
    ) -> DescriptorPayload {
        let (app_route_count, backend_route_count) = count_route_catalog_entries_by_surface(routes);
        let mut surfaces = vec![GatewaySurfaceDescriptorPayload {
            auth_mode: "user".to_owned(),
            base_path: "/app/v3/api".to_owned(),
            description: "App API surface for user-facing operations".to_owned(),
            name: "app".to_owned(),
            route_count: app_route_count,
        }];
        let mut surface_names = vec!["app".to_owned()];
        if backend_route_count > 0 {
            surfaces.push(GatewaySurfaceDescriptorPayload {
                auth_mode: "admin".to_owned(),
                base_path: "/backend/v3/api".to_owned(),
                description: "Backend API surface for administrative operations".to_owned(),
                name: "backend".to_owned(),
                route_count: backend_route_count,
            });
            surface_names.push("backend".to_owned());
        }

        DescriptorPayload {
            api_version: api_version.to_owned(),
            gateway: GatewayDescriptorPayload {
                docs_path: "/docs".to_owned(),
                live_open_api_path: "/openapi.json".to_owned(),
                open_api_path: open_api_path.to_owned(),
                route_catalog_path: "/app/v3/api/system/routes".to_owned(),
                route_count: app_route_count + backend_route_count,
                routes_by_surface: GatewayRoutesBySurfacePayload {
                    app: app_route_count,
                    backend: backend_route_count,
                },
                surfaces,
            },
            host_mode: host_mode.to_owned(),
            module_id: module_id.to_owned(),
            open_api_path: open_api_path.to_owned(),
            surfaces: surface_names,
        }
    }

    pub fn route_catalog(&self) -> Vec<RouteCatalogEntryPayload> {
        self.route_catalog_provider.list_route_specs()
    }

    pub fn runtime(&self, host: &str, port: u16, config_file_name: &str) -> RuntimePayload {
        RuntimePayload {
            host: host.to_owned(),
            port,
            config_file_name: config_file_name.to_owned(),
        }
    }
}
