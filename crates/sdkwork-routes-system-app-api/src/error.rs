use axum::http::StatusCode;
use sdkwork_birdcoder_system_descriptor_service::error::SystemDescriptorError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_internal_problem, traced_platform_problem, traced_problem_json,
};

pub use sdkwork_birdcoder_errors::ProblemJsonBody;

pub fn map_system_error(error: SystemDescriptorError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        SystemDescriptorError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        SystemDescriptorError::InvalidInput(msg) => {
            traced_platform_problem(SdkWorkResultCode::ValidationError, msg, trace_id)
        }
        SystemDescriptorError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}
