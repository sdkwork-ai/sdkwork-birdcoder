use axum::http::StatusCode;
use axum::Json;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_event_publish_problem,
    client_safe_internal_problem,
};

pub use sdkwork_birdcoder_errors::ProblemDetailsPayload;

fn with_trace_id(
    payload: ProblemDetailsPayload,
    trace_id: Option<&str>,
) -> ProblemDetailsPayload {
    payload.with_trace_id(trace_id)
}

pub fn map_service_error(
    error: DeploymentError,
    trace_id: Option<&str>,
) -> (StatusCode, Json<ProblemDetailsPayload>) {
    match error {
        DeploymentError::NotFound(msg) => (
            StatusCode::NOT_FOUND,
            Json(with_trace_id(
                ProblemDetailsPayload::new("not_found", msg, false),
                trace_id,
            )),
        ),
        DeploymentError::Forbidden(msg) => (
            StatusCode::FORBIDDEN,
            Json(with_trace_id(
                ProblemDetailsPayload::new("forbidden", msg, false),
                trace_id,
            )),
        ),
        DeploymentError::InvalidInput(msg) => (
            StatusCode::BAD_REQUEST,
            Json(with_trace_id(
                ProblemDetailsPayload::new("invalid_input", msg, false),
                trace_id,
            )),
        ),
        DeploymentError::Conflict(msg) => (
            StatusCode::CONFLICT,
            Json(with_trace_id(
                ProblemDetailsPayload::new("conflict", msg, false),
                trace_id,
            )),
        ),
        DeploymentError::Repository(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_data_access_problem(), trace_id)),
        ),
        DeploymentError::EventPublish(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_event_publish_problem(), trace_id)),
        ),
        DeploymentError::Internal(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(with_trace_id(client_safe_internal_problem(), trace_id)),
        ),
    }
}
