use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Json;

use sdkwork_birdcoder_errors::{
    build_data_envelope, build_offset_list_envelope, trace_id_from_request_id, ApiDataEnvelope,
    ApiListEnvelope,
};
use sdkwork_birdcoder_project_service::domain::commands::{
    CommitProjectGitChangesRequest, CreateProjectGitBranchRequest, CreateProjectGitWorktreeRequest,
    CreateProjectRequest, PushProjectGitBranchRequest, RemoveProjectGitWorktreeRequest,
    SwitchProjectGitBranchRequest, UpdateProjectRequest,
};
use sdkwork_birdcoder_project_service::domain::document_binding::{
    ProjectDocumentBindingPayload, UpsertProjectDocumentBindingRequest,
};
use sdkwork_birdcoder_project_service::domain::results::ProjectPayload;
use sdkwork_birdcoder_project_service::domain::runtime_location::{
    CreateProjectRuntimeLocationRequest, ProjectRuntimeLocationAuditContext,
    ProjectRuntimeLocationCommandAcceptedPayload, ProjectRuntimeLocationPayload,
    ProjectRuntimeLocationPreferencePayload, ProjectRuntimeLocationVerificationAcceptedPayload,
    RebindProjectRuntimeLocationRequest, SetProjectRuntimeLocationPreferenceRequest,
    UpdateProjectRuntimeLocationRequest,
};
use sdkwork_birdcoder_project_service::domain::sandbox_binding::{
    ProjectSandboxBindingAuditContext, ProjectSandboxBindingPayload,
    UpsertProjectSandboxBindingRequest,
};
use sdkwork_birdcoder_project_service::ports::git::{GitProjectDiff, GitProjectOverview};
use sdkwork_birdcoder_project_service::service::project_document_binding_service::ProjectDocumentBindingService;
use sdkwork_birdcoder_project_service::service::project_runtime_location_service::{
    ProjectRuntimeLocationService, RuntimeLocationMutationContext,
};
use sdkwork_birdcoder_project_service::service::project_sandbox_binding_service::ProjectSandboxBindingService;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_router_context::{
    project_context, workspace_context, RequiredIamContext, StrictOffsetListQuery,
    WebRequestContext,
};
use sdkwork_birdcoder_workspace_service::domain::commands::{
    CreateWorkspaceRequest, UpdateWorkspaceRequest,
};
use sdkwork_birdcoder_workspace_service::domain::models::{ListPagination, WorkspaceScopedQuery};
use sdkwork_birdcoder_workspace_service::domain::results::WorkspacePayload;
use sdkwork_birdcoder_workspace_service::service::workspace_service::WorkspaceService;

use crate::error;
use crate::mapper::request::{
    CommitGitChangesBody, CreateGitBranchBody, CreateGitWorktreeBody, CreateProjectBody,
    CreateProjectRuntimeLocationBody, CreateWorkspaceBody, ProjectDocumentBindingPathParams,
    ProjectGitRuntimeLocationQuery, ProjectListQuery, ProjectPathParams,
    ProjectRuntimeLocationPathParams, ProjectRuntimeLocationPreferencePathParams,
    PruneGitWorktreesBody, PushGitBranchBody, RebindProjectRuntimeLocationBody,
    RemoveGitWorktreeBody, SetProjectRuntimeLocationPreferenceBody, SwitchGitBranchBody,
    UpdateProjectBody, UpdateProjectRuntimeLocationBody, UpdateWorkspaceBody,
    UpsertProjectDocumentBindingBody, UpsertProjectSandboxBindingBody, WorkspaceListQuery,
    WorkspacePathParams,
};

#[derive(Clone)]
pub struct WorkspaceAppState {
    pub workspace_service: WorkspaceService,
    pub project_service: ProjectService,
    pub document_binding_service: ProjectDocumentBindingService,
    pub sandbox_binding_service: ProjectSandboxBindingService,
    pub runtime_location_service: ProjectRuntimeLocationService,
}

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

