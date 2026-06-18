use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use sdkwork_birdcoder_membership_service::error::MembershipError;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetailsPayload {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

pub fn map_service_error(error: MembershipError) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        MembershipError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetailsPayload {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        MembershipError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetailsPayload {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        MembershipError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetailsPayload {
                code: "conflict".into(),
                message: msg,
                retryable: false,
            }),
        ),
        MembershipError::Provider(msg) => (
            StatusCode::BAD_GATEWAY,
            Json(ProblemDetailsPayload {
                code: "provider".into(),
                message: msg,
                retryable: true,
            }),
        ),
        MembershipError::Repository(msg) | MembershipError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetailsPayload {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}
