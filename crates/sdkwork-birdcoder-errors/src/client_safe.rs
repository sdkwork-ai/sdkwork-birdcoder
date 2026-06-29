//! Client-safe internal error messages (`SECURITY_SPEC`).

use sdkwork_utils_rust::{SdkWorkProblemDetail, SdkWorkResultCode};

use crate::{platform_problem, resolve_trace_id};

pub const CLIENT_SAFE_DATA_ACCESS_MESSAGE: &str =
    "An internal error occurred while accessing data.";
pub const CLIENT_SAFE_EVENT_PUBLISH_MESSAGE: &str =
    "An internal error occurred while publishing events.";
pub const CLIENT_SAFE_INTERNAL_MESSAGE: &str = "An internal error occurred.";
pub const CLIENT_SAFE_PROVIDER_MESSAGE: &str =
    "The upstream provider returned an error. Please try again later.";

pub fn client_safe_internal_problem() -> SdkWorkProblemDetail {
    platform_problem(
        SdkWorkResultCode::InternalError,
        CLIENT_SAFE_INTERNAL_MESSAGE,
        None,
    )
}

pub fn client_safe_data_access_problem() -> SdkWorkProblemDetail {
    platform_problem(
        SdkWorkResultCode::InternalError,
        CLIENT_SAFE_DATA_ACCESS_MESSAGE,
        None,
    )
}

pub fn client_safe_event_publish_problem() -> SdkWorkProblemDetail {
    platform_problem(
        SdkWorkResultCode::InternalError,
        CLIENT_SAFE_EVENT_PUBLISH_MESSAGE,
        None,
    )
}

pub fn client_safe_provider_problem() -> SdkWorkProblemDetail {
    platform_problem(
        SdkWorkResultCode::BadGateway,
        CLIENT_SAFE_PROVIDER_MESSAGE,
        None,
    )
}

pub fn with_trace_id(
    mut problem: SdkWorkProblemDetail,
    trace_id: Option<&str>,
) -> SdkWorkProblemDetail {
    problem.trace_id = resolve_trace_id(trace_id.or(Some(problem.trace_id.as_str())));
    problem
}
