use axum::extract::{Query, State};
use axum::Json;
use sqlx::SqlitePool;

use sdkwork_birdcoder_membership_repository_sqlx::SqliteMembershipRepository;
use sdkwork_birdcoder_membership_service::service::membership_service::MembershipService;
use sdkwork_birdcoder_router_context::{RequiredIamContext, WebRequestContext};

use crate::error;
use crate::mapper::request::MembershipQuery;

#[derive(Clone)]
pub struct MembershipAppState {
    pub service: MembershipService<SqliteMembershipRepository>,
}

impl MembershipAppState {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            service: MembershipService::new(SqliteMembershipRepository::new(pool)),
        }
    }
}

pub async fn get_current_membership(
    _web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<MembershipAppState>,
    Query(query): Query<MembershipQuery>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let owner_user_id = query
        .owner_user_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(iam.user_id.as_str());
    match state
        .service
        .get_current_membership(
            Some(iam.tenant_id.clone()),
            iam.organization_id.clone(),
            owner_user_id,
        )
        .await
    {
        Ok(membership) => Ok(Json(serde_json::json!(membership))),
        Err(e) => Err(error::map_service_error(e)),
    }
}

pub async fn list_membership_package_groups(
    _web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<MembershipAppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    match state.service.list_package_groups().await {
        Ok(groups) => Ok(Json(serde_json::json!({ "items": groups }))),
        Err(e) => Err(error::map_service_error(e)),
    }
}
