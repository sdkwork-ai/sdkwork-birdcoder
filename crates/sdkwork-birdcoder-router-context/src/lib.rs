use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use sdkwork_birdcoder_errors::{traced_platform_problem, ProblemJsonBody};
use sdkwork_utils_rust::SdkWorkResultCode;

pub use sdkwork_iam_context_service::IamAppContext;
pub use sdkwork_web_core::WebRequestContext;

/// Authenticated IAM context injected by the composed IAM assembly.
#[derive(Clone, Debug)]
pub struct RequiredIamContext(pub IamAppContext);

impl<S> FromRequestParts<S> for RequiredIamContext
where
    S: Send + Sync,
{
    type Rejection = ProblemJsonBody;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<IamAppContext>()
            .cloned()
            .map(RequiredIamContext)
            .ok_or(traced_platform_problem(
                SdkWorkResultCode::AuthenticationRequired,
                "Authentication is required.",
                None,
            ))
    }
}
