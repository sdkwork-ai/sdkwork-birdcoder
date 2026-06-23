use axum::http::StatusCode;
use axum::Json;
use sdkwork_birdcoder_engine_catalog_service::error::EngineCatalogError;
use sdkwork_birdcoder_native_sessions_service::error::NativeSessionError;

use sdkwork_birdcoder_errors::{client_safe_data_access_problem, client_safe_internal_problem};

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
        EngineCatalogError::Repository(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_data_access_problem(), trace_id)),
        ),
        EngineCatalogError::Internal(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_internal_problem(), trace_id)),
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
        NativeSessionError::Repository(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_data_access_problem(), trace_id)),
        ),
        NativeSessionError::Internal(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_internal_problem(), trace_id)),
        ),
    }
}
