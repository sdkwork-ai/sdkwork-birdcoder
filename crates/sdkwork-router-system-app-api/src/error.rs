use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use sdkwork_birdcoder_system_descriptor_service::error::SystemDescriptorError;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetailsPayload {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

pub fn map_system_error(error: SystemDescriptorError) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        SystemDescriptorError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetailsPayload {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        SystemDescriptorError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetailsPayload {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        SystemDescriptorError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetailsPayload {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}
