use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use tower::ServiceExt;

use sdkwork_api_birdcoder_standalone_gateway::bootstrap::config::{
    BirdDeploymentProfile, BirdEnvironment, BirdRuntimeTarget, BirdServerConfig,
    DEFAULT_RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_WINDOW_SECS,
};

struct EnvironmentGuard {
    previous: Vec<(&'static str, Option<String>)>,
}

impl EnvironmentGuard {
    fn install() -> Self {
        let application_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .expect("resolve BirdCoder application root")
            .to_string_lossy()
            .into_owned();
        let values = [
            ("SDKWORK_APP_ROOT", application_root.clone()),
            ("SDKWORK_BIRDCODER_APP_ROOT", application_root),
            ("SDKWORK_DEPLOYMENT_ENV", "development".to_owned()),
            ("SDKWORK_AGENTS_ENVIRONMENT", "development".to_owned()),
            ("SDKWORK_AGENTS_CONFIG_PROFILE", "development".to_owned()),
            ("SDKWORK_AGENTS_DEV_AUTH_BYPASS", "true".to_owned()),
            ("SDKWORK_ENV", "dev".to_owned()),
        ];
        let previous = values
            .iter()
            .map(|(key, _)| (*key, std::env::var(key).ok()))
            .collect();
        for (key, value) in values {
            std::env::set_var(key, &value);
        }
        Self { previous }
    }
}

impl Drop for EnvironmentGuard {
    fn drop(&mut self) {
        for (key, value) in self.previous.drain(..) {
            match value {
                Some(value) => std::env::set_var(key, value),
                None => std::env::remove_var(key),
            }
        }
    }
}

fn test_config() -> BirdServerConfig {
    BirdServerConfig {
        environment: BirdEnvironment::Development,
        deployment_profile: BirdDeploymentProfile::Standalone,
        runtime_target: BirdRuntimeTarget::Server,
        host: "127.0.0.1".to_owned(),
        port: 0,
        allowed_origins: vec!["http://127.0.0.1:5173".to_owned()],
        rate_limit_enabled: false,
        rate_limit_max_requests: DEFAULT_RATE_LIMIT_MAX_REQUESTS,
        rate_limit_window_secs: DEFAULT_RATE_LIMIT_WINDOW_SECS,
    }
}

async fn request(router: &axum::Router, uri: &str) -> axum::response::Response {
    router
        .clone()
        .oneshot(
            Request::builder()
                .uri(uri)
                .body(Body::empty())
                .expect("build smoke request"),
        )
        .await
        .expect("serve smoke request")
}

async fn request_method(
    router: &axum::Router,
    method: Method,
    uri: &str,
) -> axum::response::Response {
    router
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(uri)
                .header("content-type", "application/json")
                .body(Body::from("{}"))
                .expect("build smoke request"),
        )
        .await
        .expect("serve smoke request")
}

async fn cors_preflight(
    router: &axum::Router,
    uri: &str,
    requested_headers: &str,
) -> axum::response::Response {
    router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::OPTIONS)
                .uri(uri)
                .header("origin", "http://127.0.0.1:5173")
                .header("access-control-request-method", "POST")
                .header("access-control-request-headers", requested_headers)
                .body(Body::empty())
                .expect("build CORS preflight request"),
        )
        .await
        .expect("serve CORS preflight request")
}

async fn json_body(response: axum::response::Response) -> serde_json::Value {
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read JSON response");
    serde_json::from_slice(&bytes).expect("parse JSON response")
}

async fn assert_unclassified_owner_route(router: &axum::Router, uri: &str) {
    let owner_manifest =
        sdkwork_api_birdcoder_assembly::bootstrap::route_manifest::birdcoder_app_api_route_manifest(
        );
    assert!(
        owner_manifest.match_route("GET", uri).is_none(),
        "{uri} must not exist in the BirdCoder owner route manifest"
    );

    let response = request(router, uri).await;
    assert_eq!(
        response.status(),
        StatusCode::UNAUTHORIZED,
        "{uri} must be rejected by surface classification"
    );
}

async fn assert_matched_problem_route(
    router: &axum::Router,
    openapi: &serde_json::Value,
    method: Method,
    request_uri: &str,
    route_template: &str,
    expected_status: StatusCode,
) {
    let owner_manifest =
        sdkwork_api_birdcoder_assembly::bootstrap::route_manifest::birdcoder_app_api_route_manifest(
        );
    assert!(
        owner_manifest
            .match_route(method.as_str(), route_template)
            .is_none(),
        "{method} {route_template} must remain dependency-owned"
    );

    let operation_id = openapi["paths"][route_template][method.as_str().to_ascii_lowercase()]
        ["operationId"]
        .as_str()
        .unwrap_or_else(|| panic!("OpenAPI operation missing for {method} {route_template}"));
    let response = request_method(router, method.clone(), request_uri).await;
    assert_eq!(
        response.status(),
        expected_status,
        "{method} {request_uri} must match the assembled dependency route"
    );
    assert_eq!(
        response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok()),
        Some("application/problem+json")
    );
    let problem = json_body(response).await;
    assert_eq!(
        problem["instance"],
        format!("{method} {route_template}"),
        "{method} {request_uri} must expose the matched route template"
    );
    assert_eq!(
        problem["operationId"], operation_id,
        "{method} {request_uri} must expose the owner operationId"
    );
}