fn runtime_location_audit_context(web: &WebRequestContext) -> ProjectRuntimeLocationAuditContext {
    ProjectRuntimeLocationAuditContext {
        trace_id: request_trace_id(web).map(str::to_owned),
    }
}

fn sandbox_binding_audit_context(web: &WebRequestContext) -> ProjectSandboxBindingAuditContext {
    ProjectSandboxBindingAuditContext {
        trace_id: request_trace_id(web).map(str::to_owned),
    }
}

fn required_idempotency_key(
    headers: &HeaderMap,
    trace_id: Option<&str>,
    resource_name: &str,
) -> Result<String, error::ProblemJsonBody> {
    let Some(value) = headers.get("idempotency-key") else {
        return Err(error::map_precondition_required(
            format!("Idempotency-Key is required for this {resource_name} mutation."),
            trace_id,
        ));
    };
    let value = value.to_str().map_err(|_| {
        error::map_validation_error("Idempotency-Key must be valid header text.", trace_id)
    })?;
    let value = value.trim();
    if value.is_empty() {
        return Err(error::map_validation_error(
            "Idempotency-Key must not be blank.",
            trace_id,
        ));
    }
    Ok(value.to_owned())
}

fn parse_if_match(
    value: &axum::http::HeaderValue,
    trace_id: Option<&str>,
) -> Result<i64, error::ProblemJsonBody> {
    let value = value
        .to_str()
        .map_err(|_| error::map_validation_error("If-Match must be valid header text.", trace_id))?
        .trim();
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(error::map_validation_error(
            "If-Match must be a non-negative decimal version.",
            trace_id,
        ));
    }
    value.parse::<i64>().map_err(|_| {
        error::map_validation_error("If-Match must be a non-negative decimal version.", trace_id)
    })
}

fn required_if_match(
    headers: &HeaderMap,
    trace_id: Option<&str>,
    resource_name: &str,
) -> Result<i64, error::ProblemJsonBody> {
    let Some(value) = headers.get("if-match") else {
        return Err(error::map_precondition_required(
            format!("If-Match is required for this {resource_name} mutation."),
            trace_id,
        ));
    };
    parse_if_match(value, trace_id)
}

fn optional_if_match(
    headers: &HeaderMap,
    trace_id: Option<&str>,
) -> Result<Option<i64>, error::ProblemJsonBody> {
    headers
        .get("if-match")
        .map(|value| parse_if_match(value, trace_id))
        .transpose()
}

pub async fn list_workspaces(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Query(query): Query<WorkspaceListQuery>,
) -> Result<Json<ApiListEnvelope<WorkspacePayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    if query
        .user_id
        .as_deref()
        .is_some_and(|requested_user_id| requested_user_id != iam.user_id)
    {
        return Err(error::forbidden(
            "Workspace listing is limited to the authenticated user.",
            trace_id,
        ));
    }
    let context = workspace_context(&iam);
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let query = WorkspaceScopedQuery {
        user_id: Some(iam.user_id.clone()),
        pagination: ListPagination {
            offset: Some(pagination.offset),
            page_size: Some(pagination.page_size),
        },
    };
    let (items, total) = state
        .workspace_service
        .list_workspaces(&context, &query)
        .await
        .map_err(|workspace_error| {
            error::map_workspace_error(workspace_error, trace_id, "workspaces.list")
        })?;
    Ok(Json(build_offset_list_envelope(
        items,
        offset,
        page_size,
        total,
        request_id(&web),
    )))
}

pub async fn get_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
) -> Result<Json<ApiDataEnvelope<WorkspacePayload>>, error::ProblemJsonBody> {
    let workspace = state
        .workspace_service
        .get_workspace(&workspace_context(&iam), &params.workspace_id)
        .await
        .map_err(|workspace_error| {
            error::map_workspace_error(
                workspace_error,
                request_trace_id(&web),
                "workspaces.retrieve",
            )
        })?;
    Ok(Json(build_data_envelope(workspace, request_id(&web))))
}

