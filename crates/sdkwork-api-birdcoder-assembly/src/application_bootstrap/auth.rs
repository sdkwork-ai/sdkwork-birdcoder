use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::middleware::{from_fn_with_state, Next};
use axum::response::Response;
use axum::Router;
use sdkwork_iam_web_adapter::{
    build_web_framework_layer, iam_web_request_context_resolver_from_env, IamAuthorizationPolicy,
};
use sdkwork_web_axum::with_web_request_context;
use sdkwork_web_core::{CorsPolicy, HttpMetricsRegistry, RateLimitPolicy, SecurityPolicy};
use std::sync::Arc;

use crate::bootstrap::config::{
    default_loopback_browser_origins, is_loopback_bind_host, is_wildcard_bind_host,
    BirdDeploymentProfile, BirdServerConfig,
};
use crate::bootstrap::route_manifest::birdcoder_app_api_route_manifest;

pub fn birdcoder_public_path_prefixes() -> Vec<String> {
    Vec::new()
}

pub async fn build_protected_app_router(
    router: Router,
    config: &BirdServerConfig,
    metrics: Arc<HttpMetricsRegistry>,
) -> Result<Router, String> {
    let resolver = iam_web_request_context_resolver_from_env().await;
    let manifest = birdcoder_app_api_route_manifest();
    manifest
        .validate_public_path_prefixes(&birdcoder_public_path_prefixes())
        .map_err(|error| format!("route manifest public prefix validation failed: {error}"))?;

    let authorization_policy = Arc::new(IamAuthorizationPolicy::new(manifest));

    let layer = build_web_framework_layer(resolver, manifest, birdcoder_public_path_prefixes())
        .with_security_policy(build_security_policy(config))
        .with_authorization_policy(authorization_policy)
        .with_metrics(metrics);
    Ok(with_web_request_context(router, layer))
}

/// Gateway-wide CORS middleware.
///
/// Applies the BirdCoder CORS policy to every response and short-circuits
/// OPTIONS preflight requests with `200 OK` so that browsers accept the
/// preflight response. This is necessary because:
///
/// 1. IAM routes (`/app/v3/api/oauth/*`, `/app/v3/api/auth/*`) are wrapped by
///    the IAM web framework layer whose CORS policy is derived from
///    `SDKWORK_IM_ENVIRONMENT`. When that variable is unset (production
///    default), the IAM layer rejects cross-origin requests from the BirdCoder
///    dev server origins.
/// 2. Axum returns `405 Method Not Allowed` for OPTIONS requests on routes
///    that only register `POST`/`GET`/etc., causing browsers to fail the
///    preflight with "It does not have HTTP ok status".
///
/// By applying the BirdCoder `build_cors_policy` at the gateway boundary and
/// short-circuiting preflight, CORS is handled uniformly regardless of the
/// inner router's security policy.
pub(crate) fn with_gateway_cors<S>(router: Router<S>, config: &BirdServerConfig) -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    router.layer(from_fn_with_state(
        Arc::new(build_cors_policy(config)),
        gateway_cors_middleware,
    ))
}

async fn gateway_cors_middleware(
    State(cors): State<Arc<CorsPolicy>>,
    request: Request,
    next: Next,
) -> Response {
    let origin = request
        .headers()
        .get("origin")
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);

    // Short-circuit CORS preflight (OPTIONS) requests with 200 OK so the
    // browser accepts the preflight. Without this, axum returns 405 for
    // routes that don't explicitly register an OPTIONS handler.
    if request.method() == axum::http::Method::OPTIONS {
        let mut response = Response::new(axum::body::Body::empty());
        *response.status_mut() = StatusCode::OK;
        SecurityPolicy::apply_cors_policy_headers_from_origin(
            cors.as_ref(),
            origin.as_deref(),
            &mut response,
        );
        return response;
    }

    let mut response = next.run(request).await;
    SecurityPolicy::apply_cors_policy_headers_from_origin(
        cors.as_ref(),
        origin.as_deref(),
        &mut response,
    );
    response
}

pub(crate) fn build_cors_policy(config: &BirdServerConfig) -> CorsPolicy {
    let uses_wildcard = config.allowed_origins.iter().any(|origin| origin == "*");
    let mut explicit_origins: Vec<String> = config
        .allowed_origins
        .iter()
        .filter(|origin| *origin != "*")
        .cloned()
        .collect();

    // Development clients can be served from dynamically assigned LAN IPs and
    // arbitrary dev-server ports. The shared framework policy keeps this
    // limited to loopback/private-network origins and is production-invalid.
    let uses_development_private_network =
        matches!(config.deployment_profile, BirdDeploymentProfile::Standalone)
            && matches!(
                config.environment,
                crate::bootstrap::config::BirdEnvironment::Development
                    | crate::bootstrap::config::BirdEnvironment::Test
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

    // Non-development standalone servers retain exact loopback defaults when
    // bound locally. Cloud deployments always require operator-owned origins.
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
    use crate::bootstrap::config::{BirdEnvironment, BirdRuntimeTarget};

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
