use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::runtime_location::{
    NewProjectRuntimeLocation, NewProjectRuntimeLocationPreference,
    ProjectRuntimeLocationAuditEntry, ProjectRuntimeLocationRebind,
    ProjectRuntimeLocationUpdate, RuntimeLocationIdempotency,
    TrustedProjectRuntimeLocationVerification, HEALTH_STATUS_DEGRADED, HEALTH_STATUS_HEALTHY,
    HEALTH_STATUS_PENDING, HEALTH_STATUS_REVOKED, HEALTH_STATUS_UNREACHABLE,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_utils_rust::datetime::{add_hours, format_datetime, now};

pub(super) const IDEMPOTENCY_RETENTION_HOURS: i64 = 24;
pub(super) const RESOURCE_KIND_LOCATION: &str = "runtime_location";
pub(super) const RESOURCE_KIND_PREFERENCE: &str = "runtime_location_preference";

#[derive(Clone, Copy)]
pub(super) struct RuntimeLocationScope {
    pub tenant_id: i64,
    pub organization_id: i64,
    pub user_id: i64,
    pub project_id: i64,
}

pub(super) enum IdempotencyReservation {
    Reserved,
    Replay { resource_id: String },
}

pub(super) fn scope(
    context: &ProjectContext,
    project_id: &str,
) -> Result<RuntimeLocationScope, ProjectError> {
    Ok(RuntimeLocationScope {
        tenant_id: positive_id(&context.tenant_id, "tenant_id")?,
        organization_id: non_negative_id(&context.organization_id, "organization_id")?,
        user_id: positive_id(&context.user_id, "user_id")?,
        project_id: positive_id(project_id, "project_id")?,
    })
}

pub(super) fn positive_id(value: &str, field: &str) -> Result<i64, ProjectError> {
    let parsed = value
        .parse::<i64>()
        .map_err(|_| ProjectError::InvalidInput(format!("invalid {field}")))?;
    if parsed <= 0 {
        return Err(ProjectError::InvalidInput(format!("invalid {field}")));
    }
    Ok(parsed)
}

pub(super) fn non_negative_id(value: &str, field: &str) -> Result<i64, ProjectError> {
    let parsed = value
        .parse::<i64>()
        .map_err(|_| ProjectError::InvalidInput(format!("invalid {field}")))?;
    if parsed < 0 {
        return Err(ProjectError::InvalidInput(format!("invalid {field}")));
    }
    Ok(parsed)
}

pub(super) fn page_window(offset: usize, limit: usize) -> Result<(i64, i64), ProjectError> {
    if limit == 0 || limit > 200 {
        return Err(ProjectError::InvalidInput(
            "Runtime-location pagination is invalid.".to_owned(),
        ));
    }
    let offset = i64::try_from(offset)
        .map_err(|_| ProjectError::InvalidInput("offset is too large.".to_owned()))?;
    let limit = i64::try_from(limit)
        .map_err(|_| ProjectError::InvalidInput("limit is too large.".to_owned()))?;
    Ok((offset, limit))
}

pub(super) fn timestamps() -> (String, String) {
    let created_at = now();
    let expires_at = add_hours(created_at, IDEMPOTENCY_RETENTION_HOURS);
    (
        format_datetime(created_at, None),
        format_datetime(expires_at, None),
    )
}

pub(super) fn next_id(generator: &SnowflakeIdGenerator) -> Result<i64, ProjectError> {
    generator.generate().map_err(|error| {
        ProjectError::Internal(format!("Snowflake id generation failed: {error}"))
    })
}

pub(super) fn validate_new_location(
    location: &NewProjectRuntimeLocation,
) -> Result<(), ProjectError> {
    if !is_uuid_shape(&location.uuid)
        || location.runtime_target_id.trim().is_empty()
        || location.runtime_target_id.len() > 160
        || location.display_name.trim().is_empty()
        || location.display_name.len() > 160
        || location.encrypted_absolute_path.is_empty()
        || location.path_encryption_key_id.trim().is_empty()
        || !is_lower_hex(&location.path_fingerprint, 64)
        || !matches!(
            location.runtime_target_kind.as_str(),
            "desktop" | "server" | "runner" | "container" | "remote"
        )
        || !matches!(
            location.location_kind.as_str(),
            "local_directory"
                | "server_workspace"
                | "runner_workspace"
                | "container_workspace"
                | "remote_workspace"
        )
        || !matches!(location.path_flavor.as_str(), "windows" | "posix" | "virtual")
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location persistence input is invalid.".to_owned(),
        ));
    }
    validate_idempotency_option(location.idempotency.as_ref())
}

pub(super) fn validate_update(update: &ProjectRuntimeLocationUpdate) -> Result<(), ProjectError> {
    if update.expected_version < 0
        || update
            .display_name
            .as_deref()
            .is_none_or(|value| value.trim().is_empty() || value.len() > 160)
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location update input is invalid.".to_owned(),
        ));
    }
    validate_idempotency_option(update.idempotency.as_ref())
}