pub async fn create_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Json(body): Json<CreateWorkspaceBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<WorkspacePayload>>), error::ProblemJsonBody> {
    let request = CreateWorkspaceRequest {
        name: body.name,
        description: body.description,
        code: body.code,
        icon_url: body.icon_url,
        color: body.color,
        visibility: body.visibility,
    };
    let workspace = state
        .workspace_service
        .create_workspace(&workspace_context(&iam), &request)
        .await
        .map_err(|workspace_error| {
            error::map_workspace_error(
                workspace_error,
                request_trace_id(&web),
                "workspaces.create",
            )
        })?;
    Ok((
        StatusCode::CREATED,
        Json(build_data_envelope(workspace, request_id(&web))),
    ))
}

pub async fn update_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
    headers: HeaderMap,
    Json(body): Json<UpdateWorkspaceBody>,
) -> Result<Json<ApiDataEnvelope<WorkspacePayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let request = UpdateWorkspaceRequest {
        name: body.name,
        description: body.description,
        code: body.code,
        icon_url: body.icon_url,
        color: body.color,
        visibility: body.visibility,
        status: body.status,
        expected_version: required_if_match(&headers, trace_id, "workspace")?,
    };
    let workspace = state
        .workspace_service
        .update_workspace(&workspace_context(&iam), &params.workspace_id, &request)
        .await
        .map_err(|workspace_error| {
            error::map_workspace_error(workspace_error, trace_id, "workspaces.update")
        })?;
    Ok(Json(build_data_envelope(workspace, request_id(&web))))
}

pub async fn delete_workspace(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<WorkspacePathParams>,
    headers: HeaderMap,
) -> Result<StatusCode, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "workspace")?;
    state
        .workspace_service
        .delete_workspace(
            &workspace_context(&iam),
            &params.workspace_id,
            expected_version,
        )
        .await
        .map_err(|workspace_error| {
            error::map_workspace_error(workspace_error, trace_id, "workspaces.delete")
        })?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_projects(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Query(query): Query<ProjectListQuery>,
) -> Result<Json<ApiListEnvelope<ProjectPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let workspace_id = query
        .workspace_id
        .as_deref()
        .filter(|value| !sdkwork_utils_rust::is_blank(Some(value)))
        .ok_or_else(|| {
            error::map_validation_error("workspace_id is required to list projects.", trace_id)
        })?;
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let (items, total) = state
        .project_service
        .list_projects(
            &project_context(&iam),
            workspace_id,
            query.user_id.as_deref(),
            offset,
            page_size,
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(Json(build_offset_list_envelope(
        items,
        offset,
        page_size,
        total,
        request_id(&web),
    )))
}

pub async fn get_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiDataEnvelope<ProjectPayload>>, error::ProblemJsonBody> {
    let project = state
        .project_service
        .get_project(&project_context(&iam), &params.project_id)
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_data_envelope(project, request_id(&web))))
}

pub async fn create_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Json(body): Json<CreateProjectBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<ProjectPayload>>), error::ProblemJsonBody> {
    let request = CreateProjectRequest {
        workspace_id: body.workspace_id,
        name: body.name,
        description: body.description,
        code: body.code,
        project_kind: body.project_kind,
        default_agent_project_id: body.default_agent_project_id,
    };
    let project = state
        .project_service
        .create_project(&project_context(&iam), &request)
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok((
        StatusCode::CREATED,
        Json(build_data_envelope(project, request_id(&web))),
    ))
}

pub async fn update_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    headers: HeaderMap,
    Json(body): Json<UpdateProjectBody>,
) -> Result<Json<ApiDataEnvelope<ProjectPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let request = UpdateProjectRequest {
        name: body.name,
        description: body.description,
        code: body.code,
        project_kind: body.project_kind,
        default_agent_project_id: body.default_agent_project_id,
        status: body.status,
        expected_version: required_if_match(&headers, trace_id, "project")?,
    };
    let project = state
        .project_service
        .update_project(&project_context(&iam), &params.project_id, &request)
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(Json(build_data_envelope(project, request_id(&web))))
}

