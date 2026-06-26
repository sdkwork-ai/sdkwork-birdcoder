use axum::http::StatusCode;
use sdkwork_birdcoder_document_service::error::DocumentError;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_internal_problem, traced_problem_json,
};

pub use sdkwork_birdcoder_errors::{ProblemDetailsPayload, ProblemJsonBody};

pub fn map_service_error(error: DocumentError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        DocumentError::NotFound(msg) => traced_problem_json(
            StatusCode::NOT_FOUND,
            ProblemDetailsPayload::new("not_found", msg, false),
            trace_id,
        ),
        DocumentError::InvalidInput(msg) => traced_problem_json(
            StatusCode::BAD_REQUEST,
            ProblemDetailsPayload::new("invalid_input", msg, false),
            trace_id,
        ),
        DocumentError::Conflict(msg) => traced_problem_json(
            StatusCode::CONFLICT,
            ProblemDetailsPayload::new("conflict", msg, false),
            trace_id,
        ),
        DocumentError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        DocumentError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}
