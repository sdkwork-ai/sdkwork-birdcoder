use axum::http::StatusCode;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem, traced_problem_json,
};

pub use sdkwork_birdcoder_errors::{ProblemDetailsPayload, ProblemJsonBody};

pub fn map_service_error(error: DeploymentError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        DeploymentError::NotFound(msg) => traced_problem_json(
            StatusCode::NOT_FOUND,
            ProblemDetailsPayload::new("not_found", msg, false),
            trace_id,
        ),
        DeploymentError::Forbidden(msg) => traced_problem_json(
            StatusCode::FORBIDDEN,
            ProblemDetailsPayload::new("forbidden", msg, false),
            trace_id,
        ),
        DeploymentError::InvalidInput(msg) => traced_problem_json(
            StatusCode::BAD_REQUEST,
            ProblemDetailsPayload::new("invalid_input", msg, false),
            trace_id,
        ),
        DeploymentError::Conflict(msg) => traced_problem_json(
            StatusCode::CONFLICT,
            ProblemDetailsPayload::new("conflict", msg, false),
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

pub fn map_workspace_error(error: WorkspaceError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        WorkspaceError::NotFound(msg) => traced_problem_json(
            StatusCode::NOT_FOUND,
            ProblemDetailsPayload::new("not_found", msg, false),
            trace_id,
        ),
        WorkspaceError::Forbidden(msg) => traced_problem_json(
            StatusCode::FORBIDDEN,
            ProblemDetailsPayload::new("forbidden", msg, false),
            trace_id,
        ),
        WorkspaceError::InvalidInput(msg) => traced_problem_json(
            StatusCode::BAD_REQUEST,
            ProblemDetailsPayload::new("invalid_input", msg, false),
            trace_id,
        ),
        WorkspaceError::Conflict(msg) => traced_problem_json(
            StatusCode::CONFLICT,
            ProblemDetailsPayload::new("conflict", msg, false),
            trace_id,
        ),
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