pub async fn delete_project(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    headers: HeaderMap,
) -> Result<StatusCode, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "project")?;
    state
        .project_service
        .delete_project(&project_context(&iam), &params.project_id, expected_version)
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_project_document_bindings(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiListEnvelope<ProjectDocumentBindingPayload>>, error::ProblemJsonBody> {
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let (items, total) = state
        .document_binding_service
        .list(
            &project_context(&iam),
            &params.project_id,
            offset,
            page_size,
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_offset_list_envelope(
        items,
        offset,
        page_size,
        total,
        request_id(&web),
    )))
}

pub async fn get_project_document_binding(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectDocumentBindingPathParams>,
) -> Result<Json<ApiDataEnvelope<ProjectDocumentBindingPayload>>, error::ProblemJsonBody> {
    let binding = state
        .document_binding_service
        .get(
            &project_context(&iam),
            &params.project_id,
            &params.binding_id,
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_data_envelope(binding, request_id(&web))))
}

pub async fn create_project_document_binding(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<UpsertProjectDocumentBindingBody>,
) -> Result<
    (StatusCode, Json<ApiDataEnvelope<ProjectDocumentBindingPayload>>),
    error::ProblemJsonBody,
> {
    let request = UpsertProjectDocumentBindingRequest {
        document_id: body.document_id,
        binding_kind: body.binding_kind,
    };
    let binding = state
        .document_binding_service
        .upsert(&project_context(&iam), &params.project_id, &request)
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok((
        StatusCode::CREATED,
        Json(build_data_envelope(binding, request_id(&web))),
    ))
}

pub async fn delete_project_document_binding(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectDocumentBindingPathParams>,
    headers: HeaderMap,
) -> Result<StatusCode, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "project document binding")?;
    state
        .document_binding_service
        .delete(
            &project_context(&iam),
            &params.project_id,
            &params.binding_id,
            expected_version,
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_project_sandbox_binding(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiDataEnvelope<ProjectSandboxBindingPayload>>, error::ProblemJsonBody> {
    let binding = state
        .sandbox_binding_service
        .get_binding(&project_context(&iam), &params.project_id)
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_data_envelope(binding, request_id(&web))))
}

pub async fn upsert_project_sandbox_binding(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    headers: HeaderMap,
    Json(body): Json<UpsertProjectSandboxBindingBody>,
) -> Result<Json<ApiDataEnvelope<ProjectSandboxBindingPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let idempotency_key =
        required_idempotency_key(&headers, trace_id, "project sandbox binding")?;
    let request = UpsertProjectSandboxBindingRequest {
        sandbox_id: body.sandbox_id,
        root_entry_id: body.root_entry_id,
        logical_path: body.logical_path,
    };
    let binding = state
        .sandbox_binding_service
        .upsert_binding(
            &project_context(&iam),
            &params.project_id,
            &request,
            optional_if_match(&headers, trace_id)?,
            &idempotency_key,
            &sandbox_binding_audit_context(&web),
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(Json(build_data_envelope(binding, request_id(&web))))
}

pub async fn delete_project_sandbox_binding(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    headers: HeaderMap,
) -> Result<StatusCode, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "project sandbox binding")?;
    state
        .sandbox_binding_service
        .delete_binding(
            &project_context(&iam),
            &params.project_id,
            expected_version,
            &sandbox_binding_audit_context(&web),
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_project_runtime_locations(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiListEnvelope<ProjectRuntimeLocationPayload>>, error::ProblemJsonBody> {
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let (items, total) = state
        .runtime_location_service
        .list_runtime_locations(
            &project_context(&iam),
            &params.project_id,
            offset,
            page_size,
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_offset_list_envelope(
        items,
        offset,
        page_size,
        total,
        request_id(&web),
    )))
}

pub async fn get_project_runtime_location(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPathParams>,
) -> Result<Json<ApiDataEnvelope<ProjectRuntimeLocationPayload>>, error::ProblemJsonBody> {
    let location = state
        .runtime_location_service
        .get_runtime_location(
            &project_context(&iam),
            &params.project_id,
            &params.runtime_location_id,
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_data_envelope(location, request_id(&web))))
}

