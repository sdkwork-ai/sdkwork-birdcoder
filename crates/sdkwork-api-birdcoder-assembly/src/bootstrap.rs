use axum::Router;
use sdkwork_web_bootstrap::{AlwaysReady, ReadinessCheck};
use sdkwork_web_core::{DomainContextInjector, HttpRouteManifest};
use std::collections::BTreeSet;
use std::sync::Arc;

use crate::bootstrap::{self, config::BirdServerConfig};

/// Host-neutral API assembly result.
///
/// The assembly exports the combined router and route manifest. The gateway
/// (standalone or cloud) owns the `WebFrameworkLayer` construction and wraps
/// the router with process-wide middleware per `APPLICATION_GATEWAY_SPEC.md` §2:
/// "Gateways own listener lifecycle, process-wide Web Framework infrastructure,
/// observability, topology materialization, assembly selection, and
/// cross-assembly collision validation."
pub struct ApiAssembly {
    pub router: Router,
    pub route_manifest: HttpRouteManifest,
    pub openapi: serde_json::Value,
    pub permission_catalog: Vec<&'static str>,
    pub domain_context_injectors: Vec<Arc<dyn DomainContextInjector>>,
    pub readiness_check: Arc<dyn ReadinessCheck>,
}

pub async fn assemble_api_router(config: &BirdServerConfig) -> Result<ApiAssembly, String> {
    assemble_api_router_with_readiness(config, None).await
}

/// Assembles the BirdCoder owner contribution with an optional composed
/// dependency readiness check. The gateway passes the combined owner readiness
/// (IAM, Agents, Drive, ...) so the System health endpoint reports real
/// dependency availability instead of a hard-coded healthy status.
pub async fn assemble_api_router_with_readiness(
    config: &BirdServerConfig,
    readiness_check: Option<Arc<dyn ReadinessCheck>>,
) -> Result<ApiAssembly, String> {
    let birdcoder = bootstrap::build_application(config, readiness_check.clone())
        .await
        .map_err(|error| error.to_string())?;
    let openapi = sdkwork_web_contract::build_openapi_document(
        "SDKWork BirdCoder App API",
        birdcoder.route_manifest.routes(),
    );
    let permission_catalog = birdcoder
        .route_manifest
        .routes()
        .iter()
        .flat_map(|route| {
            route
                .required_permission
                .into_iter()
                .chain(route.alternate_permissions.into_iter().flatten().copied())
        })
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    Ok(ApiAssembly {
        router: birdcoder.router,
        route_manifest: birdcoder.route_manifest,
        openapi,
        permission_catalog,
        domain_context_injectors: Vec::new(),
        readiness_check: readiness_check.unwrap_or_else(|| Arc::new(AlwaysReady)),
    })
}
