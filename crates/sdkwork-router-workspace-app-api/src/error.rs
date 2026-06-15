use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetails {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

pub fn map_workspace_error(error: WorkspaceError) -> (StatusCode, Json<ProblemDetails>) {
    match error {
        WorkspaceError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetails {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        WorkspaceError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetails {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        WorkspaceError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetails {
                code: "conflict".into(),
                message: msg,
                retryable: false,
            }),
        ),
        WorkspaceError::Repository(msg)
        | WorkspaceError::EventPublish(msg)
        | WorkspaceError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetails {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}

pub fn map_project_error(error: ProjectError) -> (StatusCode, Json<ProblemDetails>) {
    match error {
        ProjectError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetails {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        ProjectError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetails {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        ProjectError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetails {
                code: "conflict".into(),
                message: msg,
                retryable: false,
            }),
        ),
        ProjectError::GitOperation(msg) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ProblemDetails {
                code: "git_operation".into(),
                message: msg,
                retryable: false,
            }),
        ),
        ProjectError::Repository(msg)
        | ProjectError::EventPublish(msg)
        | ProjectError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetails {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}

pub fn map_deployment_error(error: DeploymentError) -> (StatusCode, Json<ProblemDetails>) {
    match error {
        DeploymentError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetails {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        DeploymentError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetails {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        DeploymentError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetails {
                code: "conflict".into(),
                message: msg,
                retryable: false,
            }),
        ),
        DeploymentError::Repository(msg)
        | DeploymentError::EventPublish(msg)
        | DeploymentError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetails {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}

