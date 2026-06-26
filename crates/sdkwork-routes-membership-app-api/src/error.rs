use axum::http::StatusCode;
use sdkwork_birdcoder_membership_service::error::MembershipError;

use sdkwork_birdcoder_errors::{
    client_safe_data_access_problem, client_safe_internal_problem, client_safe_provider_problem,
    traced_problem_json,
};

pub use sdkwork_birdcoder_errors::{ProblemDetailsPayload, ProblemJsonBody};

pub fn forbidden(message: impl Into<String>, trace_id: Option<&str>) -> ProblemJsonBody {
    traced_problem_json(
        StatusCode::FORBIDDEN,
        ProblemDetailsPayload::new("forbidden", message, false),
        trace_id,
    )
}

pub fn map_service_error(error: MembershipError, trace_id: Option<&str>) -> ProblemJsonBody {
    match error {
        MembershipError::NotFound(msg) => traced_problem_json(
            StatusCode::NOT_FOUND,
            ProblemDetailsPayload::new("not_found", msg, false),
            trace_id,
        ),
        MembershipError::InvalidInput(msg) => traced_problem_json(
            StatusCode::BAD_REQUEST,
            ProblemDetailsPayload::new("invalid_input", msg, false),
            trace_id,
        ),
        MembershipError::Conflict(msg) => traced_problem_json(
            StatusCode::CONFLICT,
            ProblemDetailsPayload::new("conflict", msg, false),
            trace_id,
        ),
        MembershipError::Provider(_) => traced_problem_json(
            StatusCode::BAD_GATEWAY,
            client_safe_provider_problem(),
            trace_id,
        ),
        MembershipError::Repository(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_data_access_problem(),
            trace_id,
        ),
        MembershipError::Internal(_) => traced_problem_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            client_safe_internal_problem(),
            trace_id,
        ),
    }
}
