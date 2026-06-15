use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetailsPayload {
    pub r#type: String,
    pub title: String,
    pub status: u16,
    pub detail: String,
}

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub body: ProblemDetailsPayload,
}

impl AppError {
    pub fn not_found(detail: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            body: ProblemDetailsPayload {
                r#type: "not_found".into(),
                title: "Not Found".into(),
                status: 404,
                detail: detail.into(),
            },
        }
    }

    pub fn bad_request(detail: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            body: ProblemDetailsPayload {
                r#type: "argument_invalid".into(),
                title: "Bad Request".into(),
                status: 400,
                detail: detail.into(),
            },
        }
    }

    pub fn internal(detail: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            body: ProblemDetailsPayload {
                r#type: "system_error".into(),
                title: "Internal Server Error".into(),
                status: 500,
                detail: detail.into(),
            },
        }
    }

    pub fn conflict(detail: impl Into<String>) -> Self {
        Self {
            status: StatusCode::CONFLICT,
            body: ProblemDetailsPayload {
                r#type: "conflict".into(),
                title: "Conflict".into(),
                status: 409,
                detail: detail.into(),
            },
        }
    }

    pub fn bad_gateway(detail: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            body: ProblemDetailsPayload {
                r#type: "provider_error".into(),
                title: "Bad Gateway".into(),
                status: 502,
                detail: detail.into(),
            },
        }
    }
}

impl From<CodingSessionError> for AppError {
    fn from(err: CodingSessionError) -> Self {
        match err {
            CodingSessionError::NotFound(msg) => Self::not_found(msg),
            CodingSessionError::InvalidInput(msg) => Self::bad_request(msg),
            CodingSessionError::Conflict(msg) => Self::conflict(msg),
            CodingSessionError::Repository(msg) => Self::internal(format!("Repository: {msg}")),
            CodingSessionError::Provider(msg) => Self::bad_gateway(msg),
            CodingSessionError::EventPublish(msg) => {
                Self::internal(format!("Event publish: {msg}"))
            }
            CodingSessionError::Internal(msg) => Self::internal(msg),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(self.body)).into_response()
    }
}

