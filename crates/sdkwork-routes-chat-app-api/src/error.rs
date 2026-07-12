use axum::http::StatusCode;
use sdkwork_birdcoder_chat_service::error::ChatError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_internal_problem, traced_platform_problem,
    traced_problem_json,
};

pub use sdkwork_birdcoder_errors::ProblemJsonBody;

pub fn map_service_error(error: ChatError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        ChatError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        ChatError::InvalidInput(msg) => traced_platform_problem(
            SdkWorkResultCode::ValidationError,
            msg,
            trace_id,
        ),
        ChatError::Forbidden(msg) => traced_platform_problem(
            SdkWorkResultCode::PermissionRequired,
            msg,
            trace_id,
        ),
        ChatError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        ChatError::Internal(_) => traced_problem_json(
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
    fn maps_not_found_to_platform_not_found_code() {
        let (_, _, Json(body)) = map_service_error(
            ChatError::NotFound("missing".to_string()),
            Some("trace-404"),
        );
        assert_eq!(body.code, SdkWorkResultCode::NotFound.as_i32());
        assert_eq!(body.trace_id, "trace-404");
    }

    #[test]
    fn maps_invalid_input_to_validation_error_code() {
        let (status, _, Json(body)) = map_service_error(
            ChatError::InvalidInput("bad role".to_string()),
            Some("trace-400"),
        );
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body.code, SdkWorkResultCode::ValidationError.as_i32());
    }

    #[test]
    fn maps_forbidden_to_permission_required_code() {
        let (status, _, Json(body)) = map_service_error(
            ChatError::Forbidden("denied".to_string()),
            Some("trace-403"),
        );
        assert_eq!(status, StatusCode::FORBIDDEN);
        assert_eq!(body.code, SdkWorkResultCode::PermissionRequired.as_i32());
    }

    #[test]
    fn maps_repository_errors_to_safe_internal_problem() {
        let (status, _, Json(body)) = map_service_error(
            ChatError::Repository("db down".to_string()),
            Some("trace-500"),
        );
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(
            body.detail.as_deref(),
            Some("An internal error occurred")
        );
    }
}