pub(super) fn validate_rebind(rebind: &ProjectRuntimeLocationRebind) -> Result<(), ProjectError> {
    if rebind.expected_version < 0
        || !matches!(rebind.path_flavor.as_str(), "windows" | "posix" | "virtual")
        || rebind.display_name.trim().is_empty()
        || rebind.display_name.len() > 160
        || rebind.encrypted_absolute_path.is_empty()
        || rebind.path_encryption_key_id.trim().is_empty()
        || !is_lower_hex(&rebind.path_fingerprint, 64)
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location rebind input is invalid.".to_owned(),
        ));
    }
    validate_idempotency_option(rebind.idempotency.as_ref())
}

pub(super) fn validate_verification(
    verification: &TrustedProjectRuntimeLocationVerification,
) -> Result<(), ProjectError> {
    if verification.expected_version < 0
        || verification.runtime_target_id.trim().is_empty()
        || !matches!(
            verification.health_status.as_str(),
            HEALTH_STATUS_PENDING
                | HEALTH_STATUS_HEALTHY
                | HEALTH_STATUS_DEGRADED
                | HEALTH_STATUS_UNREACHABLE
                | HEALTH_STATUS_REVOKED
        )
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location verification input is invalid.".to_owned(),
        ));
    }
    validate_idempotency_option(verification.idempotency.as_ref())
}

pub(super) fn validate_preference(
    preference: &NewProjectRuntimeLocationPreference,
) -> Result<(), ProjectError> {
    if positive_id(&preference.runtime_location_id, "runtime_location_id").is_err()
        || !matches!(
            preference.capability.as_str(),
            "terminal" | "git" | "build" | "filesystem"
        )
        || preference.expected_version.is_some_and(|value| value < 0)
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location preference input is invalid.".to_owned(),
        ));
    }
    validate_idempotency_option(preference.idempotency.as_ref())
}

pub(super) fn validate_idempotency(
    idempotency: &RuntimeLocationIdempotency,
) -> Result<(), ProjectError> {
    if idempotency.operation.trim().is_empty()
        || idempotency.operation.len() > 64
        || !is_lower_hex(&idempotency.key_hash, 64)
        || !is_lower_hex(&idempotency.request_fingerprint, 64)
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location idempotency input is invalid.".to_owned(),
        ));
    }
    Ok(())
}

pub(super) fn validate_audit(audit: &ProjectRuntimeLocationAuditEntry) -> Result<(), ProjectError> {
    if audit.action.trim().is_empty()
        || audit.action.len() > 160
        || !matches!(audit.result.as_str(), "succeeded" | "rejected" | "failed")
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
            "Runtime-location audit input is invalid.".to_owned(),
        ));
    }
    let value: serde_json::Value = serde_json::from_str(&audit.redacted_metadata_json)
        .map_err(|_| ProjectError::InvalidInput("Runtime-location audit metadata is invalid.".to_owned()))?;
    if !value.is_object() || contains_protected_audit_key(&value) {
        return Err(ProjectError::InvalidInput(
            "Runtime-location audit metadata must be a redacted JSON object.".to_owned(),
        ));
    }
    Ok(())
}

pub(super) fn supports_capability(
    capability: &str,
    terminal_available: bool,
    git_available: bool,
    build_available: bool,
    filesystem_available: bool,
) -> bool {
    match capability {
        "terminal" => terminal_available,
        "git" => git_available,
        "build" => build_available,
        "filesystem" => filesystem_available,
        _ => false,
    }
}

pub(super) fn precondition_miss() -> ProjectError {
    ProjectError::PreconditionFailed(
        "Runtime-location version does not match If-Match.".to_owned(),
    )
}

pub(super) fn map_sqlx_error(error: sqlx::Error) -> ProjectError {
    ProjectError::Repository(error.to_string())
}

pub(super) fn map_write_error(error: sqlx::Error) -> ProjectError {
    let text = error.to_string().to_ascii_lowercase();
    if text.contains("unique") || text.contains("duplicate") || text.contains("constraint") {
        ProjectError::Conflict(
            "Project runtime location conflicts with an existing record.".to_owned(),
        )
    } else {
        map_sqlx_error(error)
    }
}

fn validate_idempotency_option(
    idempotency: Option<&RuntimeLocationIdempotency>,
) -> Result<(), ProjectError> {
    match idempotency {
        Some(value) => validate_idempotency(value),
        None => Ok(()),
    }
}

fn is_uuid_shape(value: &str) -> bool {
    value.len() == 36
        && value
            .bytes()
            .enumerate()
            .all(|(index, byte)| match index {
                8 | 13 | 18 | 23 => byte == b'-',
                _ => byte.is_ascii_hexdigit(),
            })
}

fn is_lower_hex(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn contains_protected_audit_key(value: &serde_json::Value) -> bool {
    const PROTECTED_KEYS: &[&str] = &[
        "absolutepath",
        "accesstoken",
        "authorization",
        "authtoken",
        "encryptedabsolutepath",
        "idempotencykey",
        "pathencryptionkeyid",
        "pathfingerprint",
        "physicalpath",
        "privateroot",
        "refreshtoken",
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
