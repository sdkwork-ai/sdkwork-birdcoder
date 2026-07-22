use axum::http::StatusCode;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_internal_problem, traced_legacy_problem,
    traced_platform_problem, traced_problem_json,
};

pub use sdkwork_birdcoder_errors::ProblemJsonBody;

pub fn forbidden(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::PermissionRequired, message, trace_id)
}

pub fn map_workspace_error(
    error: WorkspaceError,
    trace_id: Option<&str>,
    operation_id: &'static str,
) -> ProblemJsonBody {
    if matches!(
        &error,
        WorkspaceError::Repository(_) | WorkspaceError::Internal(_)
    ) {
        tracing::error!(
            trace_id = trace_id.unwrap_or("unavailable"),
            operation_id,
            error = %error,
            "workspace operation failed"
        );
    }
    match error {
        WorkspaceError::NotFound(message) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, message, trace_id)
        }
        WorkspaceError::Forbidden(message) => {
            traced_platform_problem(SdkWorkResultCode::PermissionRequired, message, trace_id)
        }
        WorkspaceError::InvalidInput(message) => {
            traced_platform_problem(SdkWorkResultCode::ValidationError, message, trace_id)
        }
        WorkspaceError::PreconditionRequired(message) => {
            traced_platform_problem(SdkWorkResultCode::PreconditionRequired, message, trace_id)
        }
        WorkspaceError::PreconditionFailed(message) => {
            traced_platform_problem(SdkWorkResultCode::PreconditionFailed, message, trace_id)
        }
        WorkspaceError::Conflict(message) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, message, trace_id)
        }
        WorkspaceError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        WorkspaceError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}

pub fn map_project_error(
    error: ProjectError,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    if matches!(
        &error,
        ProjectError::Repository(_)
            | ProjectError::GitOperation(_)
            | ProjectError::Internal(_)
    ) {
        tracing::error!(
            trace_id = trace_id.unwrap_or("unavailable"),
            error = %error,
            "project operation failed"
        );
    }
    match error {
        ProjectError::NotFound(message) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, message, trace_id)
        }
        ProjectError::Forbidden(message) => {
            traced_platform_problem(SdkWorkResultCode::PermissionRequired, message, trace_id)
        }
        ProjectError::InvalidInput(message) => {
            traced_platform_problem(SdkWorkResultCode::ValidationError, message, trace_id)
        }
        ProjectError::PreconditionRequired(message) => {
            traced_platform_problem(SdkWorkResultCode::PreconditionRequired, message, trace_id)
        }
        ProjectError::PreconditionFailed(message) => {
            traced_platform_problem(SdkWorkResultCode::PreconditionFailed, message, trace_id)
        }
        ProjectError::Conflict(message) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, message, trace_id)
        }
        ProjectError::Unavailable(message) => {
            traced_platform_problem(SdkWorkResultCode::ServiceUnavailable, message, trace_id)
        }
        ProjectError::GitOperation(message) => {
            traced_legacy_problem("git_operation", message, trace_id)
        }
        ProjectError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        ProjectError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}

pub fn map_validation_error(
    message: impl Into<String>,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::ValidationError, message, trace_id)
}

pub fn map_precondition_required(
    message: impl Into<String>,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::PreconditionRequired, message, trace_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn precondition_failures_use_http_412() {
        let (status, _, _) = map_project_error(
            ProjectError::PreconditionFailed("stale version".to_owned()),
            Some("trace-1"),
        );
        assert_eq!(status, StatusCode::PRECONDITION_FAILED);
    }

    #[test]
    fn unavailable_execution_does_not_become_an_internal_error() {
        let (status, _, _) = map_project_error(
            ProjectError::Unavailable("execution target unavailable".to_owned()),
            Some("trace-1"),
        );
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    }
}
