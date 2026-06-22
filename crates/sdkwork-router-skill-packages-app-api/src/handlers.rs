use sqlx::SqlitePool;

use sdkwork_birdcoder_app_templates_repository_sqlx::SqliteAppTemplateRepository;
use sdkwork_birdcoder_app_templates_service::service::app_template_service::AppTemplateService;
use sdkwork_birdcoder_skill_packages_repository_sqlx::SqliteSkillPackageRepository;
use sdkwork_birdcoder_skill_packages_service::domain::commands::InstallSkillPackageInput;
use sdkwork_birdcoder_skill_packages_service::service::skill_package_service::SkillPackageService;
use sdkwork_birdcoder_errors::trace_id_from_request_id;
use sdkwork_birdcoder_router_context::{RequiredIamContext, WebRequestContext};

use axum::extract::{Path, Query, State};
use axum::Json;

use crate::error;
use crate::mapper::request::{InstallSkillPackageBody, SkillPackageListQuery, SkillPackagePathParams};

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

#[derive(Clone)]
pub struct SkillPackagesAppState {
    pub service: SkillPackageService<SqliteSkillPackageRepository>,
    pub app_template_service: AppTemplateService<SqliteAppTemplateRepository>,
}

impl SkillPackagesAppState {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            service: SkillPackageService::new(SqliteSkillPackageRepository::new(pool.clone())),
            app_template_service: AppTemplateService::new(SqliteAppTemplateRepository::new(pool)),
        }
    }
}

pub async fn list_skill_packages(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SkillPackagesAppState>,
    Query(query): Query<SkillPackageListQuery>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let trace_id = request_trace_id(&web);
    match state
        .service
        .list_packages(query.workspace_id.as_deref())
        .await
    {
        Ok(items) => Ok(Json(serde_json::json!({ "items": items }))),
        Err(e) => Err(error::map_skill_package_error(e, trace_id)),
    }
}

pub async fn install_skill_package(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SkillPackagesAppState>,
    Path(params): Path<SkillPackagePathParams>,
    Json(body): Json<InstallSkillPackageBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let trace_id = request_trace_id(&web);
    let input = InstallSkillPackageInput {
        scope_id: body.scope_id,
        scope_type: body.scope_type,
    };
    match state
        .service
        .install_package(&params.package_id, &input)
        .await
    {
        Ok(installation) => Ok(Json(serde_json::json!(installation))),
        Err(e) => Err(error::map_skill_package_error(e, trace_id)),
    }
}

pub async fn list_app_templates(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SkillPackagesAppState>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let trace_id = request_trace_id(&web);
    match state.app_template_service.list_templates().await {
        Ok(items) => Ok(Json(serde_json::json!({ "items": items }))),
        Err(error) => Err(error::map_app_template_error(error, trace_id)),
    }
}
