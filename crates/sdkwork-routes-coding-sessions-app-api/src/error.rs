use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_commerce_quota::QuotaError;
use sdkwork_utils_rust::SdkWorkResultCode;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem, client_safe_provider_problem, legacy_problem,
    platform_problem, resolve_trace_id,
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

    pub fn bad_gateway(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            body: platform_problem(SdkWorkResultCode::BadGateway, message, None),
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
            QuotaError::Exceeded { metric_type } => Self::quota_exceeded(format!(
                "usage quota for {metric_type} has been exhausted"
            )),
            QuotaError::Internal => Self::internal("failed to check usage quota"),
            QuotaError::InvalidTenantId => Self::bad_request(
                "tenant_id must be numeric for commerce quota checks",
            ),
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
