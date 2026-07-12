use sqlx::AnyPool;

use sdkwork_birdcoder_app_templates_repository_sqlx::SqliteAppTemplateRepository;
use sdkwork_birdcoder_app_templates_service::domain::models::AppTemplatePayload;
use sdkwork_birdcoder_app_templates_service::service::app_template_service::AppTemplateService;
use sdkwork_birdcoder_errors::{
    build_data_envelope, build_offset_list_envelope, checked_list_total_items,
    trace_id_from_request_id, ApiDataEnvelope, ApiListEnvelope,
};
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_router_context::{
    project_context, workspace_context, RequiredIamContext, StrictOffsetListQuery,
    WebRequestContext,
};
use sdkwork_birdcoder_skill_packages_repository_sqlx::SqliteSkillPackageRepository;
use sdkwork_birdcoder_skill_packages_service::domain::commands::InstallSkillPackageInput;
use sdkwork_birdcoder_skill_packages_service::domain::models::{
    SkillInstallationPayload, SkillPackagePayload,
};
use sdkwork_birdcoder_skill_packages_service::service::skill_package_service::SkillPackageService;
use sdkwork_birdcoder_workspace_service::service::workspace_service::WorkspaceService;

use axum::extract::{Path, Query, State};
use axum::Json;

use crate::error;
use crate::mapper::request::{
    InstallSkillPackageBody, SkillPackageListQuery, SkillPackagePathParams,
};

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

#[derive(Clone)]
pub struct SkillPackagesAppState {
    pub service: SkillPackageService<SqliteSkillPackageRepository>,
    pub app_template_service: AppTemplateService<SqliteAppTemplateRepository>,
    pub workspace_service: WorkspaceService,
    pub project_service: ProjectService,
}

impl SkillPackagesAppState {
    pub fn new(
        pool: AnyPool,
        workspace_service: WorkspaceService,
        project_service: ProjectService,
    ) -> Self {
        Self {
            service: SkillPackageService::new(SqliteSkillPackageRepository::new(pool.clone())),
            app_template_service: AppTemplateService::new(SqliteAppTemplateRepository::new(pool)),
            workspace_service,
            project_service,
        }
    }
}

async fn ensure_skill_scope_access(
    state: &SkillPackagesAppState,
    iam: &RequiredIamContext,
    scope_type: &str,
    scope_id: &str,
    trace_id: Option<&str>,
) -> Result<(), error::ProblemJsonBody> {
    match scope_type {
        "workspace" => {
            let ctx = workspace_context(&iam.0);
            if state
                .workspace_service
                .ensure_workspace_access(&ctx, scope_id)
                .await
                .is_err()
            {
                return Err(error::map_not_found(
                    format!("Workspace '{scope_id}' was not found."),
                    trace_id,
                ));
            }
        }
        "project" => {
            let project_ctx = project_context(&iam.0);
            let project = state
                .project_service
                .get_project(&project_ctx, scope_id)
                .await
                .map_err(|e| error::map_project_error(e, trace_id))?;
            let workspace_ctx = workspace_context(&iam.0);
            if state
                .workspace_service
                .ensure_workspace_access(&workspace_ctx, &project.workspace_id)
                .await
                .is_err()
            {
                return Err(error::map_not_found(
                    format!("Project '{scope_id}' was not found."),
                    trace_id,
                ));
            }
        }
        _ => {
            return Err(error::map_skill_package_error(
                sdkwork_birdcoder_skill_packages_service::error::SkillPackageError::InvalidInput(
                    "scopeType must be workspace or project.".to_string(),
                ),
                trace_id,
            ));
        }
    }

    Ok(())
}

pub async fn list_skill_packages(
    web: WebRequestContext,
    iam: RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<SkillPackagesAppState>,
    Query(query): Query<SkillPackageListQuery>,
) -> Result<Json<ApiListEnvelope<SkillPackagePayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    if let Some(workspace_id) = query.workspace_id.as_deref() {
        ensure_skill_scope_access(&state, &iam, "workspace", workspace_id, trace_id).await?;
    }
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .service
        .list_packages(query.workspace_id.as_deref(), offset, page_size)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            checked_list_total_items(total, trace_id)?,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_skill_package_error(e, trace_id)),
    }
}

pub async fn install_skill_package(
    web: WebRequestContext,
    iam: RequiredIamContext,
    State(state): State<SkillPackagesAppState>,
    Path(params): Path<SkillPackagePathParams>,
    Json(body): Json<InstallSkillPackageBody>,
) -> Result<Json<ApiDataEnvelope<SkillInstallationPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let input = InstallSkillPackageInput {
        scope_id: body.scope_id.clone(),
        scope_type: body.scope_type.clone(),
        tenant_id: iam.0.tenant_id.clone(),
    };
    ensure_skill_scope_access(
        &state,
        &iam,
        input.scope_type.trim(),
        input.scope_id.trim(),
        trace_id,
    )
    .await?;
    match state
        .service
        .install_package(&params.package_id, &input)
        .await
    {
        Ok(installation) => Ok(Json(build_data_envelope(installation, request_id(&web)))),
        Err(e) => Err(error::map_skill_package_error(e, trace_id)),
    }
}

pub async fn list_app_templates(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<SkillPackagesAppState>,
) -> Result<Json<ApiListEnvelope<AppTemplatePayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    match state
        .app_template_service
        .list_templates(offset, page_size)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            checked_list_total_items(total, trace_id)?,
            request_id(&web),
        ))),
        Err(error) => Err(error::map_app_template_error(error, trace_id)),
    }
}
