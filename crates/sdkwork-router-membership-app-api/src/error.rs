use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use sdkwork_birdcoder_membership_service::error::CommerceMembershipError;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetails {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

pub fn map_service_error(error: CommerceMembershipError) -> (StatusCode, Json<ProblemDetails>) {
    match error {
        CommerceMembershipError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(ProblemDetails {
                code: "not_found".into(),
                message: msg,
                retryable: false,
            }),
        ),
        CommerceMembershipError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(ProblemDetails {
                code: "invalid_input".into(),
                message: msg,
                retryable: false,
            }),
        ),
        CommerceMembershipError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(ProblemDetails {
                code: "conflict".into(),
                message: msg,
                retryable: false,
            }),
        ),
        CommerceMembershipError::Provider(msg) => (
            StatusCode::BAD_GATEWAY,
            Json(ProblemDetails {
                code: "provider".into(),
                message: msg,
                retryable: true,
            }),
        ),
        CommerceMembershipError::Repository(msg) | CommerceMembershipError::Internal(msg) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ProblemDetails {
                code: "internal".into(),
                message: msg,
                retryable: true,
            }),
        ),
    }
}

