use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use uuid::Uuid;

use super::manifest::BuildTarget;
use super::types::ApplicationPublishError;

pub(crate) const PLAN_TTL: Duration = Duration::from_secs(15 * 60);
const ARTIFACT_TTL: Duration = Duration::from_secs(60 * 60);
const MAX_PLANS: usize = 32;
const MAX_ARTIFACTS: usize = 64;

#[derive(Debug, Clone)]
pub(crate) struct PublishPlan {
    pub(crate) plan_id: String,
    pub(crate) project_root: PathBuf,
    pub(crate) application_root: PathBuf,
    pub(crate) application_relative_path: String,
    pub(crate) manifest_digest: String,
    pub(crate) target: BuildTarget,
    pub(crate) created_at: Instant,
}

#[derive(Debug, Clone)]
pub(crate) struct StagedArtifact {
    pub(crate) artifact_id: String,
    pub(crate) path: PathBuf,
    pub(crate) byte_length: u64,
    pub(crate) created_at: Instant,
}

#[derive(Default)]
struct ApplicationPublishStateInner {
    plans: HashMap<String, PublishPlan>,
    artifacts: HashMap<String, StagedArtifact>,
}

pub struct ApplicationPublishState {
    staging_root: PathBuf,
    inner: Mutex<ApplicationPublishStateInner>,
}

impl ApplicationPublishState {
    pub fn new() -> Result<Self, String> {
        let temp_root = std::env::temp_dir();
        fs::create_dir_all(&temp_root)
            .map_err(|_| "failed to prepare application publish staging".to_string())?;
        let canonical_temp_root = temp_root
            .canonicalize()
            .map_err(|_| "failed to prepare application publish staging".to_string())?;
        let namespace = canonical_temp_root.join("sdkwork-birdcoder-application-publish");
        match fs::symlink_metadata(&namespace) {
            Ok(metadata)
                if super::path_safety::metadata_is_link_like(&metadata) || !metadata.is_dir() =>
            {
                return Err("application publish staging namespace is unsafe".to_string());
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                fs::create_dir(&namespace)
                    .map_err(|_| "failed to prepare application publish staging".to_string())?;
            }
            Err(_) => {
                return Err("failed to prepare application publish staging".to_string());
            }
        }
        let staging_root = namespace.join(Uuid::new_v4().to_string());
        fs::create_dir(&staging_root)
            .map_err(|_| "failed to prepare application publish staging".to_string())?;
        set_private_directory_permissions(&staging_root)?;
        Ok(Self {
            staging_root,
            inner: Mutex::new(ApplicationPublishStateInner::default()),
        })
    }

    pub(crate) fn insert_plan(&self, plan: PublishPlan) -> Result<(), ApplicationPublishError> {
        let mut inner = self.lock()?;
        self.prune_locked(&mut inner);
        if inner.plans.len() >= MAX_PLANS {
            if let Some(oldest) = inner
                .plans
                .values()
                .min_by_key(|plan| plan.created_at)
                .map(|plan| plan.plan_id.clone())
            {
                inner.plans.remove(&oldest);
            }
        }
        inner.plans.insert(plan.plan_id.clone(), plan);
        Ok(())
    }

    pub(crate) fn plan(&self, plan_id: &str) -> Result<PublishPlan, ApplicationPublishError> {
        if Uuid::parse_str(plan_id.trim()).is_err() {
            return Err(ApplicationPublishError::new(
                "APPLICATION_PUBLISH_PLAN_INVALID",
                "The publish plan identifier is invalid.",
            ));
        }
        let mut inner = self.lock()?;
        self.prune_locked(&mut inner);
        inner.plans.get(plan_id).cloned().ok_or_else(|| {
            ApplicationPublishError::new(
                "APPLICATION_PUBLISH_PLAN_EXPIRED",
                "The publish preflight has expired. Run preflight again.",
            )
        })
    }

    pub(crate) fn create_build_staging_directory(
        &self,
    ) -> Result<PathBuf, ApplicationPublishError> {
        let directory = self.staging_root.join(Uuid::new_v4().to_string());
        fs::create_dir(&directory).map_err(|_| {
            ApplicationPublishError::new(
                "APPLICATION_PUBLISH_STAGING_FAILED",
                "The local artifact staging directory could not be created.",
            )
        })?;
        set_private_directory_permissions(&directory).map_err(|_| {
            ApplicationPublishError::new(
                "APPLICATION_PUBLISH_STAGING_FAILED",
                "The local artifact staging directory could not be secured.",
            )
        })?;
        Ok(directory)
    }

