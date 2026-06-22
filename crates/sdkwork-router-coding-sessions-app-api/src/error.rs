use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_errors::ProblemDetailsPayload;

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub body: ProblemDetailsPayload,
}

impl AppError {
    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            body: ProblemDetailsPayload::new("not_found", message, false),
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            body: ProblemDetailsPayload::new("invalid_input", message, false),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            body: ProblemDetailsPayload::new("internal", message, true),
        }
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::CONFLICT,
            body: ProblemDetailsPayload::new("conflict", message, false),
        }
    }

    pub fn bad_gateway(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            body: ProblemDetailsPayload::new("provider_error", message, true),
        }
    }

    pub fn with_trace_id(mut self, trace_id: Option<&str>) -> Self {
        self.body = self.body.with_trace_id(trace_id);
        self
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

pub fn trace_service_error<T>(
    result: Result<T, CodingSessionError>,
    trace_id: Option<&str>,
) -> Result<T, AppError> {
    result.map_err(|error| AppError::from(error).with_trace_id(trace_id))
}
