mod profile;
pub mod server;

pub use sdkwork_api_birdcoder_assembly::{
    assemble_api_router, bootstrap, business_metrics, observability, openapi,
};

use axum::Router;
use sdkwork_api_birdcoder_assembly::bootstrap::config::BirdServerConfig;
use sdkwork_web_bootstrap::ServiceRouterConfig;
use sdkwork_web_core::{HttpMetricsDimensions, HttpMetricsRegistry};

/// Builds the complete standalone gateway from owner API contributions.
///
/// This is the gateway-owned entry point that combines the host-neutral
/// assembly with process-wide Web Framework infrastructure per
/// `APPLICATION_GATEWAY_SPEC.md` section 2.
pub async fn build_app(
    config: &BirdServerConfig,
) -> Result<Router, Box<dyn std::error::Error + Send + Sync>> {
    build_app_with_provider_session_cwd_resolver(config, None).await
}

pub async fn build_app_with_provider_session_cwd_resolver(
    config: &BirdServerConfig,
    resolver: Option<
        std::sync::Arc<dyn sdkwork_agents_runtime_facade::ProviderSessionProjectCwdResolver>,
    >,
) -> Result<Router, Box<dyn std::error::Error + Send + Sync>> {
    if workspace_postgres_profile_configured() {
        migrate_deployments_database().await?;
    } else {
        tracing::info!(
            "no workspace PostgreSQL profile configured; serving the stateless gateway \
             without the Deployments database lifecycle"
        );
    }
    let selected_profile = profile::assemble_standalone_profile(config, resolver)
        .await
        .map_err(|error| -> Box<dyn std::error::Error + Send + Sync> {
            Box::new(std::io::Error::other(error.to_string()))
        })?;
    build_app_from_profile(config, selected_profile).await
}

/// Whether the process explicitly provides a workspace PostgreSQL profile.
///
/// Mirrors `sdkwork_database_config::workspace_postgres_env_is_configured`:
/// `SDKWORK_DATABASE_URL` or any structured database field selects a profile,
/// while the client-local SQLite URL (`SDKWORK_DATABASE_SQLITE_URL`) is an
/// independent identity and does not count. Without an explicit profile the
/// gateway serves the documented stateless profile instead of letting the
/// Deployments module fall back to an invented development URL.
pub(crate) fn workspace_postgres_profile_configured() -> bool {
    const STRUCTURED_DATABASE_ENV_KEYS: &[&str] = &[
        "SDKWORK_DATABASE_ENGINE",
        "SDKWORK_DATABASE_HOST",
        "SDKWORK_DATABASE_PORT",
        "SDKWORK_DATABASE_NAME",
        "SDKWORK_DATABASE_SCHEMA",
        "SDKWORK_DATABASE_SCHEMA_FALLBACK_PUBLIC",
        "SDKWORK_DATABASE_USERNAME",
        "SDKWORK_DATABASE_PASSWORD",
        "SDKWORK_DATABASE_PASSWORD_FILE",
        "SDKWORK_DATABASE_SSL_MODE",
    ];
    std::env::var_os("SDKWORK_DATABASE_URL").is_some()
        || STRUCTURED_DATABASE_ENV_KEYS
            .iter()
            .any(|key| std::env::var_os(key).is_some())
}

/// Bootstraps the SDKWork Deploy module database (baseline + versioned
/// migrations + drift gate) before owner contributions are assembled. The
/// migration helper flips the process-wide `SDKWORK_DATABASE_AUTO_MIGRATE`
/// switch to `true`; the previous value is restored afterwards so the other
/// owner modules keep their configured startup behavior. Only reached when a
/// workspace PostgreSQL profile is configured; the stateless profile skips
/// this entirely (see `workspace_postgres_profile_configured`).
async fn migrate_deployments_database() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let previous_auto_migrate = std::env::var("SDKWORK_DATABASE_AUTO_MIGRATE").ok();
    let result = sdkwork_api_deployments_assembly::migrate_database_from_env().await;
    match previous_auto_migrate {
        Some(value) => std::env::set_var("SDKWORK_DATABASE_AUTO_MIGRATE", value),
        None => std::env::remove_var("SDKWORK_DATABASE_AUTO_MIGRATE"),
    }
    result.map_err(|error| -> Box<dyn std::error::Error + Send + Sync> {
        Box::new(std::io::Error::other(format!(
            "deploy database migration failed: {error}"
        )))
    })
}

