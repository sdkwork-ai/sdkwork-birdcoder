use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use sdkwork_birdcoder_errors::{traced_platform_problem, ProblemJsonBody};
use sdkwork_iam_context_service::IamAppContext;
use sdkwork_iam_web_adapter::iam_app_context_from_web_request;
use sdkwork_utils_rust::SdkWorkResultCode;

pub use sdkwork_web_core::WebRequestContext;

/// Authenticated IAM context resolved from `WebRequestContext` (preferred) or request extensions.
#[derive(Clone, Debug)]
pub struct RequiredIamContext(pub IamAppContext);

impl<S> FromRequestParts<S> for RequiredIamContext
where
    S: Send + Sync,
{
    type Rejection = ProblemJsonBody;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        if let Some(web) = parts.extensions.get::<WebRequestContext>() {
            if let Some(iam) = iam_app_context_from_web_request(web) {
                return Ok(RequiredIamContext(iam));
            }
        }

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
