use std::sync::{Arc, Mutex};

use axum::extract::{Path, Query, State};
use axum::Json;
use rusqlite::Connection;

use sdkwork_birdcoder_skill_packages_repository_sqlx::SqliteSkillPackageRepository;
use sdkwork_birdcoder_skill_packages_service::domain::commands::InstallSkillPackageInput;
use sdkwork_birdcoder_skill_packages_service::service::skill_package_service::SkillPackageService;
use sdkwork_birdcoder_router_context::RequiredIamContext;

use crate::error;
use crate::mapper::request::{InstallSkillPackageBody, SkillPackageListQuery, SkillPackagePathParams};

#[derive(Clone)]
pub struct SkillPackagesAppState {
    pub service: SkillPackageService<SqliteSkillPackageRepository>,
}

impl SkillPackagesAppState {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self {
            service: SkillPackageService::new(SqliteSkillPackageRepository::new(conn)),
        }
    }
}

pub async fn list_skill_packages(
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SkillPackagesAppState>,
    Query(query): Query<SkillPackageListQuery>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    match state.service.list_packages(query.workspace_id.as_deref()) {
        Ok(items) => Ok(Json(serde_json::json!({ "items": items }))),
        Err(e) => Err(error::map_skill_package_error(e)),
    }
}

pub async fn install_skill_package(
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SkillPackagesAppState>,
    Path(params): Path<SkillPackagePathParams>,
    Json(body): Json<InstallSkillPackageBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let input = InstallSkillPackageInput {
        scope_id: body.scope_id,
        scope_type: body.scope_type,
    };
    match state.service.install_package(&params.package_id, &input) {
        Ok(installation) => Ok(Json(serde_json::json!(installation))),
        Err(e) => Err(error::map_skill_package_error(e)),
    }
}

pub async fn list_app_templates(
    RequiredIamContext(_iam): RequiredIamContext,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    Err((
        axum::http::StatusCode::NOT_IMPLEMENTED,
        Json(error::ProblemDetailsPayload {
            code: "not_implemented".into(),
            message: "App template listing is not implemented yet.".into(),
            retryable: false,
        }),
    ))
}
