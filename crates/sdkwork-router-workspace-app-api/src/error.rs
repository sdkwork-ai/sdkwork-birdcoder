use axum::http::StatusCode;
use axum::Json;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;

pub use sdkwork_birdcoder_errors::ProblemDetailsPayload;

fn with_trace_id(
    payload: ProblemDetailsPayload,
    trace_id: Option<&str>,
) -> ProblemDetailsPayload {
    payload.with_trace_id(trace_id)
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
        WorkspaceError::Repository(msg)
        | WorkspaceError::EventPublish(msg)
        | WorkspaceError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(
                ProblemDetailsPayload::new("internal", msg, true),
                trace_id,
            )),
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
        ProjectError::Repository(msg)
        | ProjectError::EventPublish(msg)
        | ProjectError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(
                ProblemDetailsPayload::new("internal", msg, true),
                trace_id,
            )),
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
        DeploymentError::Repository(msg)
        | DeploymentError::EventPublish(msg)
        | DeploymentError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(
                ProblemDetailsPayload::new("internal", msg, true),
                trace_id,
            )),
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
