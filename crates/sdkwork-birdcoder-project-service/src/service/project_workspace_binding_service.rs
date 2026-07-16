use std::sync::Arc;

use sdkwork_utils_rust::uuid;
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::context::ProjectContext;
use crate::domain::workspace_binding::{
    NewProjectWorkspaceBinding, ProjectWorkspaceBindingAuditContext,
    ProjectWorkspaceBindingAuditEntry, ProjectWorkspaceBindingIdempotency,
    ProjectWorkspaceBindingPayload, UpsertProjectWorkspaceBindingRequest,
    PROJECT_WORKSPACE_BINDING_LIFECYCLE_ACTIVE, PROJECT_WORKSPACE_BINDING_OPERATION_UPSERT,
};
use crate::error::ProjectError;
use crate::ports::repository::ProjectRepository;
use crate::ports::workspace_binding_repository::ProjectWorkspaceBindingRepository;

const MAX_OPAQUE_ID_BYTES: usize = 512;
const MAX_LOGICAL_PATH_BYTES: usize = 4096;
const MAX_LOGICAL_PATH_SEGMENT_BYTES: usize = 255;
const MIN_IDEMPOTENCY_KEY_BYTES: usize = 8;
const MAX_IDEMPOTENCY_KEY_BYTES: usize = 128;

#[derive(Clone)]
pub struct ProjectWorkspaceBindingService {
    project_repository: Arc<dyn ProjectRepository>,
    binding_repository: Arc<dyn ProjectWorkspaceBindingRepository>,
}

impl ProjectWorkspaceBindingService {
    pub fn new(
        project_repository: Arc<dyn ProjectRepository>,
        binding_repository: Arc<dyn ProjectWorkspaceBindingRepository>,
    ) -> Self {
        Self {
            project_repository,
            binding_repository,
        }
    }

    pub async fn get_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
    ) -> Result<ProjectWorkspaceBindingPayload, ProjectError> {
        validate_project_id(project_id)?;
        self.project_repository
            .find_project_by_id(context, project_id)
            .await?
            .ok_or_else(|| ProjectError::NotFound("Project was not found.".to_owned()))?;
        self.binding_repository
            .get_workspace_binding(context, project_id)
            .await?
            .ok_or_else(|| {
                ProjectError::NotFound("Project workspace binding was not found.".to_owned())
            })
    }

    pub async fn upsert_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
        request: &UpsertProjectWorkspaceBindingRequest,
        expected_version: Option<i64>,
        idempotency_key: &str,
        audit_context: &ProjectWorkspaceBindingAuditContext,
    ) -> Result<ProjectWorkspaceBindingPayload, ProjectError> {
        validate_project_id(project_id)?;
        validate_opaque_id("sandboxId", &request.sandbox_id)?;
        validate_opaque_id("rootEntryId", &request.root_entry_id)?;
        let logical_path = canonical_logical_path(&request.logical_path)?;
        if expected_version.is_some_and(|version| version < 0) {
            return Err(ProjectError::InvalidInput(
                "If-Match version must be non-negative.".to_owned(),
            ));
        }
        validate_idempotency_key(idempotency_key)?;

        self.project_repository
            .ensure_project_write_access(context, project_id)
            .await?;
        self.project_repository
            .find_project_by_id(context, project_id)
            .await?
            .ok_or_else(|| ProjectError::NotFound("Project was not found.".to_owned()))?;

        let key_hash = sha256_hex(idempotency_key.as_bytes());
        let request_fingerprint = request_fingerprint(
            project_id,
            &request.sandbox_id,
            &request.root_entry_id,
            &logical_path,
            expected_version,
        );
        let binding = NewProjectWorkspaceBinding {
            id: uuid(),
            uuid: uuid(),
            project_id: project_id.to_owned(),
            sandbox_id: request.sandbox_id.clone(),
            root_entry_id: request.root_entry_id.clone(),
            logical_path,
            lifecycle_status: PROJECT_WORKSPACE_BINDING_LIFECYCLE_ACTIVE.to_owned(),
            expected_version,
            idempotency: ProjectWorkspaceBindingIdempotency {
                operation: PROJECT_WORKSPACE_BINDING_OPERATION_UPSERT.to_owned(),
                key_hash,
                request_fingerprint,
            },
        };
        let audit = ProjectWorkspaceBindingAuditEntry {
            action: "project.workspace_binding.upsert".to_owned(),
            result: "accepted".to_owned(),
            trace_id: audit_context.trace_id.clone(),
            redacted_metadata_json: json!({
                "event": "project.workspace_binding.upsert",
                "hasLogicalPath": !binding.logical_path.is_empty(),
            })
            .to_string(),
        };
        self.binding_repository
            .upsert_workspace_binding(context, &binding, &audit)
            .await
    }

    pub async fn delete_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
        expected_version: i64,
        audit_context: &ProjectWorkspaceBindingAuditContext,
    ) -> Result<(), ProjectError> {
        validate_project_id(project_id)?;
        if expected_version < 0 {
            return Err(ProjectError::InvalidInput(
                "If-Match version must be non-negative.".to_owned(),
            ));
        }
        self.project_repository
            .ensure_project_write_access(context, project_id)
            .await?;
        let audit = ProjectWorkspaceBindingAuditEntry {
            action: "project.workspace_binding.delete".to_owned(),
            result: "accepted".to_owned(),
            trace_id: audit_context.trace_id.clone(),
            redacted_metadata_json: json!({
                "event": "project.workspace_binding.delete",
                "expectedVersion": expected_version.to_string(),
            })
            .to_string(),
        };
        self.binding_repository
            .delete_workspace_binding(context, project_id, expected_version, &audit)
            .await
    }
}

