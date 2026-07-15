use axum::http::StatusCode;
use sdkwork_birdcoder_document_service::error::DocumentError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_internal_problem, traced_platform_problem,
    traced_problem_json,
};

pub use sdkwork_birdcoder_errors::ProblemJsonBody;

pub fn map_service_error(error: DocumentError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        DocumentError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        DocumentError::InvalidInput(msg) => {
            traced_platform_problem(SdkWorkResultCode::ValidationError, msg, trace_id)
        }
        DocumentError::Conflict(msg) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, msg, trace_id)
        }
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