#[tokio::test(flavor = "current_thread")]
async fn gateway_mounts_selected_owner_contributions_on_one_router() {
    let _environment = EnvironmentGuard::install();
    let router = sdkwork_api_birdcoder_standalone_gateway::build_app(&test_config())
        .await
        .expect("build BirdCoder composition gateway");

    let health_response = request(&router, "/healthz").await;
    assert_eq!(health_response.status(), StatusCode::OK);
    assert_eq!(
        json_body(health_response).await,
        serde_json::json!({ "status": "ok" })
    );
    let liveness_response = request(&router, "/livez").await;
    assert_eq!(liveness_response.status(), StatusCode::OK);
    assert_eq!(
        json_body(liveness_response).await,
        serde_json::json!({ "status": "ok" })
    );
    let readiness_response = request(&router, "/readyz").await;
    assert_eq!(readiness_response.status(), StatusCode::OK);
    assert_eq!(
        json_body(readiness_response).await,
        serde_json::json!({ "status": "ready" })
    );
    assert_eq!(
        request(&router, "/app/v3/api/system/health").await.status(),
        StatusCode::UNAUTHORIZED
    );

    let openapi_response = request(&router, "/openapi.json").await;
    assert_eq!(openapi_response.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(openapi_response.into_body(), usize::MAX)
        .await
        .expect("read standalone OpenAPI response");
    let document: serde_json::Value =
        serde_json::from_slice(&bytes).expect("parse standalone OpenAPI response");
    for selected_owner_path in [
        "/app/v3/api/system/health",
        "/app/v3/api/auth/sessions/current",
        "/app/v3/api/oauth/device_authorizations",
        "/app/v3/api/ai/projects",
        "/app/v3/api/documents",
        "/app/v3/api/drive/spaces",
        "/app/v3/api/memberships/current",
        "/app/v3/api/orders",
        "/app/v3/api/recharges/orders",
        "/app/v3/api/prompts/templates",
        "/app/v3/api/skills",
    ] {
        assert!(
            document["paths"].get(selected_owner_path).is_some(),
            "standalone OpenAPI must contain {selected_owner_path}"
        );
    }

    for (request_uri, route_template) in [
        (
            "/app/v3/api/auth/sessions/current",
            "/app/v3/api/auth/sessions/current",
        ),
        (
            "/app/v3/api/ai/projects?page=1&page_size=20",
            "/app/v3/api/ai/projects",
        ),
        (
            "/app/v3/api/documents?page=1&page_size=20",
            "/app/v3/api/documents",
        ),
        (
            "/app/v3/api/drive/spaces?page=1&page_size=20",
            "/app/v3/api/drive/spaces",
        ),
        (
            "/app/v3/api/memberships/current",
            "/app/v3/api/memberships/current",
        ),
        (
            "/app/v3/api/orders?page=1&page_size=20",
            "/app/v3/api/orders",
        ),
        (
            "/app/v3/api/recharges/orders?page=1&page_size=20",
            "/app/v3/api/recharges/orders",
        ),
        (
            "/app/v3/api/prompts/templates?page=1&page_size=20",
            "/app/v3/api/prompts/templates",
        ),
        (
            "/app/v3/api/skills?page=1&page_size=20",
            "/app/v3/api/skills",
        ),
    ] {
        assert_matched_problem_route(
            &router,
            &document,
            Method::GET,
            request_uri,
            route_template,
            StatusCode::UNAUTHORIZED,
        )
        .await;
    }

    let order_preflight = cors_preflight(
        &router,
        "/app/v3/api/recharges/orders",
        "authorization,access-token,content-type,idempotency-key,x-content-sha256",
    )
    .await;
    assert_eq!(order_preflight.status(), StatusCode::NO_CONTENT);
    assert_eq!(
        order_preflight
            .headers()
            .get("access-control-allow-origin")
            .and_then(|value| value.to_str().ok()),
        Some("http://127.0.0.1:5173")
    );
    let allowed_headers = order_preflight
        .headers()
        .get("access-control-allow-headers")
        .and_then(|value| value.to_str().ok())
        .expect("Order preflight must expose allowed request headers")
        .to_ascii_lowercase();
    for required_header in [
        "authorization",
        "access-token",
        "content-type",
        "idempotency-key",
        "x-content-sha256",
    ] {
        assert!(
            allowed_headers
                .split(',')
                .map(str::trim)
                .any(|header| header == required_header),
            "Order preflight must allow {required_header}"
        );
    }

    let device_authorization_response = request_method(
        &router,
        Method::POST,
        "/app/v3/api/oauth/device_authorizations",
    )
    .await;
    assert_eq!(device_authorization_response.status(), StatusCode::OK);
    let device_authorization = json_body(device_authorization_response).await;
    assert_eq!(device_authorization["code"], 0);
    assert!(
        device_authorization["data"].is_object(),
        "IAM device authorization must return its real SDKWork success envelope"
    );

    assert_unclassified_owner_route(&router, "/app/v3/api/workspaces").await;
    assert_unclassified_owner_route(&router, "/app/v3/api/projects").await;
}
