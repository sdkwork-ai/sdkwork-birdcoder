use axum::Router;
use sdkwork_iam_web_adapter::{build_web_framework_layer, iam_database_resolver_from_env};
use sdkwork_web_axum::with_web_request_context;
use sdkwork_web_core::{CorsPolicy, SecurityPolicy};

use crate::bootstrap::config::BirdServerConfig;
use crate::bootstrap::route_manifest::birdcoder_product_app_api_route_manifest;

pub fn birdcoder_public_path_prefixes() -> Vec<String> {
    vec![
        "/app/v3/api/system/iam".to_string(),
    ]
}

pub async fn build_protected_app_router(router: Router, config: &BirdServerConfig) -> Router {
    let resolver = iam_database_resolver_from_env().await;
    let manifest = birdcoder_product_app_api_route_manifest();
    if let Err(error) = manifest.validate_public_path_prefixes(&birdcoder_public_path_prefixes()) {
        tracing::warn!("route manifest public prefix validation: {error}");
    }

    let layer = build_web_framework_layer(
        resolver,
        manifest,
        birdcoder_public_path_prefixes(),
    )
    .with_security_policy(build_security_policy(config));

    with_web_request_context(router, layer)
}

fn build_security_policy(config: &BirdServerConfig) -> SecurityPolicy {
    let uses_wildcard = config.allowed_origins.iter().any(|origin| origin == "*");
    let loopback_only = uses_wildcard && is_loopback_host(&config.host);

    let cors = if loopback_only {
        CorsPolicy {
            allow_all_origins: false,
            allowed_origins: default_loopback_cors_origins(),
            ..CorsPolicy::default()
        }
    } else if uses_wildcard {
        CorsPolicy {
            allow_all_origins: true,
            ..CorsPolicy::default()
        }
    } else {
        CorsPolicy {
            allow_all_origins: false,
            allowed_origins: config.allowed_origins.clone(),
            ..CorsPolicy::default()
        }
    };

    SecurityPolicy {
        cors,
        ..SecurityPolicy::default()
    }
}

fn is_loopback_host(host: &str) -> bool {
    host == "127.0.0.1" || host.eq_ignore_ascii_case("localhost")
}

fn default_loopback_cors_origins() -> Vec<String> {
    vec![
        "http://127.0.0.1:5173".to_string(),
        "http://localhost:5173".to_string(),
        "http://127.0.0.1:4173".to_string(),
        "http://localhost:4173".to_string(),
        "tauri://localhost".to_string(),
        "https://tauri.localhost".to_string(),
    ]
}
