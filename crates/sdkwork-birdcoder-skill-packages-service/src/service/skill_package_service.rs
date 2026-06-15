use crate::domain::commands::InstallSkillPackageInput;
use crate::domain::models::{SkillInstallationPayload, SkillPackagePayload};
use crate::error::SkillPackageError;

// ── Repository trait ─────────────────────────────────────────────────

pub trait SkillPackageRepository: Send + Sync {
    fn list_packages(
        &self,
        workspace_id: Option<&str>,
    ) -> Result<Vec<SkillPackagePayload>, String>;

    fn find_latest_version(
        &self,
        package_id: &str,
    ) -> Result<Option<(String, String)>, String>;

    fn find_existing_installation(
        &self,
        scope_type: &str,
        scope_id: &str,
        package_id: &str,
    ) -> Result<Option<SkillInstallationPayload>, String>;

    fn create_installation(
        &self,
        package_id: &str,
        version_id: &str,
        scope_type: &str,
        scope_id: &str,
    ) -> Result<SkillInstallationPayload, String>;

    fn scope_exists(&self, scope_type: &str, scope_id: &str) -> Result<bool, String>;
}

// ── Service ──────────────────────────────────────────────────────────

pub struct SkillPackageService<R: SkillPackageRepository> {
    repository: R,
}

impl<R: SkillPackageRepository> SkillPackageService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn list_packages(
        &self,
        workspace_id: Option<&str>,
    ) -> Result<Vec<SkillPackagePayload>, SkillPackageError> {
        self.repository
            .list_packages(workspace_id)
            .map_err(SkillPackageError::Repository)
    }

    pub fn install_package(
        &self,
        package_id: &str,
        input: &InstallSkillPackageInput,
    ) -> Result<SkillInstallationPayload, SkillPackageError> {
        let normalized_package_id = normalize_required(package_id).ok_or_else(|| {
            SkillPackageError::InvalidInput("packageId is required.".to_string())
        })?;
        let normalized_scope_id = normalize_required(&input.scope_id).ok_or_else(|| {
            SkillPackageError::InvalidInput("scopeId is required.".to_string())
        })?;
        let normalized_scope_type = normalize_required(&input.scope_type).ok_or_else(|| {
            SkillPackageError::InvalidInput("scopeType is required.".to_string())
        })?;

        if normalized_scope_type != "workspace" && normalized_scope_type != "project" {
            return Err(SkillPackageError::InvalidInput(
                "scopeType must be workspace or project.".to_string(),
            ));
        }

        let scope_exists = self
            .repository
            .scope_exists(&normalized_scope_type, &normalized_scope_id)
            .map_err(SkillPackageError::Repository)?;
        if !scope_exists {
            return Err(SkillPackageError::NotFound(format!(
                "{} \"{}\" was not found.",
                if normalized_scope_type == "workspace" {
                    "Workspace"
                } else {
                    "Project"
                },
                normalized_scope_id
            )));
        }

        let (version_id, resolved_package_id) = self
            .repository
            .find_latest_version(&normalized_package_id)
            .map_err(SkillPackageError::Repository)?
            .ok_or_else(|| {
                SkillPackageError::NotFound(format!(
                    "Skill package \"{normalized_package_id}\" was not found."
                ))
            })?;

        if let Some(existing) = self
            .repository
            .find_existing_installation(
                &normalized_scope_type,
                &normalized_scope_id,
                &resolved_package_id,
            )
            .map_err(SkillPackageError::Repository)?
        {
            return Ok(existing);
        }

        self.repository
            .create_installation(
                &resolved_package_id,
                &version_id,
                &normalized_scope_type,
                &normalized_scope_id,
            )
            .map_err(SkillPackageError::Repository)
    }
}

fn normalize_required(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
