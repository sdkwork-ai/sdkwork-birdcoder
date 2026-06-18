use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetailsPayload {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub body: ProblemDetailsPayload,
}

impl AppError {
    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            body: ProblemDetailsPayload {
                code: "not_found".into(),
                message: message.into(),
                retryable: false,
            },
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            body: ProblemDetailsPayload {
                code: "invalid_input".into(),
                message: message.into(),
                retryable: false,
            },
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            body: ProblemDetailsPayload {
                code: "internal".into(),
                message: message.into(),
                retryable: true,
            },
        }
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::CONFLICT,
            body: ProblemDetailsPayload {
                code: "conflict".into(),
                message: message.into(),
                retryable: false,
            },
        }
    }

    pub fn bad_gateway(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            body: ProblemDetailsPayload {
                code: "provider_error".into(),
                message: message.into(),
                retryable: true,
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
