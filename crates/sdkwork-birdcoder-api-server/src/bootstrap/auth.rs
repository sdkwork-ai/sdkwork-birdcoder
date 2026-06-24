use axum::Router;
use sdkwork_iam_web_adapter::{build_web_framework_layer, iam_database_resolver_from_env};
use sdkwork_web_axum::with_web_request_context;
use sdkwork_web_core::{CorsPolicy, HttpMetricsRegistry, RateLimitPolicy, SecurityPolicy};
use std::sync::Arc;

use crate::bootstrap::config::{default_loopback_browser_origins, is_loopback_bind_host, BirdServerConfig};
use crate::bootstrap::route_manifest::birdcoder_product_app_api_route_manifest;

pub fn birdcoder_public_path_prefixes() -> Vec<String> {
    vec!["/app/v3/api/system/iam".to_string()]
}

pub async fn build_protected_app_router(
    router: Router,
    config: &BirdServerConfig,
    metrics: Arc<HttpMetricsRegistry>,
) -> Router {
    let resolver = iam_database_resolver_from_env().await;
    let manifest = birdcoder_product_app_api_route_manifest();
    manifest
        .validate_public_path_prefixes(&birdcoder_public_path_prefixes())
        .expect("route manifest public prefix validation failed");

    let layer = build_web_framework_layer(
        resolver,
        manifest,
        birdcoder_public_path_prefixes(),
    )
    .with_security_policy(build_security_policy(config))
    .with_metrics(metrics);

    with_web_request_context(router, layer)
}

fn build_security_policy(config: &BirdServerConfig) -> SecurityPolicy {
    let uses_wildcard = config.allowed_origins.iter().any(|origin| origin == "*");
    let explicit_origins: Vec<String> = config
        .allowed_origins
        .iter()
        .filter(|origin| *origin != "*")
        .cloned()
        .collect();

    let cors = if uses_wildcard {
        tracing::warn!(
            "BIRDCODER_CODING_SERVER_ALLOWED_ORIGINS contains '*' which is forbidden; falling back to explicit origins only."
        );
        CorsPolicy {
            allow_all_origins: false,
            allowed_origins: explicit_origins,
            ..CorsPolicy::default()
        }
    } else if explicit_origins.is_empty() && is_loopback_bind_host(&config.host) {
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
    };

    SecurityPolicy {
        cors,
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