pub async fn create_project_runtime_location(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    headers: HeaderMap,
    Json(body): Json<CreateProjectRuntimeLocationBody>,
) -> Result<
    (StatusCode, Json<ApiDataEnvelope<ProjectRuntimeLocationPayload>>),
    error::ProblemJsonBody,
> {
    let trace_id = request_trace_id(&web);
    let idempotency_key = required_idempotency_key(&headers, trace_id, "runtime location")?;
    let request = CreateProjectRuntimeLocationRequest {
        runtime_target_id: body.runtime_target_id,
        runtime_target_kind: body.runtime_target_kind,
        location_kind: body.location_kind,
        path_flavor: body.path_flavor,
        absolute_path: body.absolute_path,
        display_name: body.display_name,
    };
    let location = state
        .runtime_location_service
        .create_runtime_location(
            &project_context(&iam),
            &params.project_id,
            &request,
            Some(&idempotency_key),
            &runtime_location_audit_context(&web),
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok((
        StatusCode::CREATED,
        Json(build_data_envelope(location, request_id(&web))),
    ))
}

pub async fn update_project_runtime_location(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPathParams>,
    headers: HeaderMap,
    Json(body): Json<UpdateProjectRuntimeLocationBody>,
) -> Result<Json<ApiDataEnvelope<ProjectRuntimeLocationPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "runtime location")?;
    let idempotency_key = required_idempotency_key(&headers, trace_id, "runtime location")?;
    let audit_context = runtime_location_audit_context(&web);
    let request = UpdateProjectRuntimeLocationRequest {
        display_name: body.display_name,
    };
    let location = state
        .runtime_location_service
        .update_runtime_location(
            &project_context(&iam),
            &params.project_id,
            &params.runtime_location_id,
            &request,
            RuntimeLocationMutationContext::new(
                expected_version,
                Some(&idempotency_key),
                &audit_context,
            ),
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(Json(build_data_envelope(location, request_id(&web))))
}

pub async fn delete_project_runtime_location(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPathParams>,
    headers: HeaderMap,
) -> Result<StatusCode, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "runtime location")?;
    state
        .runtime_location_service
        .delete_runtime_location(
            &project_context(&iam),
            &params.project_id,
            &params.runtime_location_id,
            expected_version,
            &runtime_location_audit_context(&web),
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn rebind_project_runtime_location(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPathParams>,
    headers: HeaderMap,
    Json(body): Json<RebindProjectRuntimeLocationBody>,
) -> Result<
    Json<ApiDataEnvelope<ProjectRuntimeLocationCommandAcceptedPayload>>,
    error::ProblemJsonBody,
> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "runtime location")?;
    let idempotency_key = required_idempotency_key(&headers, trace_id, "runtime location")?;
    let audit_context = runtime_location_audit_context(&web);
    let request = RebindProjectRuntimeLocationRequest {
        path_flavor: body.path_flavor,
        absolute_path: body.absolute_path,
        display_name: body.display_name,
    };
    let result = state
        .runtime_location_service
        .rebind_runtime_location(
            &project_context(&iam),
            &params.project_id,
            &params.runtime_location_id,
            &request,
            RuntimeLocationMutationContext::new(
                expected_version,
                Some(&idempotency_key),
                &audit_context,
            ),
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(Json(build_data_envelope(result, request_id(&web))))
}

pub async fn request_project_runtime_location_verification(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPathParams>,
    headers: HeaderMap,
) -> Result<
    (
        StatusCode,
        Json<ApiDataEnvelope<ProjectRuntimeLocationVerificationAcceptedPayload>>,
    ),
    error::ProblemJsonBody,