    pub(crate) fn register_artifact(
        &self,
        path: PathBuf,
        byte_length: u64,
    ) -> Result<String, ApplicationPublishError> {
        if !path.starts_with(&self.staging_root) {
            return Err(ApplicationPublishError::new(
                "APPLICATION_PUBLISH_STAGING_FAILED",
                "The staged artifact is outside the host staging boundary.",
            ));
        }
        let artifact_id = Uuid::new_v4().to_string();
        let artifact = StagedArtifact {
            artifact_id: artifact_id.clone(),
            path,
            byte_length,
            created_at: Instant::now(),
        };
        let mut inner = self.lock()?;
        self.prune_locked(&mut inner);
        if inner.artifacts.len() >= MAX_ARTIFACTS {
            if let Some(oldest) = inner
                .artifacts
                .values()
                .min_by_key(|artifact| artifact.created_at)
                .cloned()
            {
                inner.artifacts.remove(&oldest.artifact_id);
                remove_staged_file(&self.staging_root, &oldest.path);
            }
        }
        inner.artifacts.insert(artifact_id.clone(), artifact);
        Ok(artifact_id)
    }

    pub(crate) fn artifact(
        &self,
        artifact_id: &str,
    ) -> Result<StagedArtifact, ApplicationPublishError> {
        if Uuid::parse_str(artifact_id.trim()).is_err() {
            return Err(ApplicationPublishError::new(
                "APPLICATION_PUBLISH_ARTIFACT_INVALID",
                "The artifact identifier is invalid.",
            ));
        }
        let mut inner = self.lock()?;
        self.prune_locked(&mut inner);
        inner.artifacts.get(artifact_id).cloned().ok_or_else(|| {
            ApplicationPublishError::new(
                "APPLICATION_PUBLISH_ARTIFACT_NOT_FOUND",
                "The staged artifact is unavailable or has expired.",
            )
        })
    }

    pub(crate) fn discard_artifact(
        &self,
        artifact_id: &str,
    ) -> Result<bool, ApplicationPublishError> {
        if Uuid::parse_str(artifact_id.trim()).is_err() {
            return Err(ApplicationPublishError::new(
                "APPLICATION_PUBLISH_ARTIFACT_INVALID",
                "The artifact identifier is invalid.",
            ));
        }
        let mut inner = self.lock()?;
        self.prune_locked(&mut inner);
        let Some(artifact) = inner.artifacts.remove(artifact_id) else {
            return Ok(false);
        };
        remove_staged_file(&self.staging_root, &artifact.path);
        Ok(true)
    }

    pub(crate) fn remove_build_staging_directory(&self, path: &Path) {
        if path.parent() == Some(self.staging_root.as_path()) {
            let _ = fs::remove_dir_all(path);
        }
    }

    fn lock(
        &self,
    ) -> Result<std::sync::MutexGuard<'_, ApplicationPublishStateInner>, ApplicationPublishError>
    {
        self.inner.lock().map_err(|_| {
            ApplicationPublishError::new(
                "APPLICATION_PUBLISH_STATE_UNAVAILABLE",
                "The local publish state is temporarily unavailable.",
            )
        })
    }

    fn prune_locked(&self, inner: &mut ApplicationPublishStateInner) {
        let now = Instant::now();
        inner
            .plans
            .retain(|_, plan| now.duration_since(plan.created_at) <= PLAN_TTL);
        let expired = inner
            .artifacts
            .iter()
            .filter(|(_, artifact)| now.duration_since(artifact.created_at) > ARTIFACT_TTL)
            .map(|(id, artifact)| (id.clone(), artifact.path.clone()))
            .collect::<Vec<_>>();
        for (id, path) in expired {
            inner.artifacts.remove(&id);
            remove_staged_file(&self.staging_root, &path);
        }
    }
}

impl Drop for ApplicationPublishState {
    fn drop(&mut self) {
        if self
            .staging_root
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|value| Uuid::parse_str(value).is_ok())
        {
            let _ = fs::remove_dir_all(&self.staging_root);
        }
    }
}

fn remove_staged_file(staging_root: &Path, path: &Path) {
    if !path.starts_with(staging_root) {
        return;
    }
    let _ = fs::remove_file(path);
    if let Some(parent) = path.parent().filter(|parent| *parent != staging_root) {
        let _ = fs::remove_dir(parent);
    }
}

#[cfg(unix)]
fn set_private_directory_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|_| "failed to secure application publish staging".to_string())
}

#[cfg(not(unix))]
fn set_private_directory_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}
