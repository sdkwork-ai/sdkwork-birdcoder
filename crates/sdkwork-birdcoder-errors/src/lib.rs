use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use sdkwork_utils_rust::{is_blank, uuid, SdkWorkProblemDetail, SdkWorkResultCode};

pub mod client_safe;
pub mod envelope;
pub use client_safe::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem, client_safe_provider_problem, CLIENT_SAFE_DATA_ACCESS_MESSAGE,
    CLIENT_SAFE_EVENT_PUBLISH_MESSAGE, CLIENT_SAFE_INTERNAL_MESSAGE, CLIENT_SAFE_PROVIDER_MESSAGE,
};
pub use envelope::{
    build_data_envelope, build_list_envelope, build_offset_list_envelope,
    build_unbounded_list_envelope, ApiDataEnvelope, ApiListEnvelope,
};
pub use sdkwork_utils_rust::SdkWorkProblemDetail as ProblemDetailsPayload;

pub fn resolve_trace_id(trace_id: Option<&str>) -> String {
    match trace_id {
        Some(value) if !is_blank(Some(value)) => value.trim().to_owned(),
        _ => uuid(),
    }
}

pub fn platform_problem(
    result_code: SdkWorkResultCode,
    detail: impl Into<String>,
    trace_id: Option<&str>,
) -> SdkWorkProblemDetail {
    SdkWorkProblemDetail::platform(result_code, detail, resolve_trace_id(trace_id))
}

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub body: Box<SdkWorkProblemDetail>,
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
            body: Box::new(SdkWorkProblemDetail::platform(result_code, message, uuid())),
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
    Json<Box<SdkWorkProblemDetail>>,
);

pub fn problem_json(status: StatusCode, body: SdkWorkProblemDetail) -> ProblemJsonBody {
    (
        status,
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/problem+json"),
        )],
        Json(Box::new(body)),
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

pub fn checked_list_total_items(
    total: i64,
    trace_id: Option<&str>,
) -> Result<usize, ProblemJsonBody> {
    usize::try_from(total).map_err(|_| {
        traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        )
    })
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
    if is_blank(Some(request_id)) {
        None
    } else {
        Some(request_id.trim())
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
        assert_eq!(
            json.get("traceId").and_then(|value| value.as_str()),
            Some("req-123")
        );
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

    #[test]
    fn checked_list_total_items_rejects_negative_repository_totals() {
        let (status, _, Json(problem)) =
            checked_list_total_items(-1, Some("trace-invalid-list-total"))
                .expect_err("negative repository total must fail closed");

        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(problem.code, SdkWorkResultCode::InternalError.as_i32());
        assert_eq!(problem.trace_id, "trace-invalid-list-total");
    }
}
