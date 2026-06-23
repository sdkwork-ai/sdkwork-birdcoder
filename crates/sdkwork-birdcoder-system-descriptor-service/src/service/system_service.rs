use crate::domain::models::{
    DescriptorPayload, GatewayDescriptorPayload, GatewayRoutesBySurfacePayload,
    GatewaySurfaceDescriptorPayload, HealthPayload, OperationPayload, RouteCatalogEntryPayload,
    RuntimePayload,
};
use crate::error::SystemDescriptorError;
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

pub trait OperationProvider: Send + Sync {
    fn find_operation(&self, operation_id: &str) -> Option<OperationPayload>;
}

pub struct SystemService<R: RouteCatalogProvider, O: OperationProvider> {
    route_catalog_provider: R,
    operation_provider: O,
}

impl<R: RouteCatalogProvider, O: OperationProvider> SystemService<R, O> {
    pub fn new(route_catalog_provider: R, operation_provider: O) -> Self {
        Self {
            route_catalog_provider,
            operation_provider,
        }
    }

    pub fn health(&self) -> HealthPayload {
        HealthPayload {
            status: "healthy".to_string(),
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

        DescriptorPayload {
            api_version: api_version.to_string(),
            gateway: GatewayDescriptorPayload {
                docs_path: "/docs".to_string(),
                live_open_api_path: "/openapi.json".to_string(),
                open_api_path: open_api_path.to_string(),
                route_catalog_path: "/app/v3/api/system/routes".to_string(),
                route_count: app_route_count + backend_route_count,
                routes_by_surface: GatewayRoutesBySurfacePayload {
                    app: app_route_count,
                    backend: backend_route_count,
                },
                surfaces: [
                    GatewaySurfaceDescriptorPayload {
                        auth_mode: "user".to_string(),
                        base_path: "/app/v3/api".to_string(),
                        description: "App API surface for user-facing operations".to_string(),
                        name: "app".to_string(),
                        route_count: app_route_count,
                    },
                    GatewaySurfaceDescriptorPayload {
                        auth_mode: "admin".to_string(),
                        base_path: "/backend/v3/api".to_string(),
                        description: "Backend API surface for administrative operations".to_string(),
                        name: "backend".to_string(),
                        route_count: backend_route_count,
                    },
                ],
            },
            host_mode: host_mode.to_string(),
            module_id: module_id.to_string(),
            open_api_path: open_api_path.to_string(),
            surfaces: ["app".to_string(), "backend".to_string()],
        }
    }

    pub fn descriptor(
        &self,
        host_mode: &str,
        module_id: &str,
        api_version: &str,
        app_route_count: usize,
        backend_route_count: usize,
        open_api_path: &str,
    ) -> DescriptorPayload {
        DescriptorPayload {
            api_version: api_version.to_string(),
            gateway: GatewayDescriptorPayload {
                docs_path: "/docs".to_string(),
                live_open_api_path: "/openapi.json".to_string(),
                open_api_path: open_api_path.to_string(),
                route_catalog_path: "/route-catalog".to_string(),
                route_count: app_route_count + backend_route_count,
                routes_by_surface: GatewayRoutesBySurfacePayload {
                    app: app_route_count,
                    backend: backend_route_count,
                },
                surfaces: [
                    GatewaySurfaceDescriptorPayload {
                        auth_mode: "user".to_string(),
                        base_path: "/api/app".to_string(),
                        description: "App API surface for user-facing operations".to_string(),
                        name: "app".to_string(),
                        route_count: app_route_count,
                    },
                    GatewaySurfaceDescriptorPayload {
                        auth_mode: "admin".to_string(),
                        base_path: "/api/backend".to_string(),
                        description: "Backend API surface for administrative operations".to_string(),
                        name: "backend".to_string(),
                        route_count: backend_route_count,
                    },
                ],
            },
            host_mode: host_mode.to_string(),
            module_id: module_id.to_string(),
            open_api_path: open_api_path.to_string(),
            surfaces: ["app".to_string(), "backend".to_string()],
        }
    }

    pub fn route_catalog(&self) -> Vec<RouteCatalogEntryPayload> {
        self.route_catalog_provider.list_route_specs()
    }

    pub fn runtime(
        &self,
        host: &str,
        port: u16,
        config_file_name: &str,
    ) -> RuntimePayload {
        RuntimePayload {
            host: host.to_string(),
            port,
            config_file_name: config_file_name.to_string(),
        }
    }

    pub fn get_operation(
        &self,
        operation_id: &str,
    ) -> Result<OperationPayload, SystemDescriptorError> {
        let normalized_id = normalize_required(operation_id).ok_or_else(|| {
            SystemDescriptorError::InvalidInput("operationId is required.".to_string())
        })?;

        self.operation_provider
            .find_operation(&normalized_id)
            .ok_or_else(|| {
                SystemDescriptorError::NotFound(format!(
                    "Operation \"{normalized_id}\" was not found."
                ))
            })
    }
}

fn normalize_required(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
