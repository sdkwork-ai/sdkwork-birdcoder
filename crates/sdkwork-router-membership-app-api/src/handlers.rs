use axum::extract::{Query, State};
use axum::Json;
use sqlx::AnyPool;

use sdkwork_birdcoder_membership_repository_sqlx::SqliteMembershipRepository;
use sdkwork_birdcoder_membership_service::domain::models::{
    CommerceMembershipCurrentPayload, CommerceMembershipPackageGroupPayload,
};
use sdkwork_birdcoder_membership_service::service::membership_service::MembershipService;
use sdkwork_birdcoder_errors::{
    build_data_envelope, build_list_envelope, trace_id_from_request_id, ApiDataEnvelope,
    ApiListEnvelope,
};
use sdkwork_utils_rust::is_blank;
use sdkwork_birdcoder_router_context::{RequiredIamContext, WebRequestContext};

use crate::error;
use crate::mapper::request::MembershipQuery;

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

#[derive(Clone)]
pub struct MembershipAppState {
    pub service: MembershipService<SqliteMembershipRepository>,
}

impl MembershipAppState {
    pub fn new(pool: AnyPool) -> Self {
        Self {
            service: MembershipService::new(SqliteMembershipRepository::new(pool)),
        }
    }
}

pub async fn get_current_membership(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<MembershipAppState>,
    Query(query): Query<MembershipQuery>,
) -> Result<
    Json<ApiDataEnvelope<CommerceMembershipCurrentPayload>>,
    (axum::http::StatusCode, Json<error::ProblemDetailsPayload>),
>
{
    let trace_id = request_trace_id(&web);
    if let Some(requested_owner_id) = query
        .owner_user_id
        .as_deref()
        .filter(|value| !is_blank(Some(*value)))
    {
        if requested_owner_id != iam.user_id {
            return Err(error::forbidden(
                "Membership lookup is limited to the authenticated user.",
                trace_id,
            ));
        }
    }

    let owner_user_id = iam.user_id.as_str();
    match state
        .service
        .get_current_membership(
            Some(iam.tenant_id.clone()),
            iam.organization_id.clone(),
            owner_user_id,
        )
        .await
    {
        Ok(membership) => Ok(Json(build_data_envelope(membership, request_id(&web)))),
        Err(e) => Err(error::map_service_error(e, trace_id)),
    }
}

pub async fn list_membership_package_groups(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<MembershipAppState>,
) -> Result<
    Json<ApiListEnvelope<CommerceMembershipPackageGroupPayload>>,
    (axum::http::StatusCode, Json<error::ProblemDetailsPayload>),
>
{
    let trace_id = request_trace_id(&web);
    match state.service.list_package_groups().await {
        Ok(groups) => {
            let total = groups.len();
            Ok(Json(build_list_envelope(groups, total, request_id(&web))))
        }
        Err(e) => Err(error::map_service_error(e, trace_id)),
    }
}
