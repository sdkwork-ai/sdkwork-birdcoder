use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::sandbox_binding::{
    NewProjectSandboxBinding, ProjectSandboxBindingAuditEntry,
    ProjectSandboxBindingIdempotency, ProjectSandboxBindingPayload,
    PROJECT_SANDBOX_BINDING_AUDIT_SUCCEEDED, PROJECT_SANDBOX_BINDING_OPERATION_UPSERT,
    PROJECT_SANDBOX_BINDING_STATUS_ACTIVE,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::service::project_sandbox_binding_service::canonical_logical_path;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_utils_rust::datetime::{add_hours, now};

pub(super) const IDEMPOTENCY_RETENTION_HOURS: i64 = 24;

#[derive(Clone, Copy)]
pub(super) struct BindingScope {
    pub tenant_id: i64,
    pub organization_id: i64,
    pub user_id: i64,
    pub project_id: i64,
}

pub(super) enum IdempotencyReservation {
    Reserved,
    Replay { resource_id: String },
}

pub(super) struct StoredBinding {
    pub id: i64,
    pub project_id: i64,
    pub sandbox_id: String,
    pub root_entry_id: String,
    pub logical_path: String,
    pub status: String,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl StoredBinding {
    pub fn into_payload(self) -> ProjectSandboxBindingPayload {
        ProjectSandboxBindingPayload {
            id: self.id.to_string(),
            project_id: self.project_id.to_string(),
            sandbox_id: self.sandbox_id,
            root_entry_id: self.root_entry_id,
            logical_path: self.logical_path,
            status: self.status,
            version: self.version.to_string(),
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

pub(super) fn binding_scope(
    context: &ProjectContext,
    project_id: &str,
) -> Result<BindingScope, ProjectError> {
    Ok(BindingScope {
        tenant_id: parse_positive_id(&context.tenant_id, "tenant_id")?,
        organization_id: parse_non_negative_id(&context.organization_id, "organization_id")?,
        user_id: parse_positive_id(&context.user_id, "user_id")?,
        project_id: parse_positive_id(project_id, "project_id")?,
    })
}

pub(super) fn next_id(generator: &SnowflakeIdGenerator) -> Result<i64, ProjectError> {
    generator
        .generate()
        .map_err(|error| ProjectError::Internal(format!("Snowflake id generation failed: {error}")))
}

pub(super) fn mutation_times() -> (String, String) {
    let created_at = now();
    let expires_at = add_hours(created_at, IDEMPOTENCY_RETENTION_HOURS);
    (created_at.to_rfc3339(), expires_at.to_rfc3339())
}

pub(super) fn validate_binding(binding: &NewProjectSandboxBinding) -> Result<(), ProjectError> {
    binding_scope(
        &ProjectContext {
            tenant_id: "1".to_owned(),
            organization_id: "0".to_owned(),
            user_id: "1".to_owned(),
        },
        &binding.project_id,
    )?;
    if !is_safe_opaque_id(&binding.sandbox_id)
        || !is_safe_opaque_id(&binding.root_entry_id)
        || binding.status != PROJECT_SANDBOX_BINDING_STATUS_ACTIVE
        || binding.expected_version.is_some_and(|version| version < 0)
        || canonical_logical_path(&binding.logical_path).is_err()
    {
        return Err(ProjectError::InvalidInput(
            "Project sandbox binding persistence input is invalid.".to_owned(),
        ));
    }
    validate_idempotency(&binding.idempotency)
}

pub(super) fn validate_idempotency(
    idempotency: &ProjectSandboxBindingIdempotency,
) -> Result<(), ProjectError> {
    if idempotency.operation != PROJECT_SANDBOX_BINDING_OPERATION_UPSERT
        || !is_lower_hex(&idempotency.key_hash, 64)
        || !is_lower_hex(&idempotency.request_fingerprint, 64)
    {
        return Err(ProjectError::InvalidInput(
            "Sandbox-binding idempotency input is invalid.".to_owned(),
        ));
    }
    Ok(())
}

pub(super) fn validate_audit(audit: &ProjectSandboxBindingAuditEntry) -> Result<(), ProjectError> {
    if audit.action.trim().is_empty()
        || audit.action.len() > 160
        || audit.result != PROJECT_SANDBOX_BINDING_AUDIT_SUCCEEDED
        || audit
            .reason_code
            .as_deref()
            .is_some_and(|value| value.trim().is_empty() || value.len() > 96)
        || audit
            .trace_id
            .as_deref()
            .is_some_and(|value| value.trim().is_empty() || value.len() > 160)
        || audit.redacted_metadata_json.len() > 4096
    {
        return Err(ProjectError::InvalidInput(
            "Sandbox-binding audit input is invalid.".to_owned(),
        ));
    }
    let value: serde_json::Value = serde_json::from_str(&audit.redacted_metadata_json)
        .map_err(|_| ProjectError::InvalidInput("Sandbox-binding audit metadata is invalid.".to_owned()))?;
    if !value.is_object() || contains_protected_audit_key(&value) {
        return Err(ProjectError::InvalidInput(
            "Sandbox-binding audit metadata must be a redacted JSON object.".to_owned(),
        ));
    }
    Ok(())
}

pub(super) fn parse_version(value: &str) -> Result<i64, ProjectError> {
    value
        .parse::<i64>()
        .map_err(|_| ProjectError::Internal("Stored sandbox-binding version is invalid.".to_owned()))
}

pub(super) fn map_sqlx_error(error: sqlx::Error) -> ProjectError {
    ProjectError::Repository(error.to_string())
}

pub(super) fn map_write_error(error: sqlx::Error) -> ProjectError {
    let text = error.to_string().to_ascii_lowercase();
    if text.contains("unique") || text.contains("duplicate") || text.contains("constraint") {
        ProjectError::Conflict(
            "Project sandbox binding conflicts with an existing record.".to_owned(),
        )
    } else {
        map_sqlx_error(error)
    }
}

fn is_safe_opaque_id(value: &str) -> bool {
    !value.is_empty()
        && value.trim() == value
        && value.len() <= 160
        && !value.chars().any(char::is_control)
}

fn is_lower_hex(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn parse_positive_id(value: &str, field: &str) -> Result<i64, ProjectError> {
    let parsed = value
        .parse::<i64>()
        .map_err(|_| ProjectError::InvalidInput(format!("invalid {field}")))?;
    if parsed <= 0 {
        return Err(ProjectError::InvalidInput(format!("invalid {field}")));
    }
    Ok(parsed)
}

fn parse_non_negative_id(value: &str, field: &str) -> Result<i64, ProjectError> {
    let parsed = value
        .parse::<i64>()
        .map_err(|_| ProjectError::InvalidInput(format!("invalid {field}")))?;
    if parsed < 0 {
        return Err(ProjectError::InvalidInput(format!("invalid {field}")));
    }
    Ok(parsed)
}

fn contains_protected_audit_key(value: &serde_json::Value) -> bool {
    const PROTECTED_KEYS: &[&str] = &[
        "absolutepath",
        "accesstoken",
        "authorization",
        "authtoken",
        "browserhandle",
        "filesystemhandle",
        "idempotencykey",
        "physicalpath",
        "privateroot",
        "providerroot",
        "providerrootref",
        "refreshtoken",
        "tauripath",
    ];

    match value {
        serde_json::Value::Object(fields) => fields.iter().any(|(key, nested)| {
            let normalized = key
                .chars()
                .filter(|character| character.is_ascii_alphanumeric())
                .flat_map(char::to_lowercase)
                .collect::<String>();
            PROTECTED_KEYS.contains(&normalized.as_str()) || contains_protected_audit_key(nested)
        }),
        serde_json::Value::Array(items) => items.iter().any(contains_protected_audit_key),
        _ => false,
    }
}
