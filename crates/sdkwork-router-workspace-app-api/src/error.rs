use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetailsPayload {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

pub fn map_workspace_error(error: WorkspaceError) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        WorkspaceError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetailsPayload {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        WorkspaceError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetailsPayload {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        WorkspaceError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetailsPayload {
                code: "conflict".into(),
                message: msg,
                retryable: false,
            }),
        ),
        WorkspaceError::Repository(msg)
        | WorkspaceError::EventPublish(msg)
        | WorkspaceError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetailsPayload {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}

pub fn map_project_error(error: ProjectError) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        ProjectError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetailsPayload {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        ProjectError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetailsPayload {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        ProjectError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetailsPayload {
                code: "conflict".into(),
                message: msg,
                retryable: false,
            }),
        ),
        ProjectError::GitOperation(msg) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(ProblemDetailsPayload {
                code: "git_operation".into(),
                message: msg,
                retryable: false,
            }),
        ),
        ProjectError::Repository(msg)
        | ProjectError::EventPublish(msg)
        | ProjectError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetailsPayload {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}

pub fn map_deployment_error(error: DeploymentError) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        DeploymentError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetailsPayload {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        DeploymentError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetailsPayload {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        DeploymentError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetailsPayload {
                code: "conflict".into(),
                message: msg,
                retryable: false,
            }),
        ),
        DeploymentError::Repository(msg)
        | DeploymentError::EventPublish(msg)
        | DeploymentError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetailsPayload {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}

pub fn map_not_implemented(message: impl Into<String>) -> (StatusCode, Json<ProblemDetailsPayload>) {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(ProblemDetailsPayload {
            code: "not_implemented".into(),
            message: message.into(),
            retryable: false,
        }),
    )
}

pub fn map_validation_error(message: impl Into<String>) -> (StatusCode, Json<ProblemDetailsPayload>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ProblemDetailsPayload {
            code: "invalid_input".into(),
            message: message.into(),
            retryable: false,
        }),
    )
}

pub fn map_not_found(message: impl Into<String>) -> (StatusCode, Json<ProblemDetailsPayload>) {
    (
        StatusCode::NOT_FOUND,
        Json(ProblemDetailsPayload {
            code: "not_found".into(),
            message: message.into(),
            retryable: false,
        }),
    )
}
