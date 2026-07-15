use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_commerce_quota::QuotaError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem, client_safe_provider_problem, legacy_problem, platform_problem,
    resolve_trace_id,
};

pub use sdkwork_birdcoder_errors::ProblemDetailsPayload;

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub body: ProblemDetailsPayload,
}

#[derive(Debug)]
pub struct CodingSessionsRouteError(Box<AppError>);

impl From<AppError> for CodingSessionsRouteError {
    fn from(error: AppError) -> Self {
        Self(Box::new(error))
    }
}

impl IntoResponse for CodingSessionsRouteError {
    fn into_response(self) -> Response {
        self.0.into_response()
    }
}

impl AppError {
    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            body: platform_problem(SdkWorkResultCode::NotFound, message, None),
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            body: platform_problem(SdkWorkResultCode::ValidationError, message, None),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            body: platform_problem(SdkWorkResultCode::InternalError, message, None),
        }
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::CONFLICT,
            body: platform_problem(SdkWorkResultCode::Conflict, message, None),
        }
    }

    pub fn rate_limited(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::TOO_MANY_REQUESTS,
            body: platform_problem(SdkWorkResultCode::RateLimitExceeded, message, None),
        }
    }

    pub fn bad_gateway(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            body: platform_problem(SdkWorkResultCode::BadGateway, message, None),
        }
    }

    pub fn service_unavailable() -> Self {
        Self {
            status: StatusCode::SERVICE_UNAVAILABLE,
            body: platform_problem(
                SdkWorkResultCode::ServiceUnavailable,
                SdkWorkResultCode::ServiceUnavailable.title(),
                None,
            ),
        }
    }

    pub fn quota_exceeded(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::PAYMENT_REQUIRED,
            body: legacy_problem("quota_exceeded", message, None),
        }
    }

    pub fn from_quota_error(error: QuotaError) -> Self {
        match error {
            QuotaError::Exceeded { metric_type } => {
                Self::quota_exceeded(format!("usage quota for {metric_type} has been exhausted"))
            }
            QuotaError::Internal => Self::internal("failed to check usage quota"),
            QuotaError::InvalidTenantId => {
                Self::bad_request("tenant_id must be numeric for commerce quota checks")
            }
        }
    }

    pub fn with_trace_id(mut self, trace_id: Option<&str>) -> Self {
        self.body.trace_id = resolve_trace_id(trace_id);
        self
    }
}

impl From<CodingSessionError> for AppError {
    fn from(err: CodingSessionError) -> Self {
        match err {
            CodingSessionError::NotFound(msg) => Self::not_found(msg),
            CodingSessionError::InvalidInput(msg) => Self::bad_request(msg),
            CodingSessionError::Conflict(msg) => Self::conflict(msg),
            CodingSessionError::RateLimited(msg) => Self::rate_limited(msg),
            CodingSessionError::Unavailable(_) => Self::service_unavailable(),
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
) -> Result<T, CodingSessionsRouteError> {
    result.map_err(|error| AppError::from(error).with_trace_id(trace_id).into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trace_service_error_keeps_handler_result_errors_small() {
        let error = trace_service_error::<()>(
            Err(CodingSessionError::Internal("expected test error".into())),
            Some("0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab"),
        )
        .expect_err("the supplied service error must be mapped");

        assert!(
            std::mem::size_of_val(&error) <= 64,
            "handler Result errors must not move a full Problem Details payload on the stack"
        );
    }

    #[tokio::test]
    async fn rate_limited_coding_session_error_maps_to_overload_problem_without_unproven_retry_after(
    ) {
        let error = AppError::from(CodingSessionError::RateLimited(
            "code-engine turn admission is saturated".into(),
        ))
        .with_trace_id(Some("0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab"));

        assert_eq!(error.status, StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(error.body.code, 42901);
        assert_eq!(error.body.trace_id, "0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab");

        let response = error.into_response();
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok()),
            Some("application/problem+json")
        );
        assert_eq!(
            response
                .headers()
                .get(header::RETRY_AFTER)
                .and_then(|value| value.to_str().ok()),
            None
        );

        let body = axum::body::to_bytes(response.into_body(), 16 * 1024)
            .await
            .expect("the bounded Problem Details body must be readable");
        let body: serde_json::Value =
            serde_json::from_slice(&body).expect("the Problem Details body must be JSON");
        assert_eq!(body["code"], 42901);
        assert_eq!(body["traceId"], "0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab");
    }

    #[tokio::test]
    async fn unavailable_coding_session_error_maps_to_a_client_safe_service_unavailable_problem() {
        let internal_detail =
            "remote code execution is unavailable until a strongly isolated runner is configured";
        let expected_detail = ProblemDetailsPayload::client_safe_detail(
            SdkWorkResultCode::ServiceUnavailable,
            internal_detail,
        );
        let error = AppError::from(CodingSessionError::Unavailable(internal_detail.into()))
            .with_trace_id(Some("0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab"));

        assert_eq!(error.status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(
            error.body.code,
            SdkWorkResultCode::ServiceUnavailable.as_i32()
        );
        assert_eq!(error.body.detail.as_deref(), Some(expected_detail.as_str()));
        assert_eq!(error.body.trace_id, "0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab");

        let response = error.into_response();
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok()),
            Some("application/problem+json")
        );

        let body = axum::body::to_bytes(response.into_body(), 16 * 1024)
            .await
            .expect("the bounded Problem Details body must be readable");
        let body: serde_json::Value =
            serde_json::from_slice(&body).expect("the Problem Details body must be JSON");
        assert_eq!(body["code"], SdkWorkResultCode::ServiceUnavailable.as_i32());
        assert_eq!(body["detail"], expected_detail);
        assert_eq!(body["traceId"], "0195f2a0-7c44-7b2e-9f3a-2a6f5d8e91ab");
    }
}
