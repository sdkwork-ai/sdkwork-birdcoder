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
use sdkwork_iam_web_adapter::{
    allows_dev_authentication_fallback, iam_web_request_context_resolver_from_env,
    installed_iam_database_pool_for_process, IamAuthorizationPolicy,
};
use sdkwork_web_axum::{with_web_request_context, WebFrameworkLayer};
use sdkwork_web_core::{
    CorsPolicy, DomainContextInjector, HttpMetricsRegistry, HttpRouteManifest, RateLimitPolicy,
    SecurityPolicy, WebEnvironment, WebRequestContextProfile,
};
use std::sync::Arc;

use sdkwork_api_birdcoder_assembly::bootstrap::config::{
    is_loopback_bind_host, is_wildcard_bind_host, BirdDeploymentProfile, BirdEnvironment,
    BirdRuntimeTarget, BirdServerConfig,
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
    assert_embedded_iam_authentication_path(config)?;
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

/// Request headers attached by the SDKWork app SDK base client on every call
/// (`X-Platform`, identity headers, ...). The shared web framework's default
/// CORS allowlist predates these headers, so browser preflights from the
/// desktop/webview surfaces would be rejected without this extension.
const BIRDOODER_SDK_CORS_REQUEST_HEADERS: &[&str] = &[
    "x-platform",
    "x-tenant-id",
    "x-organization-id",
    "x-user-id",
    "x-sdkwork-client-kind",
];

/// Fail-closed assertion for the embedded desktop gateway's IAM
/// authentication path.
///
/// The desktop runtime resolves IAM from the process environment; when
/// neither an IAM database pool nor the explicitly enabled local development
/// authentication fallback is present, every protected route would silently
/// return 401. The embedded gateway refuses to start in that state instead,
/// with a diagnostic naming the two accepted configurations.
fn assert_embedded_iam_authentication_path(config: &BirdServerConfig) -> Result<(), String> {
    if config.runtime_target != BirdRuntimeTarget::Desktop {
        // Server and container deployments own their IAM bootstrap; only the
        // embedded desktop gateway needs this assertion.
        return Ok(());
    }
    let database_backed = installed_iam_database_pool_for_process().is_some()
        || std::env::var("SDKWORK_DATABASE_URL").is_ok_and(|value| !value.trim().is_empty());
    if database_backed || allows_dev_authentication_fallback() {
        return Ok(());
    }
    Err(
        "embedded gateway IAM authentication path is not ready: configure \
         SDKWORK_DATABASE_URL or explicitly enable the local development \
         authentication fallback (SDKWORK_IAM_ALLOW_DEV_AUTH_FALLBACK=1); refusing \
         to serve protected routes in a silently-unauthenticated state"
            .to_owned(),
    )
}

fn with_birdcoder_sdk_cors_headers(policy: CorsPolicy) -> CorsPolicy {
    let mut policy = policy;
    for header in BIRDOODER_SDK_CORS_REQUEST_HEADERS {
        if !policy
            .allowed_headers
            .iter()
            .any(|allowed| allowed.eq_ignore_ascii_case(header))
        {
            policy.allowed_headers.push((*header).to_owned());
        }
    }
    policy
}

/// Local development must never produce CORS friction: dev/test loopback-bound
/// standalone gateways allow any preflight request header so desktop/webview
/// browser surfaces are not broken whenever the SDK grows a new request
/// header. Production policies never apply this relaxation — they are rejected
/// by `CorsPolicy::validate_for_production` and use exact origin allowlists.
fn with_birdcoder_local_dev_header_relaxation(mut policy: CorsPolicy) -> CorsPolicy {
    if !policy.allowed_headers.iter().any(|allowed| allowed == "*") {
        policy.allowed_headers.push("*".to_owned());
    }
    policy
}

/// Desktop webview origins that the framework policies cannot express:
/// `development_loopback` / `development_private_network` are restricted to
/// http(s) origins, while the Tauri production webview loads from the
/// `tauri://` scheme. These are merged in for every local standalone profile
/// (dev or not) so the desktop surface never hits CORS friction.
const DESKTOP_WEBVIEW_ORIGINS: &[&str] =
    &["tauri://localhost", "https://tauri.localhost"];

pub fn build_cors_policy(config: &BirdServerConfig) -> CorsPolicy {
    // Canonical env allowlist via the official bootstrap helper:
    // `SDKWORK_CORS_ALLOWED_ORIGINS` wins, the legacy
    // `SDKWORK_BIRDCODER_ALLOWED_ORIGINS` key resolves as a compatibility
    // fallback with a deprecation warning. Config-provided origins
    // (host-derived defaults or programmatic construction) are merged on top.
    let mut explicit_origins =
        sdkwork_web_bootstrap::cors_allowed_origins_from_env(&["SDKWORK_BIRDCODER_ALLOWED_ORIGINS"]);
    for origin in &config.allowed_origins {
        if !explicit_origins.contains(origin) {
            explicit_origins.push(origin.clone());
        }
    }

    let uses_development_private_network =
        matches!(config.deployment_profile, BirdDeploymentProfile::Standalone)
            && matches!(
                config.environment,
                BirdEnvironment::Development | BirdEnvironment::Test
            );
    let is_local_standalone =
        matches!(config.deployment_profile, BirdDeploymentProfile::Standalone)
            && matches!(
                config.environment,
                BirdEnvironment::Development | BirdEnvironment::Test
            )
            && (is_loopback_bind_host(&config.host) || is_wildcard_bind_host(&config.host));

    // Framework-provided dev semantics supersede the hand-rolled loopback port
    // table: `development_private_network` covers loopback and private-network
    // dev-server origins; `development_loopback` covers loopback hosts for
    // local standalone development/test profiles. Production standalone
    // profiles always use the strict default policy plus the configured
    // explicit origins, so a production gateway never inherits the
    // development preflight relaxation (SECURITY_SPEC: production runtimes
    // must reject the development policy). Only the Tauri webview schemes are
    // added explicitly on top for dev/test local profiles. A literal "*" from
    // the environment never matches a real origin, so no separate wildcard
    // filtering/warning is needed.
    let mut policy = if uses_development_private_network {
        CorsPolicy::development_private_network()
    } else if is_local_standalone {
        CorsPolicy::development_loopback()
    } else {
        CorsPolicy::default()
    };
    for origin in explicit_origins {
        if !policy.allowed_origins.contains(&origin) {
            policy.allowed_origins.push(origin);
        }
    }
    if uses_development_private_network || is_local_standalone {
        for origin in DESKTOP_WEBVIEW_ORIGINS {
            if !policy.allowed_origins.iter().any(|allowed| allowed == origin) {
                policy.allowed_origins.push((*origin).to_owned());
            }
        }
    }
    policy = with_birdcoder_sdk_cors_headers(policy);
    if uses_development_private_network || is_local_standalone {
        policy = with_birdcoder_local_dev_header_relaxation(policy);
    }
    policy
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
        // Isolate the policy builder from any ambient CORS configuration so the
        // assertions below are deterministic.
        std::env::remove_var("SDKWORK_BIRDCODER_ALLOWED_ORIGINS");
        std::env::remove_var("SDKWORK_CORS_ALLOWED_ORIGINS");
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
    fn standalone_production_cors_uses_strict_policy_without_header_relaxation() {
        // Production standalone must never inherit the development CORS
        // policy: an unlisted loopback renderer origin is rejected and the
        // preflight header gate is not relaxed to "*" (SECURITY_SPEC §4:
        // production runtimes must reject the development policy). The
        // desktop webview always talks to the embedded Development gateway,
        // which keeps the development policies.
        let config = BirdServerConfig {
            environment: BirdEnvironment::Production,
            ..test_config(BirdDeploymentProfile::Standalone)
        };
        let policy = build_cors_policy(&config);
        let request = Request::builder()
            .header("origin", "http://127.0.0.1:1520")
            .header("access-control-request-method", "GET")
            .header(
                "access-control-request-headers",
                "authorization, access-token, x-platform, x-tenant-id, \
                 x-organization-id, x-user-id, x-sdkwork-client-kind, \
                 x-request-id, x-sdkwork-agent-token",
            )
            .body(axum::body::Body::empty())
            .expect("build desktop renderer preflight request");

        assert!(
            policy.validate_origin(&request).is_err(),
            "unlisted loopback origin must be rejected under standalone production"
        );
        assert!(
            !policy.allowed_headers.iter().any(|allowed| allowed == "*"),
            "standalone production must not relax preflight headers"
        );

        // The configured explicit operator origin stays allowed.
        let configured_origin = Request::builder()
            .header("origin", "https://operator.example.test")
            .body(axum::body::Body::empty())
            .expect("build configured origin request");
        assert!(policy.validate_origin(&configured_origin).is_ok());
    }

    #[test]
    fn birdcoder_sdk_preflight_allows_platform_identity_headers() {
        // The desktop webview (vite dev on 1520) fetches the embedded gateway
        // cross-origin; the SDK base client attaches X-Platform/X-User-Id and
        // friends, so the preflight must be able to request those headers.
        let policy = build_cors_policy(&test_config(BirdDeploymentProfile::Standalone));
        let request = Request::builder()
            .header("origin", "http://127.0.0.1:1520")
            .header("access-control-request-method", "GET")
            .header(
                "access-control-request-headers",
                "authorization, access-token, x-platform, x-tenant-id, \
                 x-organization-id, x-user-id, x-sdkwork-client-kind",
            )
            .body(axum::body::Body::empty())
            .expect("build birdcoder sdk preflight request");

        assert!(
            policy.validate_preflight(&request).is_ok(),
            "birdcoder SDK preflight headers must be allowed"
        );
        assert!(
            policy.validate_origin(&request).is_ok(),
            "desktop webview origin must be allowed"
        );
    }

    #[test]
    fn cloud_cors_does_not_expand_operator_origins() {
        let policy = build_cors_policy(&test_config(BirdDeploymentProfile::Cloud));

        assert_eq!(policy.allowed_origins, ["https://operator.example.test"]);
    }
}
