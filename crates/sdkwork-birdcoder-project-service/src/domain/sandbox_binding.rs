use serde::Serialize;

pub const PROJECT_SANDBOX_BINDING_STATUS_ACTIVE: &str = "active";
pub const PROJECT_SANDBOX_BINDING_STATUS_REVOKED: &str = "revoked";
pub const PROJECT_SANDBOX_BINDING_OPERATION_UPSERT: &str = "upsert";
pub const PROJECT_SANDBOX_BINDING_AUDIT_SUCCEEDED: &str = "succeeded";

/// Public, path-safe reference to a Drive-owned server workspace.
///
/// This resource never grants Drive access. Consumers must present their
/// authenticated principal to Drive again for every filesystem operation.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSandboxBindingPayload {
    pub id: String,
    pub project_id: String,
    pub sandbox_id: String,
    pub root_entry_id: String,
    /// Canonical sandbox-relative logical path. Empty means sandbox root.
    pub logical_path: String,
    pub status: String,
    /// Decimal text preserves the full database integer for `If-Match`.
    pub version: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug)]
pub struct UpsertProjectSandboxBindingRequest {
    pub sandbox_id: String,
    pub root_entry_id: String,
    pub logical_path: String,
}

#[derive(Clone)]
pub struct NewProjectSandboxBinding {
    pub project_id: String,
    pub sandbox_id: String,
    pub root_entry_id: String,
    pub logical_path: String,
    pub status: String,
    pub expected_version: Option<i64>,
    pub idempotency: ProjectSandboxBindingIdempotency,
}

/// Only digests derived from headers and normalized request data reach SQL.
#[derive(Clone)]
pub struct ProjectSandboxBindingIdempotency {
    pub operation: String,
    pub key_hash: String,
    pub request_fingerprint: String,
}

#[derive(Clone)]
pub struct ProjectSandboxBindingAuditEntry {
    pub action: String,
    pub result: String,
    pub reason_code: Option<String>,
    pub trace_id: Option<String>,
    /// Redacted JSON. Provider roots, absolute paths, credentials, and raw
    /// idempotency keys are forbidden by repository validation.
    pub redacted_metadata_json: String,
}

#[derive(Clone, Default)]
pub struct ProjectSandboxBindingAuditContext {
    pub trace_id: Option<String>,
}