> {
    let trace_id = request_trace_id(&web);
    let expected_version = required_if_match(&headers, trace_id, "runtime location")?;
    let idempotency_key = required_idempotency_key(&headers, trace_id, "runtime location")?;
    let result = state
        .runtime_location_service
        .request_runtime_location_verification(
            &project_context(&iam),
            &params.project_id,
            &params.runtime_location_id,
            expected_version,
            Some(&idempotency_key),
            &runtime_location_audit_context(&web),
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok((
        StatusCode::ACCEPTED,
        Json(build_data_envelope(result, request_id(&web))),
    ))
}

pub async fn list_project_runtime_location_preferences(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
) -> Result<Json<ApiListEnvelope<ProjectRuntimeLocationPreferencePayload>>, error::ProblemJsonBody>
{
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let (items, total) = state
        .runtime_location_service
        .list_runtime_location_preferences(
            &project_context(&iam),
            &params.project_id,
            offset,
            page_size,
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_offset_list_envelope(
        items,
        offset,
        page_size,
        total,
        request_id(&web),
    )))
}

pub async fn update_project_runtime_location_preference(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectRuntimeLocationPreferencePathParams>,
    headers: HeaderMap,
    Json(body): Json<SetProjectRuntimeLocationPreferenceBody>,
) -> Result<Json<ApiDataEnvelope<ProjectRuntimeLocationPreferencePayload>>, error::ProblemJsonBody>
{
    let trace_id = request_trace_id(&web);
    let idempotency_key =
        required_idempotency_key(&headers, trace_id, "runtime location preference")?;
    let request = SetProjectRuntimeLocationPreferenceRequest {
        capability: params.capability,
        runtime_location_id: body.runtime_location_id,
    };
    let preference = state
        .runtime_location_service
        .set_runtime_location_preference(
            &project_context(&iam),
            &params.project_id,
            &request,
            optional_if_match(&headers, trace_id)?,
            Some(&idempotency_key),
            &runtime_location_audit_context(&web),
        )
        .await
        .map_err(|project_error| error::map_project_error(project_error, trace_id))?;
    Ok(Json(build_data_envelope(preference, request_id(&web))))
}

pub async fn get_project_git_overview(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Query(query): Query<ProjectGitRuntimeLocationQuery>,
) -> Result<Json<ApiDataEnvelope<GitProjectOverview>>, error::ProblemJsonBody> {
    let overview = state
        .project_service
        .get_project_git_overview(
            &project_context(&iam),
            &params.project_id,
            &query.runtime_location_id,
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_data_envelope(overview, request_id(&web))))
}

pub async fn get_project_git_diff(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Query(query): Query<ProjectGitRuntimeLocationQuery>,
) -> Result<Json<ApiDataEnvelope<GitProjectDiff>>, error::ProblemJsonBody> {
    let diff = state
        .project_service
        .get_project_git_diff(
            &project_context(&iam),
            &params.project_id,
            &query.runtime_location_id,
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_data_envelope(diff, request_id(&web))))
}

pub async fn create_project_git_branch(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CreateGitBranchBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<GitProjectOverview>>), error::ProblemJsonBody> {
    let overview = state
        .project_service
        .create_project_git_branch(
            &project_context(&iam),
            &params.project_id,
            &body.runtime_location_id,
            &CreateProjectGitBranchRequest {
                branch_name: body.branch_name,
            },
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok((
        StatusCode::CREATED,
        Json(build_data_envelope(overview, request_id(&web))),
    ))
}

pub async fn switch_project_git_branch(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<SwitchGitBranchBody>,
) -> Result<Json<ApiDataEnvelope<GitProjectOverview>>, error::ProblemJsonBody> {
    let overview = state
        .project_service
        .switch_project_git_branch(
            &project_context(&iam),
            &params.project_id,
            &body.runtime_location_id,
            &SwitchProjectGitBranchRequest {
                branch_name: body.branch_name,
            },
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_data_envelope(overview, request_id(&web))))
}

pub async fn commit_project_git_changes(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CommitGitChangesBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<GitProjectOverview>>), error::ProblemJsonBody> {
    let overview = state
        .project_service
        .commit_project_git_changes(
            &project_context(&iam),
            &params.project_id,
            &body.runtime_location_id,
            &CommitProjectGitChangesRequest {
                include_unstaged: body.include_unstaged,
                message: body.message,
            },
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok((
        StatusCode::CREATED,
        Json(build_data_envelope(overview, request_id(&web))),
    ))
}

pub async fn push_project_git_branch(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<PushGitBranchBody>,
) -> Result<Json<ApiDataEnvelope<GitProjectOverview>>, error::ProblemJsonBody> {
    let overview = state
        .project_service
        .push_project_git_branch(
            &project_context(&iam),
            &params.project_id,
            &body.runtime_location_id,
            &PushProjectGitBranchRequest {
                branch_name: body.branch_name,
                remote_name: body.remote_name,
            },
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_data_envelope(overview, request_id(&web))))
}

