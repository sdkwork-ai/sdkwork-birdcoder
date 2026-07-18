use std::path::{Path, PathBuf};

use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};

// ============================================================================
// OpenAPI serving strategy
// ============================================================================
// The current implementation serves the OpenAPI document from a static JSON
// snapshot committed under `openapi/coding-server-v1.json` and mirrored to
// `deployments/server-{windows,win32}/x64/openapi/`. The snapshot is the
// authoritative contract surface; contract tests in `scripts/` and the
// `commercial-readiness-truth-contract.test.mjs` guard it against drift.
//
// PLANNED MIGRATION (tracked as P1 in TECH-2026-06-24-commercial-readiness
// -alignment.md): replace the static snapshot with utoipa runtime generation
// so the document is always derived from the live route handlers. The
// migration requires:
//   1. Annotating every route handler in `crates/sdkwork-routes-*-app-api`
//      and `crates/sdkwork-routes-*-backend-api` with `#[utoipa::path]`
//      macros (100+ paths, 147+ methods).
//   2. Aggregating all annotated paths into a single `OpenApiDoc` via
//      `#[derive(OpenApi)]` with `paths(...)` enumeration.
//   3. Replacing `load_openapi_snapshot()` with a function that builds the
//      document at startup from the aggregated `OpenApiDoc` and serializes
//      it to JSON.
//   4. Keeping the static snapshot as a fallback for environments where the
//      route crates are not linked (e.g. minimal standalone gateway builds).
//   5. Updating contract tests to assert the runtime-generated document
//      matches the snapshot byte-for-byte (or json-schema-for-schema).
//
// Until the migration lands, the static snapshot remains the source of
// truth and `SDKWORK_OPENAPI_SNAPSHOT_PATH` env var can override the load
// path for non-standard deployments.
// ============================================================================

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
        let body = load_openapi_snapshot().unwrap_or_else(|_| {
            panic!(
                "openapi snapshot failed to load; tried paths: {:?}",
                openapi_candidate_paths()
            )
        });
        assert!(body.contains("\"openapi\""));
        assert!(body.contains("SDKWork BirdCoder Coding Server API"));
    }
}
