use serde::Serialize;

pub const PROJECT_WORKSPACE_BINDING_LIFECYCLE_ACTIVE: &str = "active";
pub const PROJECT_WORKSPACE_BINDING_LIFECYCLE_REVOKED: &str = "revoked";
pub const PROJECT_WORKSPACE_BINDING_OPERATION_UPSERT: &str = "upsert";

/// Public, path-safe reference to a Drive-owned server workspace.
///
/// This resource never grants Drive access. Consumers must present their
/// authenticated principal to Drive again for every filesystem operation.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectWorkspaceBindingPayload {
    pub id: String,
    pub project_id: String,
    pub sandbox_id: String,
    pub root_entry_id: String,
    /// Canonical sandbox-relative logical path. Empty means sandbox root.
    pub logical_path: String,
    pub lifecycle_status: String,
    /// Decimal text preserves the full database integer for `If-Match`.
    pub version: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug)]
pub struct UpsertProjectWorkspaceBindingRequest {
    pub sandbox_id: String,
    pub root_entry_id: String,
    pub logical_path: String,
}

#[derive(Clone)]
pub struct NewProjectWorkspaceBinding {
    pub id: String,
    pub uuid: String,
    pub project_id: String,
    pub sandbox_id: String,
    pub root_entry_id: String,
    pub logical_path: String,
    pub lifecycle_status: String,
    pub expected_version: Option<i64>,
    pub idempotency: ProjectWorkspaceBindingIdempotency,
}

/// Only digests derived from headers and normalized request data reach SQL.
#[derive(Clone)]
pub struct ProjectWorkspaceBindingIdempotency {
    pub operation: String,
    pub key_hash: String,
    pub request_fingerprint: String,
}

#[derive(Clone)]
pub struct ProjectWorkspaceBindingAuditEntry {
    pub action: String,
    pub result: String,
    pub trace_id: Option<String>,
    /// Redacted JSON. Provider roots, absolute paths, credentials, and raw
    /// idempotency keys are forbidden by repository validation.
    pub redacted_metadata_json: String,
}

#[derive(Clone, Default)]
pub struct ProjectWorkspaceBindingAuditContext {
    pub trace_id: Option<String>,
}
