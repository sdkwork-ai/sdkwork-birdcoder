use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use sqlx::{AnyPool, Row};

use sdkwork_birdcoder_errors::{
    build_data_envelope, build_unbounded_list_envelope, require_scoped_tenant_id,
    require_scoped_user_id, trace_id_from_request_id, ApiDataEnvelope, ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{RequiredIamContext, WebRequestContext};
use sdkwork_birdcoder_system_descriptor_service::domain::models::{
    DescriptorPayload, HealthPayload, OperationPayload, RouteCatalogEntryPayload, RuntimePayload,
};
use sdkwork_birdcoder_system_descriptor_service::error::SystemDescriptorError;
use sdkwork_birdcoder_system_descriptor_service::service::system_service::{
    ManifestRouteCatalogProvider, OperationProvider, SystemService,
};
use sdkwork_web_contract::HttpRoute;

use crate::error;
use crate::mapper::request::OperationPathParams;

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

// ── Concrete provider implementations ────────────────────────────────

pub enum AppOperationProvider {
    Static,
    Repository(AnyPool),
}

#[async_trait::async_trait]
impl OperationProvider for AppOperationProvider {
    async fn find_operation(
        &self,
        tenant_id: &str,
        user_id: &str,
        operation_id: &str,
    ) -> Result<Option<OperationPayload>, SystemDescriptorError> {
        match self {
            Self::Static => Ok(None),
            Self::Repository(pool) => {
                find_repository_operation(pool, tenant_id, user_id, operation_id).await
            }
        }
    }
}

// ── State ────────────────────────────────────────────────────────────

pub type ConcreteSystemService = SystemService<ManifestRouteCatalogProvider, AppOperationProvider>;

#[derive(Clone)]
pub struct SystemAppState {
    pub service: Arc<ConcreteSystemService>,
    pub repository_pool: Option<AnyPool>,
    pub routes: &'static [HttpRoute],
}

impl SystemAppState {
    pub fn new(routes: &'static [HttpRoute]) -> Self {
        Self {
            service: Arc::new(SystemService::new(
                ManifestRouteCatalogProvider::new(routes),
                AppOperationProvider::Static,
            )),
            repository_pool: None,
            routes,
        }
    }

    pub fn with_repository_pool(repository_pool: AnyPool, routes: &'static [HttpRoute]) -> Self {
        Self {
            service: Arc::new(SystemService::new(
                ManifestRouteCatalogProvider::new(routes),
                AppOperationProvider::Repository(repository_pool.clone()),
            )),
            repository_pool: Some(repository_pool),
            routes,
        }
    }
}

// ── Handlers ─────────────────────────────────────────────────────────

pub async fn get_descriptor(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
) -> Json<ApiDataEnvelope<DescriptorPayload>> {
    let descriptor = state.service.descriptor_from_routes(
        "server",
        "sdkwork-birdcoder",
        "v1",
        state.routes,
        "/openapi.json",
    );
    Json(build_data_envelope(descriptor, request_id(&web)))
}

pub async fn list_routes(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
) -> Json<ApiListEnvelope<RouteCatalogEntryPayload>> {
    let routes = state.service.route_catalog();
    Json(build_unbounded_list_envelope(routes, request_id(&web)))
}

pub async fn get_runtime(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
) -> Json<ApiDataEnvelope<RuntimePayload>> {
    let runtime = state
        .service
        .runtime("127.0.0.1", 10240, "bird-server.config.json");
    Json(build_data_envelope(runtime, request_id(&web)))
}

pub async fn get_health(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
) -> Json<ApiDataEnvelope<HealthPayload>> {
    if let Some(pool) = state.repository_pool.as_ref() {
        return Json(build_data_envelope(
            build_repository_health_payload(pool).await,
            request_id(&web),
        ));
    }

    Json(build_data_envelope(
        HealthPayload {
            status: "healthy".to_string(),
        },
        request_id(&web),
    ))
}

async fn build_repository_health_payload(pool: &AnyPool) -> HealthPayload {
    let healthy = sqlx::query("SELECT 1").fetch_one(pool).await.is_ok();

    HealthPayload {
        status: if healthy {
            "healthy".to_string()
        } else {
            "degraded".to_string()
        },
    }
}

async fn find_repository_operation(
    pool: &AnyPool,
    tenant_id: &str,
    user_id: &str,
    operation_id: &str,
) -> Result<Option<OperationPayload>, SystemDescriptorError> {
    let operation_id = operation_id.trim();
    if operation_id.is_empty() {
        return Err(SystemDescriptorError::InvalidInput(
            "operationId is required.".to_string(),
        ));
    }
    let tenant_id = require_scoped_tenant_id(tenant_id).map_err(|_| {
        SystemDescriptorError::InvalidInput("a valid tenant scope is required.".to_string())
    })?;
    let user_id = require_scoped_user_id(user_id).map_err(|_| {
        SystemDescriptorError::InvalidInput("a valid user scope is required.".to_string())
    })?;

    let row = sqlx::query(
        "SELECT o.id, o.status, o.artifact_refs_json, o.stream_url, o.stream_kind \
         FROM ai_coding_session_operation o \
         INNER JOIN ai_coding_session s ON s.id = o.coding_session_id AND s.is_deleted = 0 \
         INNER JOIN studio_workspace w ON CAST(w.id AS TEXT) = s.workspace_id \
             AND w.is_deleted = 0 \
         WHERE o.id = ? AND o.is_deleted = 0 \
           AND o.tenant_id = ? AND o.user_id = ? \
           AND s.tenant_id = ? AND s.user_id = ? \
           AND w.tenant_id = ? \
           AND (w.owner_id = ? OR EXISTS (\
               SELECT 1 FROM studio_workspace_member m \
               WHERE m.workspace_id = w.id AND m.tenant_id = w.tenant_id \
                 AND m.user_id = ? AND m.is_deleted = 0 AND m.status = 'active'\
           ))",
    )
    .bind(operation_id)
    .bind(tenant_id)
    .bind(user_id)
    .bind(tenant_id)
    .bind(user_id)
    .bind(tenant_id)
    .bind(user_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| SystemDescriptorError::Internal(error.to_string()))?;

    let Some(row) = row else {
        return Ok(None);
    };
    let artifact_refs_json = row
        .try_get::<String, _>("artifact_refs_json")
        .map_err(|error| SystemDescriptorError::Internal(error.to_string()))?;
    let artifact_refs =
        serde_json::from_str::<Vec<String>>(&artifact_refs_json).map_err(|error| {
            SystemDescriptorError::Internal(format!(
                "operation artifact references are invalid: {error}"
            ))
        })?;
    let stream_url = row
        .try_get::<String, _>("stream_url")
        .map_err(|error| SystemDescriptorError::Internal(error.to_string()))?;
    let stream_kind = row
        .try_get::<String, _>("stream_kind")
        .map_err(|error| SystemDescriptorError::Internal(error.to_string()))?;

    Ok(Some(OperationPayload {
        operation_id: row
            .try_get("id")
            .map_err(|error| SystemDescriptorError::Internal(error.to_string()))?,
        status: row
            .try_get("status")
            .map_err(|error| SystemDescriptorError::Internal(error.to_string()))?,
        artifact_refs,
        stream_url: (!stream_url.trim().is_empty()).then_some(stream_url),
        stream_kind: (!stream_kind.trim().is_empty() && stream_kind != "none")
            .then_some(stream_kind),
    }))
}

pub async fn get_operation(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<SystemAppState>,
    Path(params): Path<OperationPathParams>,
) -> Result<Json<ApiDataEnvelope<OperationPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    match state
        .service
        .get_operation(
            iam.tenant_id.as_str(),
            iam.user_id.as_str(),
            params.operation_id.as_str(),
        )
        .await
    {
        Ok(operation) => Ok(Json(build_data_envelope(operation, request_id(&web)))),
        Err(e) => Err(error::map_system_error(e, trace_id)),
    }
}
