use axum::http::StatusCode;
use axum::Json;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem,
};

pub use sdkwork_birdcoder_errors::ProblemDetailsPayload;

fn with_trace_id(
    payload: ProblemDetailsPayload,
    trace_id: Option<&str>,
) -> ProblemDetailsPayload {
    payload.with_trace_id(trace_id)
}

pub fn forbidden(
    message: impl Into<String>,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    (
        StatusCode::FORBIDDEN,
        Json(with_trace_id(
            ProblemDetailsPayload::new("forbidden", message, false),
            trace_id,
        )),
    )
}

pub fn map_rate_limited(
    message: impl Into<String>,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    (
        StatusCode::TOO_MANY_REQUESTS,
        Json(with_trace_id(
            ProblemDetailsPayload::new("rate_limited", message, true),
            trace_id,
        )),
    )
}

pub fn map_workspace_error(
    error: WorkspaceError,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        WorkspaceError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_found", msg, false),
                trace_id,
            )),
        ),
        WorkspaceError::Forbidden(msg) => (
            StatusCode::FORBIDDEN,
            Json(with_trace_id(
                ProblemDetailsPayload::new("forbidden", msg, false),
                trace_id,
            )),
        ),
        WorkspaceError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(with_trace_id(
                ProblemDetailsPayload::new("invalid_input", msg, false),
                trace_id,
            )),
        ),
        WorkspaceError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(with_trace_id(
                ProblemDetailsPayload::new("conflict", msg, false),
                trace_id,
            )),
        ),
        WorkspaceError::Repository(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_data_access_problem(), trace_id)),
        ),
        WorkspaceError::EventPublish(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_event_publish_problem(), trace_id)),
        ),
        WorkspaceError::Internal(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_internal_problem(), trace_id)),
        ),
    }
}

pub fn map_project_error(
    error: ProjectError,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        ProjectError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_found", msg, false),
                trace_id,
            )),
        ),
        ProjectError::Forbidden(msg) => (
            StatusCode::FORBIDDEN,
            Json(with_trace_id(
                ProblemDetailsPayload::new("forbidden", msg, false),
                trace_id,
            )),
        ),
        ProjectError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(with_trace_id(
                ProblemDetailsPayload::new("invalid_input", msg, false),
                trace_id,
            )),
        ),
        ProjectError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(with_trace_id(
                ProblemDetailsPayload::new("conflict", msg, false),
                trace_id,
            )),
        ),
        ProjectError::GitOperation(msg) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(with_trace_id(
                ProblemDetailsPayload::new("git_operation", msg, false),
                trace_id,
            )),
        ),
        ProjectError::Repository(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_data_access_problem(), trace_id)),
        ),
        ProjectError::EventPublish(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_event_publish_problem(), trace_id)),
        ),
        ProjectError::Internal(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_internal_problem(), trace_id)),
        ),
    }
}

pub fn map_deployment_error(
    error: DeploymentError,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        DeploymentError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_found", msg, false),
                trace_id,
            )),
        ),
        DeploymentError::Forbidden(msg) => (
            StatusCode::FORBIDDEN,
            Json(with_trace_id(
                ProblemDetailsPayload::new("forbidden", msg, false),
                trace_id,
            )),
        ),
        DeploymentError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(with_trace_id(
                ProblemDetailsPayload::new("invalid_input", msg, false),
                trace_id,
            )),
        ),
        DeploymentError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(with_trace_id(
                ProblemDetailsPayload::new("conflict", msg, false),
                trace_id,
            )),
        ),
        DeploymentError::Repository(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_data_access_problem(), trace_id)),
        ),
        DeploymentError::EventPublish(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_event_publish_problem(), trace_id)),
        ),
        DeploymentError::Internal(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_internal_problem(), trace_id)),
        ),
    }
}

pub fn map_not_implemented(
    message: impl Into<String>,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(with_trace_id(
            ProblemDetailsPayload::new("not_implemented", message, false),
            trace_id,
        )),
    )
}

pub fn map_validation_error(
    message: impl Into<String>,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    (
        StatusCode::BAD_REQUEST,
        Json(with_trace_id(
            ProblemDetailsPayload::new("invalid_input", message, false),
            trace_id,
        )),
    )
}

pub fn map_not_found(
    message: impl Into<String>,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    (
        StatusCode::NOT_FOUND,
        Json(with_trace_id(
            ProblemDetailsPayload::new("not_found", message, false),
            trace_id,
        )),
    )
}
