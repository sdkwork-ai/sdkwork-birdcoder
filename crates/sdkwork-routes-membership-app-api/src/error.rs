use axum::http::StatusCode;
use sdkwork_birdcoder_membership_service::error::MembershipError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_internal_problem, client_safe_provider_problem,
    traced_platform_problem, traced_problem_json,
};

pub use sdkwork_birdcoder_errors::ProblemJsonBody;

pub fn forbidden(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::PermissionRequired, message, trace_id)
}

pub fn map_service_error(error: MembershipError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        MembershipError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        MembershipError::InvalidInput(msg) => traced_platform_problem(
            SdkWorkResultCode::ValidationError,
            msg,
            trace_id,
        ),
        MembershipError::Conflict(msg) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, msg, trace_id)
        }
        MembershipError::Provider(_) => traced_problem_json(
            StatusCode::BAD_GATEWAY,
            client_safe_provider_problem(),
            trace_id,
        ),
        MembershipError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        MembershipError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}
