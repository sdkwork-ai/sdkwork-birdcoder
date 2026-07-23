use axum::extract::{MatchedPath, Request, State};
use axum::http::StatusCode;
use axum::middleware::{from_fn_with_state, Next};
use axum::response::{IntoResponse, Response};
use axum::Router;
use sdkwork_web_core::HttpMetricsRegistry;
use std::sync::Arc;
use std::time::Instant;

use crate::business_metrics::BusinessMetricsRegistry;

/// Renders framework HTTP metrics and BirdCoder-owned workbench metrics.
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
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map(|matched| matched.as_str().to_owned())
        .unwrap_or_else(|| "unmatched".to_owned());
    let method = request.method().to_string();
    let start = Instant::now();

    let response = next.run(request).await;

    if !is_observability_infra_path(&route) {
        business.record_api_request(&method, &route, response.status().as_u16(), start.elapsed());
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
        assert!(!is_observability_infra_path("/app/v3/api/system/routes"));
    }

    #[test]
    fn combined_render_contains_both_registries() {
        let http = HttpMetricsRegistry::new();
        let business = BusinessMetricsRegistry::new();
        business.record_api_request(
            "GET",
            "/app/v3/api/system/health",
            200,
            std::time::Duration::from_millis(10),
        );

        let combined = format!(
            "{}{}",
            http.render_prometheus(),
            business.render_prometheus()
        );
        assert!(combined.contains("sdkwork_health_status"));
        assert!(combined.contains("birdcoder_workbench_api_request_total"));
        assert!(!combined.contains("coding_session"));
    }
}
