use std::path::{Path, PathBuf};

use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};

const OPENAPI_RELATIVE_PATHS: &[&str] = &[
    "openapi/coding-server-v1.json",
    "deployments/server-windows/x64/openapi/coding-server-v1.json",
    "deployments/server-win32/x64/openapi/coding-server-v1.json",
];

pub async fn serve_openapi_json() -> Response {
    match load_openapi_snapshot() {
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

fn load_openapi_snapshot() -> Result<String, ()> {
    if let Ok(path) = std::env::var("SDKWORK_OPENAPI_SNAPSHOT_PATH") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            if let Ok(body) = std::fs::read_to_string(trimmed) {
                if !body.trim().is_empty() {
                    return Ok(body);
                }
            }
        }
    }

    for candidate in openapi_candidate_paths() {
        if let Ok(body) = std::fs::read_to_string(&candidate) {
            if !body.trim().is_empty() {
                return Ok(body);
            }
        }
    }

    Err(())
}

fn openapi_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(app_root) = std::env::var("SDKWORK_BIRDCODER_APP_ROOT") {
        let trimmed = app_root.trim();
        if !trimmed.is_empty() {
            for relative_path in OPENAPI_RELATIVE_PATHS {
                paths.push(PathBuf::from(trimmed).join(relative_path));
            }
        }
    }
    if let Some(workspace_root) = resolve_workspace_root() {
        for relative_path in OPENAPI_RELATIVE_PATHS {
            paths.push(workspace_root.join(relative_path));
        }
    }

    for relative_path in OPENAPI_RELATIVE_PATHS {
        paths.push(PathBuf::from(relative_path));
    }

    paths
}

fn resolve_workspace_root() -> Option<PathBuf> {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|crates_dir| crates_dir.parent())
        .map(Path::to_path_buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openapi_snapshot_loads_from_deployments_path() {
        let body = load_openapi_snapshot().expect("openapi snapshot should load in workspace");
        assert!(body.contains("\"openapi\""));
        assert!(body.contains("SDKWork BirdCoder Coding Server API"));
    }
}
