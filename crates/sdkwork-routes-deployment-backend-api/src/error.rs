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
        DeploymentError::Forbidden(msg) => traced_platform_problem(
            SdkWorkResultCode::PermissionRequired,
            msg,
            trace_id,
        ),
        DeploymentError::InvalidInput(msg) => traced_platform_problem(
            SdkWorkResultCode::ValidationError,
            msg,
            trace_id,
        ),
        DeploymentError::Conflict(msg) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, msg, trace_id)
        }
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

pub fn map_workspace_error(error: WorkspaceError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        WorkspaceError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        WorkspaceError::Forbidden(msg) => traced_platform_problem(
            SdkWorkResultCode::PermissionRequired,
            msg,
            trace_id,
        ),
        WorkspaceError::InvalidInput(msg) => traced_platform_problem(
            SdkWorkResultCode::ValidationError,
            msg,
            trace_id,
        ),
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
