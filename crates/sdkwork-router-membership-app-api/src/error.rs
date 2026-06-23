use axum::http::StatusCode;
use axum::Json;
use sdkwork_birdcoder_membership_service::error::MembershipError;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_internal_problem, client_safe_provider_problem,
};

pub use sdkwork_birdcoder_errors::ProblemDetailsPayload;

fn with_trace_id(
    payload: ProblemDetailsPayload,
    trace_id: Option<&str>,
) -> ProblemDetailsPayload {
    payload.with_trace_id(trace_id)
}

pub fn forbidden(
    message: impl Into<String>,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    (
        StatusCode::FORBIDDEN,
        Json(with_trace_id(
            ProblemDetailsPayload::new("forbidden", message, false),
            trace_id,
        )),
    )
}

pub fn map_service_error(
    error: MembershipError,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        MembershipError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_found", msg, false),
                trace_id,
            )),
        ),
        MembershipError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(with_trace_id(
                ProblemDetailsPayload::new("invalid_input", msg, false),
                trace_id,
            )),
        ),
        MembershipError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(with_trace_id(
                ProblemDetailsPayload::new("conflict", msg, false),
                trace_id,
            )),
        ),
        MembershipError::Provider(_) => (
            StatusCode::BAD_GATEWAY,
            Json(with_trace_id(client_safe_provider_problem(), trace_id)),
        ),
        MembershipError::Repository(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_data_access_problem(), trace_id)),
        ),
        MembershipError::Internal(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_internal_problem(), trace_id)),
        ),
    }
}
