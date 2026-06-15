use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use sdkwork_birdcoder_document_service::error::DocumentError;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetails {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

pub fn map_service_error(error: DocumentError) -> (StatusCode, Json<ProblemDetails>) {
    match error {
        DocumentError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetails {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        DocumentError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetails {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        DocumentError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetails {
                code: "conflict".into(),
                message: msg,
                retryable: false,
            }),
        ),
        DocumentError::Repository(msg) | DocumentError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetails {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}

