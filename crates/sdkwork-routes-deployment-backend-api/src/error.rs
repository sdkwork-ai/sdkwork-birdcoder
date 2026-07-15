use axum::http::StatusCode;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem, traced_platform_problem, traced_problem_json,
};

pub use sdkwork_birdcoder_errors::ProblemJsonBody;

pub fn map_service_error(error: DeploymentError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        DeploymentError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        DeploymentError::Forbidden(msg) => {
            traced_platform_problem(SdkWorkResultCode::PermissionRequired, msg, trace_id)
        }
        DeploymentError::InvalidInput(msg) => {
            traced_platform_problem(SdkWorkResultCode::ValidationError, msg, trace_id)
        }
        DeploymentError::Conflict(msg) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, msg, trace_id)
        }
        DeploymentError::Unavailable(_) => traced_platform_problem(
            SdkWorkResultCode::ServiceUnavailable,
            SdkWorkResultCode::ServiceUnavailable.title(),
            trace_id,
        ),
        DeploymentError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        DeploymentError::EventPublish(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_event_publish_problem(),
            trace_id,
        ),
        DeploymentError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sdkwork_utils_rust::SdkWorkProblemDetail;

    #[test]
    fn unavailable_deployment_error_maps_to_a_client_safe_service_unavailable_problem() {
        let internal_detail = "deployment executor details must not be exposed to clients";
        let expected_detail = SdkWorkProblemDetail::client_safe_detail(
            SdkWorkResultCode::ServiceUnavailable,
            internal_detail,
        );
        let (status, _, axum::Json(problem)) = map_service_error(
            DeploymentError::Unavailable(internal_detail.to_owned()),
            Some("0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab"),
        );

        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(problem.code, SdkWorkResultCode::ServiceUnavailable.as_i32());
        assert_eq!(problem.detail.as_deref(), Some(expected_detail.as_str()));
        assert_eq!(problem.trace_id, "0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab");
    }
}

pub fn map_workspace_error(error: WorkspaceError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        WorkspaceError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        WorkspaceError::Forbidden(msg) => {
            traced_platform_problem(SdkWorkResultCode::PermissionRequired, msg, trace_id)
        }
        WorkspaceError::InvalidInput(msg) => {
            traced_platform_problem(SdkWorkResultCode::ValidationError, msg, trace_id)
        }
        WorkspaceError::Conflict(msg) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, msg, trace_id)
        }
        WorkspaceError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        WorkspaceError::EventPublish(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_event_publish_problem(),
            trace_id,
        ),
        WorkspaceError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}
