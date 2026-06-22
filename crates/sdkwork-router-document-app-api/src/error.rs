use axum::http::StatusCode;
use axum::Json;
use sdkwork_birdcoder_document_service::error::DocumentError;

pub use sdkwork_birdcoder_errors::ProblemDetailsPayload;

fn with_trace_id(
    payload: ProblemDetailsPayload,
    trace_id: Option<&str>,
) -> ProblemDetailsPayload {
    payload.with_trace_id(trace_id)
}

pub fn map_service_error(
    error: DocumentError,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        DocumentError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_found", msg, false),
                trace_id,
            )),
        ),
        DocumentError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(with_trace_id(
                ProblemDetailsPayload::new("invalid_input", msg, false),
                trace_id,
            )),
        ),
        DocumentError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(with_trace_id(
                ProblemDetailsPayload::new("conflict", msg, false),
                trace_id,
            )),
        ),
        DocumentError::Repository(msg) | DocumentError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(
                ProblemDetailsPayload::new("internal", msg, true),
                trace_id,
            )),
        ),
    }
}
