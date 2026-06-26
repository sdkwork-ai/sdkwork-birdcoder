use axum::http::StatusCode;
use sdkwork_birdcoder_system_descriptor_service::error::SystemDescriptorError;

use sdkwork_birdcoder_errors::{
    client_safe_internal_problem, traced_problem_json,
};

pub use sdkwork_birdcoder_errors::{ProblemDetailsPayload, ProblemJsonBody};

pub fn map_system_error(
    error: SystemDescriptorError,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    match error {
        SystemDescriptorError::NotFound(msg) => traced_problem_json(
            StatusCode::NOT_FOUND,
            ProblemDetailsPayload::new("not_found", msg, false),
            trace_id,
        ),
        SystemDescriptorError::InvalidInput(msg) => traced_problem_json(
            StatusCode::BAD_REQUEST,
            ProblemDetailsPayload::new("invalid_input", msg, false),
            trace_id,
        ),
        SystemDescriptorError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}