fn validate_project_id(project_id: &str) -> Result<(), ProjectError> {
    if project_id.is_empty()
        || !project_id.bytes().all(|byte| byte.is_ascii_digit())
        || project_id == "0"
    {
        return Err(ProjectError::InvalidInput(
            "projectId must be a positive decimal identifier.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_opaque_id(field: &str, value: &str) -> Result<(), ProjectError> {
    if value.is_empty()
        || value.trim() != value
        || value.len() > MAX_OPAQUE_ID_BYTES
        || value.chars().any(char::is_control)
    {
        return Err(ProjectError::InvalidInput(format!(
            "{field} must be a non-blank opaque identifier of at most {MAX_OPAQUE_ID_BYTES} bytes."
        )));
    }
    Ok(())
}

pub fn canonical_logical_path(value: &str) -> Result<String, ProjectError> {
    if value.len() > MAX_LOGICAL_PATH_BYTES || value.chars().any(char::is_control) {
        return Err(ProjectError::InvalidInput(
            "logicalPath is invalid.".to_owned(),
        ));
    }
    if value.is_empty() {
        return Ok(String::new());
    }
    if value.starts_with('/')
        || value.ends_with('/')
        || value.contains('\\')
        || value.split('/').any(|segment| {
            segment.is_empty()
                || matches!(segment, "." | "..")
                || segment.len() > MAX_LOGICAL_PATH_SEGMENT_BYTES
        })
    {
        return Err(ProjectError::InvalidInput(
            "logicalPath must be a canonical sandbox-relative path.".to_owned(),
        ));
    }
    Ok(value.to_owned())
}

fn validate_idempotency_key(value: &str) -> Result<(), ProjectError> {
    if !(MIN_IDEMPOTENCY_KEY_BYTES..=MAX_IDEMPOTENCY_KEY_BYTES).contains(&value.len())
        || !value.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b':' | b'@' | b'-')
        })
    {
        return Err(ProjectError::InvalidInput(
            "Idempotency-Key must contain 8 to 128 portable identifier characters.".to_owned(),
        ));
    }
    Ok(())
}

fn request_fingerprint(
    project_id: &str,
    sandbox_id: &str,
    root_entry_id: &str,
    logical_path: &str,
    expected_version: Option<i64>,
) -> String {
    let expected_version = expected_version
        .map(|value| value.to_string())
        .unwrap_or_else(|| "create".to_owned());
    sha256_hex(
        format!(
            "{project_id}\0{}\0{}\0{logical_path}\0{expected_version}",
            sandbox_id, root_entry_id,
        )
        .as_bytes(),
    )
}

fn sha256_hex(value: &[u8]) -> String {
    hex::encode(Sha256::digest(value))
}

#[cfg(test)]
mod tests {
    use super::canonical_logical_path;

    #[test]
    fn canonical_path_accepts_root_and_portable_segments() {
        assert_eq!(canonical_logical_path("").expect("root"), "");
        assert_eq!(
            canonical_logical_path("projects/demo/src").expect("path"),
            "projects/demo/src"
        );
    }

    #[test]
    fn canonical_path_rejects_absolute_traversal_and_backslashes() {
        for value in ["/root", "root/", "root//src", "root/../secret", "root\\src"] {
            assert!(canonical_logical_path(value).is_err(), "{value}");
        }
    }

    #[test]
    fn canonical_path_preserves_legal_whitespace_in_directory_names() {
        assert_eq!(
            canonical_logical_path(" projects /demo ").expect("path"),
            " projects /demo "
        );
    }
}
