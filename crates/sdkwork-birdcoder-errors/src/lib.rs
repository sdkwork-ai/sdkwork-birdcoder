use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use sdkwork_utils_rust::{
    legacy_wire_result_code, uuid, SdkWorkProblemDetail, SdkWorkResultCode,
};

pub mod envelope;
pub mod tenant_scope;
pub mod client_safe;
pub use tenant_scope::{require_scoped_tenant_id, require_scoped_user_id, TenantScopeViolation};
pub use client_safe::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem, client_safe_provider_problem, CLIENT_SAFE_DATA_ACCESS_MESSAGE,
    CLIENT_SAFE_EVENT_PUBLISH_MESSAGE, CLIENT_SAFE_INTERNAL_MESSAGE, CLIENT_SAFE_PROVIDER_MESSAGE,
};
pub use envelope::{
    build_data_envelope, build_list_envelope, build_offset_list_envelope, ApiDataEnvelope,
    ApiListEnvelope, ApiListMeta, ApiMeta, BIRDCODER_CODING_SERVER_API_VERSION,
};
pub use sdkwork_utils_rust::SdkWorkProblemDetail as ProblemDetailsPayload;

pub fn resolve_trace_id(trace_id: Option<&str>) -> String {
    trace_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(uuid)
}

pub fn platform_problem(
    result_code: SdkWorkResultCode,
    detail: impl Into<String>,
    trace_id: Option<&str>,
) -> SdkWorkProblemDetail {
    SdkWorkProblemDetail::platform(result_code, detail, resolve_trace_id(trace_id))
}

pub fn legacy_problem(
    wire_code: &str,
    detail: impl Into<String>,
    trace_id: Option<&str>,
) -> SdkWorkProblemDetail {
    platform_problem(legacy_wire_result_code(wire_code), detail, trace_id)
}

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub body: SdkWorkProblemDetail,
}

impl AppError {
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::platform(SdkWorkResultCode::NotFound, message)
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::platform(SdkWorkResultCode::ValidationError, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::platform(SdkWorkResultCode::InternalError, message)
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::platform(SdkWorkResultCode::Conflict, message)
    }

    pub fn bad_gateway(message: impl Into<String>) -> Self {
        Self::platform(SdkWorkResultCode::BadGateway, message)
    }

    pub fn platform(result_code: SdkWorkResultCode, message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::from_u16(result_code.http_status_code())
                .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            body: SdkWorkProblemDetail::platform(result_code, message, uuid()),
        }
    }

    pub fn with_trace_id(mut self, trace_id: Option<&str>) -> Self {
        self.body.trace_id = resolve_trace_id(trace_id);
        self
    }
}

pub type ProblemJsonBody = (
    StatusCode,
    [(axum::http::header::HeaderName, HeaderValue); 1],
    Json<SdkWorkProblemDetail>,
);

pub fn problem_json(status: StatusCode, body: SdkWorkProblemDetail) -> ProblemJsonBody {
    (
        status,
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/problem+json"),
        )],
        Json(body),
    )
}

pub fn traced_platform_problem(
    result_code: SdkWorkResultCode,
    detail: impl Into<String>,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    problem_json(
        StatusCode::from_u16(result_code.http_status_code())
            .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
        platform_problem(result_code, detail, trace_id),
    )
}

pub fn traced_legacy_problem(
    wire_code: &str,
    detail: impl Into<String>,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    traced_platform_problem(legacy_wire_result_code(wire_code), detail, trace_id)
}

pub fn traced_problem_json(
    status: StatusCode,
    body: SdkWorkProblemDetail,
    trace_id: Option<&str>,
) -> ProblemJsonBody {
    problem_json(
        status,
        SdkWorkProblemDetail {
            trace_id: resolve_trace_id(trace_id.or(Some(body.trace_id.as_str()))),
            ..body
        },
    )
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
    fn platform_problem_requires_trace_id() {
        let payload = platform_problem(SdkWorkResultCode::InternalError, "failed", Some("req-123"));
        let json = serde_json::to_value(payload).expect("serialize payload");
        assert_eq!(json["code"], 50001);
        assert_eq!(json.get("traceId").and_then(|value| value.as_str()), Some("req-123"));
    }

    #[test]
    fn platform_problem_generates_trace_id_when_missing() {
        let payload = platform_problem(SdkWorkResultCode::InternalError, "failed", None);
        assert!(!payload.trace_id.is_empty());
    }

    #[test]
    fn client_safe_messages_use_platform_codes() {
        assert_eq!(
            client_safe_data_access_problem().code,
            SdkWorkResultCode::InternalError.as_i32()
        );
        assert_eq!(
            client_safe_provider_problem().code,
            SdkWorkResultCode::BadGateway.as_i32()
        );
    }
}
