use axum::Router;
use sdkwork_web_bootstrap::{ApiAssemblyContribution, AlwaysReady, ReadinessCheck, WebModule};
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
    // Owned OpenAPI document: stamps x-sdkwork-owner and x-sdkwork-api-authority
    // on every operation so gateway composition ownership validation passes.
    let openapi = sdkwork_web_contract::build_owned_openapi_document(
        "SDKWork BirdCoder App API",
        "sdkwork-birdcoder",
        birdcoder.route_manifest.routes(),
    )?;
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

/// Installs BirdCoder as a Web Module with a caller-supplied server
/// configuration and optional composed dependency readiness check
/// (API_ASSEMBLY_SPEC §4.1.1).
pub async fn web_module_with_config(
    config: &BirdServerConfig,
    readiness_check: Option<Arc<dyn ReadinessCheck>>,
) -> Result<WebModule, String> {
    let assembly = assemble_api_router_with_readiness(config, readiness_check).await?;
    Ok(WebModule::from_contribution(
        ApiAssemblyContribution::try_new(
            "sdkwork-birdcoder",
            assembly.router,
            assembly.route_manifest,
            assembly.openapi,
            assembly.permission_catalog,
            assembly.domain_context_injectors,
            assembly.readiness_check,
        )?,
    ))
}

/// Canonical Web Module definition for this application
/// (API_ASSEMBLY_SPEC §4.1.1): the complete HTTP surface — every route,
/// manifest, and OpenAPI document of this owner — as one installable module.
pub async fn web_module() -> Result<WebModule, String> {
    let config = BirdServerConfig::from_env().map_err(|error| error.to_string())?;
    web_module_with_config(&config, None).await
}
