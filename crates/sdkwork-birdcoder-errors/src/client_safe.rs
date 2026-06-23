//! Client-safe internal error messages (`SECURITY_SPEC`).

use crate::ProblemDetailsPayload;

pub const CLIENT_SAFE_DATA_ACCESS_MESSAGE: &str =
    "An internal error occurred while accessing data.";
pub const CLIENT_SAFE_EVENT_PUBLISH_MESSAGE: &str =
    "An internal error occurred while publishing events.";
pub const CLIENT_SAFE_INTERNAL_MESSAGE: &str = "An internal error occurred.";
pub const CLIENT_SAFE_PROVIDER_MESSAGE: &str =
    "The upstream provider returned an error. Please try again later.";

pub fn client_safe_internal_problem() -> ProblemDetailsPayload {
    ProblemDetailsPayload::new("internal", CLIENT_SAFE_INTERNAL_MESSAGE, true)
}

pub fn client_safe_data_access_problem() -> ProblemDetailsPayload {
    ProblemDetailsPayload::new("internal", CLIENT_SAFE_DATA_ACCESS_MESSAGE, true)
}

pub fn client_safe_event_publish_problem() -> ProblemDetailsPayload {
    ProblemDetailsPayload::new("internal", CLIENT_SAFE_EVENT_PUBLISH_MESSAGE, true)
}

pub fn client_safe_provider_problem() -> ProblemDetailsPayload {
    ProblemDetailsPayload::new("provider_error", CLIENT_SAFE_PROVIDER_MESSAGE, true)
}
