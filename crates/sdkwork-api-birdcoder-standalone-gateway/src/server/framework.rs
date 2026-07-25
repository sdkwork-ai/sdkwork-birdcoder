//! Gateway-level web framework infrastructure.
//!
//! Per `APPLICATION_GATEWAY_SPEC.md` section 2: "Gateways own listener lifecycle,
//! process-wide Web Framework infrastructure, observability, topology
//! materialization, assembly selection, and cross-assembly collision
//! validation."
//!
//! This module constructs the `WebFrameworkLayer` using `sdkwork_iam_web_adapter`
//! and wraps the assembly-provided raw router. The assembly is host-neutral and
//! does not depend on `sdkwork_iam_web_adapter`.

use axum::Router;
use sdkwork_iam_web_adapter::{iam_web_request_context_resolver_from_env, IamAuthorizationPolicy};
use sdkwork_web_axum::{with_web_request_context, WebFrameworkLayer};
use sdkwork_web_core::{
    CorsPolicy, DomainContextInjector, HttpMetricsRegistry, HttpRouteManifest, RateLimitPolicy,
    SecurityPolicy, WebEnvironment, WebRequestContextProfile,
};
use std::sync::Arc;

use sdkwork_api_birdcoder_assembly::bootstrap::config::{
    default_loopback_browser_origins, is_loopback_bind_host, is_wildcard_bind_host,
    BirdDeploymentProfile, BirdEnvironment, BirdServerConfig,
};

/// Product route packages declare public operations in the combined route
/// manifest. Infrastructure probes are mounted outside this framework layer,
/// so the gateway does not need broad public path-prefix exceptions.
pub fn birdcoder_public_path_prefixes() -> Vec<String> {
    Vec::new()
}

/// Wraps the raw assembly router with the IAM web framework layer.
///
/// This is the gateway-owned "process-wide Web Framework infrastructure"
/// per `APPLICATION_GATEWAY_SPEC.md` section 2. The assembly provides the raw router
/// and the combined route manifest; the gateway constructs the middleware
/// pipeline (auth, CORS, rate limiting, authorization) using
/// `sdkwork_iam_web_adapter`.
pub async fn wrap_with_web_framework(
    router: Router,
    route_manifest: HttpRouteManifest,
    domain_context_injectors: Vec<Arc<dyn DomainContextInjector>>,
    config: &BirdServerConfig,
    metrics: Arc<HttpMetricsRegistry>,
) -> Result<Router, String> {
    let resolver = iam_web_request_context_resolver_from_env().await;
    let public_prefixes = birdcoder_public_path_prefixes();
    let profile = WebRequestContextProfile {
        public_path_prefixes: public_prefixes.clone(),
        environment: match config.environment {
            BirdEnvironment::Development => WebEnvironment::Dev,
            BirdEnvironment::Test => WebEnvironment::Test,
            BirdEnvironment::Staging | BirdEnvironment::Production => WebEnvironment::Prod,
        },
        ..WebRequestContextProfile::default()
    };
    route_manifest
        .validate_public_path_prefixes(&public_prefixes)
        .map_err(|error| format!("route manifest public prefix validation failed: {error}"))?;
    route_manifest
        .validate_route_auth_for_surfaces(&profile)
        .map_err(|error| format!("route manifest auth validation failed: {error}"))?;
    route_manifest
        .validate_no_ambient_context_path_markers(&profile)
        .map_err(|error| format!("route manifest context validation failed: {error}"))?;

    let authorization_policy = Arc::new(IamAuthorizationPolicy::new(route_manifest.clone()));
    let mut layer = WebFrameworkLayer::new(resolver)
        .with_profile(profile)
        .with_security_policy(build_security_policy(config))
        .with_authorization_policy(authorization_policy)
        .with_route_manifest(route_manifest)
        .with_metrics(metrics);
    for injector in domain_context_injectors {
        layer = layer.with_domain_injector(injector);
    }
    Ok(with_web_request_context(router, layer))
}