pub async fn create_project_git_worktree(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<CreateGitWorktreeBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<GitProjectOverview>>), error::ProblemJsonBody> {
    let overview = state
        .project_service
        .create_project_git_worktree(
            &project_context(&iam),
            &params.project_id,
            &body.runtime_location_id,
            &CreateProjectGitWorktreeRequest {
                branch_name: body.branch_name,
            },
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok((
        StatusCode::CREATED,
        Json(build_data_envelope(overview, request_id(&web))),
    ))
}

pub async fn remove_project_git_worktree(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<RemoveGitWorktreeBody>,
) -> Result<Json<ApiDataEnvelope<GitProjectOverview>>, error::ProblemJsonBody> {
    let overview = state
        .project_service
        .remove_project_git_worktree(
            &project_context(&iam),
            &params.project_id,
            &body.runtime_location_id,
            &RemoveProjectGitWorktreeRequest {
                force: body.force,
                worktree_key: body.worktree_key,
            },
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_data_envelope(overview, request_id(&web))))
}

pub async fn prune_project_git_worktrees(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<WorkspaceAppState>,
    Path(params): Path<ProjectPathParams>,
    Json(body): Json<PruneGitWorktreesBody>,
) -> Result<Json<ApiDataEnvelope<GitProjectOverview>>, error::ProblemJsonBody> {
    let overview = state
        .project_service
        .prune_project_git_worktrees(
            &project_context(&iam),
            &params.project_id,
            &body.runtime_location_id,
        )
        .await
        .map_err(|project_error| {
            error::map_project_error(project_error, request_trace_id(&web))
        })?;
    Ok(Json(build_data_envelope(overview, request_id(&web))))
}

#[cfg(test)]
mod tests {
    use axum::http::{HeaderMap, HeaderValue, StatusCode};
    use sdkwork_utils_rust::SdkWorkResultCode;

    use super::{optional_if_match, required_idempotency_key, required_if_match};

    #[test]
    fn if_match_is_required_and_strictly_decimal() {
        let missing = required_if_match(&HeaderMap::new(), Some("trace-1"), "project")
            .expect_err("missing precondition must fail");
        assert_eq!(missing.0, StatusCode::PRECONDITION_REQUIRED);
        assert_eq!(missing.2 .0.code, SdkWorkResultCode::PreconditionRequired.as_i32());

        for invalid in ["", "-1", "\"1\"", "1.0", " 1x "] {
            let mut headers = HeaderMap::new();
            headers.insert("if-match", HeaderValue::from_str(invalid).expect("header"));
            assert!(required_if_match(&headers, Some("trace-1"), "project").is_err());
        }

        let mut headers = HeaderMap::new();
        headers.insert("if-match", HeaderValue::from_static("42"));
        assert_eq!(
            required_if_match(&headers, Some("trace-1"), "project").expect("version"),
            42
        );
        assert_eq!(
            optional_if_match(&headers, Some("trace-1")).expect("version"),
            Some(42)
        );
    }

    #[test]
    fn idempotency_key_must_be_present_and_non_blank() {
        let missing = required_idempotency_key(
            &HeaderMap::new(),
            Some("trace-1"),
            "runtime location",
        )
        .expect_err("missing idempotency key must fail");
        assert_eq!(missing.0, StatusCode::PRECONDITION_REQUIRED);

        let mut headers = HeaderMap::new();
        headers.insert("idempotency-key", HeaderValue::from_static("request-123"));
        assert_eq!(
            required_idempotency_key(&headers, Some("trace-1"), "runtime location")
                .expect("idempotency key"),
            "request-123"
        );
    }
}