async fn build_app_from_profile(
    config: &BirdServerConfig,
    selected_profile: profile::StandaloneApiProfile,
) -> Result<Router, Box<dyn std::error::Error + Send + Sync>> {
    let profile::StandaloneApiProfile {
        router,
        route_manifest,
        openapi,
        permission_catalog,
        domain_context_injectors,
        readiness_check,
    } = selected_profile;
    let metrics = HttpMetricsRegistry::with_dimensions(
        HttpMetricsDimensions::default()
            .with_service("sdkwork-api-birdcoder-standalone-gateway")
            .with_deployment_profile(config.deployment_profile.as_str())
            .with_runtime_target(config.runtime_target.as_str()),
    );
    tracing::info!(
        route_count = route_manifest.routes().len(),
        permission_count = permission_catalog.len(),
        "assembled BirdCoder standalone API profile"
    );

    let protected = server::framework::wrap_with_web_framework(
        router,
        route_manifest,
        domain_context_injectors,
        config,
        metrics.clone(),
    )
    .await
    .map_err(|error| -> Box<dyn std::error::Error + Send + Sync> {
        Box::new(std::io::Error::other(error.to_string()))
    })?;

    let business_metrics = business_metrics::BusinessMetricsRegistry::new();
    let openapi_handler = move || {
        let openapi = openapi.clone();
        async move { axum::Json(openapi) }
    };
    let app = Router::new()
        .merge(protected)
        .route("/openapi.json", axum::routing::get(openapi_handler))
        .route(
            "/metrics",
            axum::routing::get({
                let metrics = metrics.clone();
                let business_metrics = business_metrics.clone();
                move || {
                    let metrics = metrics.clone();
                    let business_metrics = business_metrics.clone();
                    async move { observability::metrics_handler(metrics, business_metrics).await }
                }
            }),
        );
    let app = sdkwork_web_bootstrap::mount_infra_routes(
        app,
        ServiceRouterConfig::default()
            .with_readiness_check(readiness_check)
            .skip_metrics(),
    );
    Ok(observability::with_business_metrics(app, business_metrics))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use sdkwork_web_bootstrap::{
        ReadinessCheck, ReadinessFuture, READINESS_DEPENDENCY_UNAVAILABLE,
    };
    use std::sync::Arc;
    use tower::ServiceExt;

    #[derive(Clone)]
    struct FailingReadiness;

    impl ReadinessCheck for FailingReadiness {
        fn check(&self) -> ReadinessFuture<'_> {
            Box::pin(async {
                Err("postgres://agents:secret@database.internal/agents is unavailable".to_owned())
            })
        }
    }

    fn test_config() -> BirdServerConfig {
        BirdServerConfig {
            environment: bootstrap::config::BirdEnvironment::Development,
            deployment_profile: bootstrap::config::BirdDeploymentProfile::Standalone,
            runtime_target: bootstrap::config::BirdRuntimeTarget::Server,
            host: "127.0.0.1".to_owned(),
            port: 10240,
            allowed_origins: vec!["http://127.0.0.1:5173".to_owned()],
            rate_limit_enabled: false,
            rate_limit_max_requests: 120,
            rate_limit_window_secs: 60,
        }
    }

    #[tokio::test]
    async fn readiness_uses_assembly_check_and_sanitizes_dependency_errors() {
        let app = build_app_from_profile(
            &test_config(),
            profile::StandaloneApiProfile {
                router: Router::new(),
                route_manifest: sdkwork_web_core::HttpRouteManifest::new(&[]),
                openapi: sdkwork_web_contract::build_openapi_document("test", &[]),
                permission_catalog: Vec::new(),
                domain_context_injectors: Vec::new(),
                readiness_check: Arc::new(FailingReadiness),
            },
        )
        .await
        .expect("build gateway with failing dependency readiness");

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/readyz")
                    .body(Body::empty())
                    .expect("build readiness request"),
            )
            .await
            .expect("serve readiness request");
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read readiness response");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("parse readiness response");
        assert_eq!(json["status"], "not_ready");
        assert_eq!(json["detail"], READINESS_DEPENDENCY_UNAVAILABLE);
        let text = String::from_utf8_lossy(&body);
        for private_detail in ["database.internal", "agents:secret", "postgres://"] {
            assert!(!text.contains(private_detail));
        }
    }
}
