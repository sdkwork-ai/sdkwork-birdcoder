use axum::http::StatusCode;
use sdkwork_birdcoder_commerce_service::error::CommerceError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_internal_problem, traced_platform_problem,
    traced_problem_json,
};

pub use sdkwork_birdcoder_errors::ProblemJsonBody;

pub fn map_service_error(error: CommerceError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        CommerceError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        CommerceError::InvalidInput(msg) => traced_platform_problem(
            SdkWorkResultCode::ValidationError,
            msg,
            trace_id,
        ),
        CommerceError::Forbidden(msg) => traced_platform_problem(
            SdkWorkResultCode::PermissionRequired,
            msg,
            trace_id,
        ),
        CommerceError::Conflict(msg) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, msg, trace_id)
        }
        CommerceError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        CommerceError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::Json;
    use sdkwork_utils_rust::SdkWorkResultCode;

    #[test]
    fn maps_conflict_to_platform_conflict_code() {
        let (_, _, Json(body)) = map_service_error(
            CommerceError::Conflict("already paid".to_string()),
            Some("trace-409"),
        );
        assert_eq!(body.code, SdkWorkResultCode::Conflict.as_i32());
    }
}
