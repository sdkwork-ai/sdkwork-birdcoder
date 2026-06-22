use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

pub mod envelope;
pub use envelope::{
    build_data_envelope, build_list_envelope, build_offset_list_envelope, ApiDataEnvelope,
    ApiListEnvelope, ApiListMeta, ApiMeta, BIRDCODER_CODING_SERVER_API_VERSION,
};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetailsPayload {
    pub code: String,
    pub message: String,
    pub retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<String>,
}

impl ProblemDetailsPayload {
    pub fn new(code: impl Into<String>, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            retryable,
            trace_id: None,
        }
    }

    pub fn with_trace_id(mut self, trace_id: Option<&str>) -> Self {
        self.trace_id = trace_id
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned);
        self
    }
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

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(self.body)).into_response()
    }
}

pub trait TraceAppResult<T, E> {
    fn trace_app_error(self, trace_id: Option<&str>) -> Result<T, AppError>;
}

impl<T, E> TraceAppResult<T, E> for Result<T, E>
where
    E: Into<AppError>,
{
    fn trace_app_error(self, trace_id: Option<&str>) -> Result<T, AppError> {
        self.map_err(|error| error.into().with_trace_id(trace_id))
    }
}

pub fn trace_id_from_request_id(request_id: &str) -> Option<&str> {
    let trimmed = request_id.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn problem_payload_omits_empty_trace_id() {
        let payload = ProblemDetailsPayload::new("internal", "failed", true).with_trace_id(None);
        let json = serde_json::to_value(payload).expect("serialize payload");
        assert!(json.get("traceId").is_none());
    }

    #[test]
    fn problem_payload_includes_trace_id_when_present() {
        let payload =
            ProblemDetailsPayload::new("internal", "failed", true).with_trace_id(Some("req-123"));
        let json = serde_json::to_value(payload).expect("serialize payload");
        assert_eq!(json.get("traceId").and_then(|value| value.as_str()), Some("req-123"));
    }
}
