use axum::body::Body;
use axum::http::{Request, StatusCode};
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
        let values = [
            ("SDKWORK_DEPLOYMENT_ENV", "development"),
            ("SDKWORK_AGENTS_ENVIRONMENT", "development"),
            ("SDKWORK_AGENTS_CONFIG_PROFILE", "development"),
            ("SDKWORK_AGENTS_DEV_AUTH_BYPASS", "true"),
            ("SDKWORK_ENV", "dev"),
        ];
        let previous = values
            .iter()
            .map(|(key, _)| (*key, std::env::var(key).ok()))
            .collect();
        for (key, value) in values {
            std::env::set_var(key, value);
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

#[tokio::test(flavor = "current_thread")]
async fn gateway_mounts_system_and_agents_without_birdcoder_project_authority() {
    let _environment = EnvironmentGuard::install();
    let router = sdkwork_api_birdcoder_standalone_gateway::bootstrap::build_app(&test_config())
        .await
        .expect("build BirdCoder composition gateway");

    assert_eq!(request(&router, "/healthz").await.status(), StatusCode::OK);
    assert_eq!(
        request(&router, "/app/v3/api/system/health").await.status(),
        StatusCode::UNAUTHORIZED
    );

    let agents_response = request(&router, "/app/v3/api/ai/projects?page=1&page_size=20").await;
    assert_ne!(
        agents_response.status(),
        StatusCode::NOT_FOUND,
        "sdkwork-agents Project routes must be mounted by the BirdCoder gateway"
    );

    assert_unclassified_owner_route(&router, "/app/v3/api/workspaces").await;
    assert_unclassified_owner_route(&router, "/app/v3/api/projects").await;

    let openapi_response = request(&router, "/openapi.json").await;
    assert_eq!(openapi_response.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(openapi_response.into_body(), usize::MAX)
        .await
        .expect("read owner OpenAPI response");
    let document: serde_json::Value =
        serde_json::from_slice(&bytes).expect("parse owner OpenAPI response");
    let paths = document["paths"]
        .as_object()
        .expect("owner OpenAPI paths object");
    assert_eq!(paths.len(), 4);
    assert!(paths
        .keys()
        .all(|path| path.starts_with("/app/v3/api/system/")));
}
