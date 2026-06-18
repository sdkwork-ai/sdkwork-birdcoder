use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_deployment_service::context::DeploymentContext;
use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_iam_context_service::IamAppContext;

/// Authenticated IAM context extracted from request extensions (set by api-server middleware).
#[derive(Clone, Debug)]
pub struct RequiredIamContext(pub IamAppContext);

impl<S> FromRequestParts<S> for RequiredIamContext
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<IamAppContext>()
            .cloned()
            .map(RequiredIamContext)
            .ok_or((StatusCode::UNAUTHORIZED, "session required"))
    }
}

pub fn coding_session_context(iam: &IamAppContext) -> CodingSessionContext {
    CodingSessionContext {
        tenant_id: iam.tenant_id.clone(),
        user_id: iam.user_id.clone(),
        session_id: iam.session_id.clone(),
    }
}

pub fn workspace_context(iam: &IamAppContext) -> WorkspaceContext {
    WorkspaceContext {
        tenant_id: iam.tenant_id.clone(),
        user_id: iam.user_id.clone(),
    }
}

pub fn project_context(iam: &IamAppContext) -> ProjectContext {
    ProjectContext {
        tenant_id: iam.tenant_id.clone(),
        user_id: iam.user_id.clone(),
    }
}

pub fn deployment_context(iam: &IamAppContext) -> DeploymentContext {
    DeploymentContext {
        tenant_id: iam.tenant_id.clone(),
        user_id: iam.user_id.clone(),
    }
}
