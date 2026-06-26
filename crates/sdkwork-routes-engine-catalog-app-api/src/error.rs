use axum::http::StatusCode;
use sdkwork_birdcoder_engine_catalog_service::error::EngineCatalogError;
use sdkwork_birdcoder_native_sessions_service::error::NativeSessionError;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_internal_problem, traced_problem_json,
};

pub use sdkwork_birdcoder_errors::{ProblemDetailsPayload, ProblemJsonBody};

pub fn map_engine_catalog_error(
    error: EngineCatalogError,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    match error {
        EngineCatalogError::NotFound(msg) => traced_problem_json(
            StatusCode::NOT_FOUND,
            ProblemDetailsPayload::new("not_found", msg, false),
            trace_id,
        ),
        EngineCatalogError::InvalidInput(msg) => traced_problem_json(
            StatusCode::BAD_REQUEST,
            ProblemDetailsPayload::new("invalid_input", msg, false),
            trace_id,
        ),
        EngineCatalogError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        EngineCatalogError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}

pub fn map_native_session_error(
    error: NativeSessionError,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    match error {
        NativeSessionError::NotFound(msg) => traced_problem_json(
            StatusCode::NOT_FOUND,
            ProblemDetailsPayload::new("not_found", msg, false),
            trace_id,
        ),
        NativeSessionError::InvalidInput(msg) => traced_problem_json(
            StatusCode::BAD_REQUEST,
            ProblemDetailsPayload::new("invalid_input", msg, false),
            trace_id,
        ),
        NativeSessionError::Conflict(msg) => traced_problem_json(
            StatusCode::CONFLICT,
            ProblemDetailsPayload::new("conflict", msg, false),
            trace_id,
        ),
        NativeSessionError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        NativeSessionError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}