pub fn build_cors_policy(config: &BirdServerConfig) -> CorsPolicy {
    let uses_wildcard = config.allowed_origins.iter().any(|origin| origin == "*");
    let mut explicit_origins: Vec<String> = config
        .allowed_origins
        .iter()
        .filter(|origin| *origin != "*")
        .cloned()
        .collect();

    let uses_development_private_network =
        matches!(config.deployment_profile, BirdDeploymentProfile::Standalone)
            && matches!(
                config.environment,
                BirdEnvironment::Development | BirdEnvironment::Test
            );
    if uses_development_private_network {
        let mut policy = CorsPolicy::development_private_network();
        for origin in explicit_origins {
            if !policy.allowed_origins.contains(&origin) {
                policy.allowed_origins.push(origin);
            }
        }
        if uses_wildcard {
            tracing::warn!(
                "SDKWORK_BIRDCODER_ALLOWED_ORIGINS contains '*' which is forbidden; using the development private-network policy and explicit origins only."
            );
        }
        return policy;
    }

    let is_local_standalone =
        matches!(config.deployment_profile, BirdDeploymentProfile::Standalone)
            && (is_loopback_bind_host(&config.host) || is_wildcard_bind_host(&config.host));
    if is_local_standalone {
        for origin in default_loopback_browser_origins() {
            if !explicit_origins.iter().any(|allowed| allowed == &origin) {
                explicit_origins.push(origin);
            }
        }
    }

    if uses_wildcard {
        tracing::warn!(
            "SDKWORK_BIRDCODER_ALLOWED_ORIGINS contains '*' which is forbidden; using explicit origins only."
        );
        CorsPolicy {
            allow_all_origins: false,
            allowed_origins: explicit_origins,
            ..CorsPolicy::default()
        }
    } else if explicit_origins.is_empty()
        && (is_loopback_bind_host(&config.host) || is_wildcard_bind_host(&config.host))
    {
        CorsPolicy {
            allow_all_origins: false,
            allowed_origins: default_loopback_browser_origins(),
            ..CorsPolicy::default()
        }
    } else {
        CorsPolicy {
            allow_all_origins: false,
            allowed_origins: explicit_origins,
            ..CorsPolicy::default()
        }
    }
}

fn build_security_policy(config: &BirdServerConfig) -> SecurityPolicy {
    SecurityPolicy {
        cors: build_cors_policy(config),
        rate_limit: RateLimitPolicy {
            enabled: config.rate_limit_enabled,
            max_requests_per_window: config.rate_limit_max_requests,
            window_secs: config.rate_limit_window_secs,
            pre_auth_rate_limit: true,
            tenant_limit_after_auth: true,
        },
        ..SecurityPolicy::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::extract::Request;
    use sdkwork_api_birdcoder_assembly::bootstrap::config::BirdRuntimeTarget;

    fn test_config(deployment_profile: BirdDeploymentProfile) -> BirdServerConfig {
        BirdServerConfig {
            environment: BirdEnvironment::Development,
            deployment_profile,
            runtime_target: BirdRuntimeTarget::Server,
            host: "127.0.0.1".to_owned(),
            port: 10240,
            allowed_origins: vec!["https://operator.example.test".to_owned()],
            rate_limit_enabled: false,
            rate_limit_max_requests: 120,
            rate_limit_window_secs: 60,
        }
    }

    #[test]
    fn standalone_loopback_cors_includes_local_vite_ports() {
        let policy = build_cors_policy(&test_config(BirdDeploymentProfile::Standalone));

        for origin in ["http://localhost:3001", "https://operator.example.test"] {
            let request = Request::builder()
                .header("origin", origin)
                .body(axum::body::Body::empty())
                .expect("build configured origin request");
            assert!(policy.validate_origin(&request).is_ok(), "origin={origin}");
        }
    }

    #[test]
    fn standalone_development_cors_allows_dynamic_private_network_origins() {
        let policy = build_cors_policy(&test_config(BirdDeploymentProfile::Standalone));
        let request = Request::builder()
            .header("origin", "http://192.168.31.108:3001")
            .body(axum::body::Body::empty())
            .expect("build private-network origin request");

        assert!(policy.validate_origin(&request).is_ok());
    }

    #[test]
    fn cloud_cors_does_not_expand_operator_origins() {
        let policy = build_cors_policy(&test_config(BirdDeploymentProfile::Cloud));

        assert_eq!(policy.allowed_origins, ["https://operator.example.test"]);
    }
}
