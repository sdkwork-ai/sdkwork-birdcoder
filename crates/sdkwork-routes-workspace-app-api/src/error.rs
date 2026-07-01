use axum::http::StatusCode;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem, platform_problem, traced_legacy_problem,
    traced_platform_problem, traced_problem_json,
};

pub use sdkwork_birdcoder_errors::ProblemJsonBody;

pub fn forbidden(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::PermissionRequired, message, trace_id)
}

pub fn map_rate_limited(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_problem_json(
        StatusCode::TOO_MANY_REQUESTS,
        platform_problem(SdkWorkResultCode::RateLimitExceeded, message, trace_id),
        trace_id,
    )
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

pub fn map_project_error(error: ProjectError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        ProjectError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        ProjectError::Forbidden(msg) => traced_platform_problem(
            SdkWorkResultCode::PermissionRequired,
            msg,
            trace_id,
        ),
        ProjectError::InvalidInput(msg) => traced_platform_problem(
            SdkWorkResultCode::ValidationError,
            msg,
            trace_id,
        ),
        ProjectError::Conflict(msg) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, msg, trace_id)
        }
        ProjectError::GitOperation(msg) => traced_legacy_problem("git_operation", msg, trace_id),
        ProjectError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        ProjectError::EventPublish(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_event_publish_problem(),
            trace_id,
        ),
        ProjectError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}

pub fn map_deployment_error(error: DeploymentError, trace_id: Option<&str>) -> ProblemJsonBody {
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

pub fn map_not_implemented(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_legacy_problem("not_implemented", message, trace_id)
}

pub fn map_validation_error(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::ValidationError, message, trace_id)
}

pub fn map_not_found(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::NotFound, message, trace_id)
}
