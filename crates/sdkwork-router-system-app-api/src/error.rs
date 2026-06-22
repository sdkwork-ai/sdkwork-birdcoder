use axum::http::StatusCode;
use axum::Json;
use sdkwork_birdcoder_system_descriptor_service::error::SystemDescriptorError;

pub use sdkwork_birdcoder_errors::ProblemDetailsPayload;

fn with_trace_id(
    payload: ProblemDetailsPayload,
    trace_id: Option<&str>,
) -> ProblemDetailsPayload {
    payload.with_trace_id(trace_id)
}

pub fn map_system_error(
    error: SystemDescriptorError,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        SystemDescriptorError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_found", msg, false),
                trace_id,
            )),
        ),
        SystemDescriptorError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(with_trace_id(
                ProblemDetailsPayload::new("invalid_input", msg, false),
                trace_id,
            )),
        ),
        SystemDescriptorError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(
                ProblemDetailsPayload::new("internal", msg, true),
                trace_id,
            )),
        ),
    }
}
