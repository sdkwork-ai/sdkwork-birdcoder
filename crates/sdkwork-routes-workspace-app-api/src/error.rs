use axum::http::StatusCode;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem, platform_problem, traced_legacy_problem, traced_platform_problem,
    traced_problem_json,
};

pub use sdkwork_birdcoder_errors::ProblemJsonBody;

const PROJECT_DEPLOYMENT_UNAVAILABLE_DETAIL: &str =
    "Project deployment execution is currently unavailable.";

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

pub fn map_project_error(error: ProjectError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        ProjectError::NotFound(msg) => {
            traced_platform_problem(SdkWorkResultCode::NotFound, msg, trace_id)
        }
        ProjectError::Forbidden(msg) => {
            traced_platform_problem(SdkWorkResultCode::PermissionRequired, msg, trace_id)
        }
        ProjectError::InvalidInput(msg) => {
            traced_platform_problem(SdkWorkResultCode::ValidationError, msg, trace_id)
        }
        ProjectError::PreconditionRequired(msg) => {
            traced_platform_problem(SdkWorkResultCode::PreconditionRequired, msg, trace_id)
        }
        ProjectError::PreconditionFailed(msg) => {
            traced_platform_problem(SdkWorkResultCode::PreconditionFailed, msg, trace_id)
        }
        ProjectError::Conflict(msg) => {
            traced_platform_problem(SdkWorkResultCode::Conflict, msg, trace_id)
        }
        ProjectError::Unavailable(msg) => {
            traced_platform_problem(SdkWorkResultCode::ServiceUnavailable, msg, trace_id)
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
            PROJECT_DEPLOYMENT_UNAVAILABLE_DETAIL,
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

pub fn map_not_implemented(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_legacy_problem("not_implemented", message, trace_id)
}

pub fn map_validation_error(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::ValidationError, message, trace_id)
}

pub fn map_not_found(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::NotFound, message, trace_id)
}

pub fn map_precondition_required(
    message: impl Into<String>,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::PreconditionRequired, message, trace_id)
}

pub fn map_unavailable(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_platform_problem(SdkWorkResultCode::ServiceUnavailable, message, trace_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unavailable_project_workspace_maps_to_service_unavailable() {
        let (status, _, axum::Json(problem)) = map_project_error(
            ProjectError::Unavailable("Server project workspace is unavailable.".to_owned()),
            Some("0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab"),
        );

        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(problem.code, SdkWorkResultCode::ServiceUnavailable.as_i32());
        assert_eq!(problem.trace_id, "0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab");
    }

    #[test]
    fn unavailable_project_deployment_maps_to_a_client_safe_service_unavailable_problem() {
        let (status, _, axum::Json(problem)) = map_deployment_error(
            DeploymentError::Unavailable(
                "internal deployment executor state must not be exposed to clients".to_owned(),
            ),
            Some("0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab"),
        );

        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(problem.code, SdkWorkResultCode::ServiceUnavailable.as_i32());
        assert_eq!(
            problem.detail.as_deref(),
            Some("A required dependency is temporarily unavailable")
        );
        assert_eq!(problem.trace_id, "0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab");
    }
}
