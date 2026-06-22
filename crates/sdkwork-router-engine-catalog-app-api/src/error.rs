use axum::http::StatusCode;
use axum::Json;
use sdkwork_birdcoder_engine_catalog_service::error::EngineCatalogError;
use sdkwork_birdcoder_native_sessions_service::error::NativeSessionError;

pub use sdkwork_birdcoder_errors::ProblemDetailsPayload;

fn with_trace_id(
    payload: ProblemDetailsPayload,
    trace_id: Option<&str>,
) -> ProblemDetailsPayload {
    payload.with_trace_id(trace_id)
}

pub fn map_engine_catalog_error(
    error: EngineCatalogError,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        EngineCatalogError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_found", msg, false),
                trace_id,
            )),
        ),
        EngineCatalogError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(with_trace_id(
                ProblemDetailsPayload::new("invalid_input", msg, false),
                trace_id,
            )),
        ),
        EngineCatalogError::Repository(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(
                ProblemDetailsPayload::new("repository", msg, true),
                trace_id,
            )),
        ),
        EngineCatalogError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(
                ProblemDetailsPayload::new("internal", msg, true),
                trace_id,
            )),
        ),
    }
}

pub fn map_native_session_error(
    error: NativeSessionError,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        NativeSessionError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_found", msg, false),
                trace_id,
            )),
        ),
        NativeSessionError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(with_trace_id(
                ProblemDetailsPayload::new("invalid_input", msg, false),
                trace_id,
            )),
        ),
        NativeSessionError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(with_trace_id(
                ProblemDetailsPayload::new("conflict", msg, false),
                trace_id,
            )),
        ),
        NativeSessionError::Repository(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(
                ProblemDetailsPayload::new("repository", msg, true),
                trace_id,
            )),
        ),
        NativeSessionError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(
                ProblemDetailsPayload::new("internal", msg, true),
                trace_id,
            )),
        ),
    }
}
