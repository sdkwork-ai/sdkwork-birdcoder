use std::path::{Path, PathBuf};

use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};

const AUTHORITY_PATH: &str =
    "sdks/sdkwork-birdcoder-app-sdk/openapi/sdkwork-birdcoder-app-api.openapi.json";

pub async fn serve_openapi_json() -> Response {
    match load_openapi_authority() {
        Ok(body) => (
            StatusCode::OK,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/json"),
            )],
            body,
        )
            .into_response(),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

fn load_openapi_authority() -> Result<String, ()> {
    openapi_candidate_paths()
        .into_iter()
        .find_map(|path| {
            std::fs::read_to_string(path)
                .ok()
                .filter(|body| !body.trim().is_empty())
        })
        .ok_or(())
}

fn openapi_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(app_root) = std::env::var("SDKWORK_BIRDCODER_APP_ROOT") {
        let app_root = app_root.trim();
        if !app_root.is_empty() {
            paths.push(PathBuf::from(app_root).join(AUTHORITY_PATH));
        }
    }
    if let Some(workspace_root) = resolve_workspace_root() {
        paths.push(workspace_root.join(AUTHORITY_PATH));
    }
    paths.push(PathBuf::from(AUTHORITY_PATH));
    paths
}

fn resolve_workspace_root() -> Option<PathBuf> {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_app_api_authority_is_loadable() {
        let body = load_openapi_authority().unwrap_or_else(|_| {
            panic!(
                "OpenAPI authority not found at {:?}",
                openapi_candidate_paths()
            )
        });
        let document: serde_json::Value = serde_json::from_str(&body).expect("valid OpenAPI JSON");
        assert_eq!(
            document["x-sdkwork-api-authority"],
            "sdkwork-birdcoder-app-api"
        );
    }
}
