use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem, client_safe_provider_problem,
};

pub use sdkwork_birdcoder_errors::ProblemDetailsPayload;

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
            CodingSessionError::Repository(_) => Self {
                status: StatusCode::INTERNAL_SERVER_ERROR,
                body: client_safe_data_access_problem(),
            },
            CodingSessionError::Provider(_) => Self {
                status: StatusCode::BAD_GATEWAY,
                body: client_safe_provider_problem(),
            },
            CodingSessionError::EventPublish(_) => Self {
                status: StatusCode::INTERNAL_SERVER_ERROR,
                body: client_safe_event_publish_problem(),
            },
            CodingSessionError::Internal(_) => Self {
                status: StatusCode::INTERNAL_SERVER_ERROR,
                body: client_safe_internal_problem(),
            },
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let mut response = (self.status, Json(self.body)).into_response();
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/problem+json"),
        );
        response
    }
}

pub fn trace_service_error<T>(
    result: Result<T, CodingSessionError>,
    trace_id: Option<&str>,
) -> Result<T, AppError> {
    result.map_err(|error| AppError::from(error).with_trace_id(trace_id))
}
