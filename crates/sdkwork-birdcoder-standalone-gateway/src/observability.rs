use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::middleware::{from_fn_with_state, Next};
use axum::response::{IntoResponse, Response};
use axum::Router;
use sdkwork_web_core::HttpMetricsRegistry;
use std::sync::Arc;
use std::time::Instant;

use crate::business_metrics::BusinessMetricsRegistry;

/// Renders both the framework HTTP metrics and the BirdCoder business metrics at
/// `/metrics` so a single Prometheus scrape captures infra + business signals.
pub async fn metrics_handler(
    http: Arc<HttpMetricsRegistry>,
    business: Arc<BusinessMetricsRegistry>,
) -> impl IntoResponse {
    let mut body = http.render_prometheus();
    body.push_str(&business.render_prometheus());
    (
        StatusCode::OK,
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        body,
    )
}

/// Records API request latency and totals into the business metrics registry.
///
/// Applied as an axum middleware. Infra scrape/health paths (`/metrics`,
/// `/healthz`, `/livez`, `/readyz`, `/openapi.json`) are skipped to
/// avoid self-reinforcing observation noise.
pub async fn metrics_middleware(
    State(business): State<Arc<BusinessMetricsRegistry>>,
    request: Request,
    next: Next,
) -> Response {
    let path = request.uri().path().to_owned();
    let method = request.method().to_string();
    let start = Instant::now();

    let response = next.run(request).await;

    if !is_observability_infra_path(&path) {
        business.record_api_request(&method, &path, response.status().as_u16(), start.elapsed());
    }

    response
}

/// Returns true when `path` is an infrastructure path that must not inflate
/// business API request metrics. Mirrors `HttpMetricsRegistry::should_record_path`
/// and additionally skips `/openapi.json`.
pub fn is_observability_infra_path(path: &str) -> bool {
    let normalized = path.trim();
    let normalized = if normalized.is_empty() {
        "/"
    } else {
        normalized.trim_end_matches('/')
    };
    matches!(
        normalized,
        "/healthz" | "/livez" | "/readyz" | "/metrics" | "/openapi.json"
    )
}

/// Attaches [`metrics_middleware`] to `router` so every request records
/// `birdcoder_api_request_total` and `birdcoder_api_request_duration_seconds`.
pub fn with_business_metrics(router: Router, business: Arc<BusinessMetricsRegistry>) -> Router {
    router.layer(from_fn_with_state(business, metrics_middleware))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn infra_paths_are_skipped() {
        assert!(is_observability_infra_path("/metrics"));
        assert!(is_observability_infra_path("/healthz"));
        assert!(is_observability_infra_path("/livez"));
        assert!(is_observability_infra_path("/readyz"));
        assert!(is_observability_infra_path("/openapi.json"));
        assert!(!is_observability_infra_path("/health"));
        assert!(!is_observability_infra_path("/health/live"));
        assert!(!is_observability_infra_path("/ready"));
        assert!(!is_observability_infra_path(
            "/app/v3/api/intelligence/coding_sessions"
        ));
    }

    #[test]
    fn combined_render_contains_both_registries() {
        let http = HttpMetricsRegistry::new();
        let business = BusinessMetricsRegistry::new();
        business.record_coding_session_started("codex");

        let combined = format!(
            "{}{}",
            http.render_prometheus(),
            business.render_prometheus()
        );
        assert!(combined.contains("sdkwork_health_status"));
        assert!(combined.contains("birdcoder_coding_session_total 1"));
        assert!(combined.contains("birdcoder_active_sessions 1"));
    }
}
