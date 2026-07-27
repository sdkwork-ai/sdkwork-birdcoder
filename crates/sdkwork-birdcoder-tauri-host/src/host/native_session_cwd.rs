use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use sdkwork_agents_runtime_facade::{
    NativeSessionProjectCwdResolver, NativeSessionProjectCwdSelector, RuntimeFacadeError,
    RuntimeFacadeResult,
};
use serde::Deserialize;
use sha2::{Digest, Sha256};

const PROJECT_DEVICE_MOUNTS_SCOPE: &str = "project-device-mounts";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredProjectMount {
    path: String,
    project_id: Option<String>,
    owner_key: Option<String>,
    version: u32,
}

pub struct TauriNativeSessionProjectCwdResolver {
    device_state_path: PathBuf,
}

impl TauriNativeSessionProjectCwdResolver {
    pub fn new(device_state_path: PathBuf) -> Self {
        Self { device_state_path }
    }

    fn read_mounts(&self) -> RuntimeFacadeResult<Vec<StoredProjectMount>> {
        let connection = Connection::open_with_flags(
            &self.device_state_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )
        .map_err(runtime_error)?;
        let mut statement = connection
            .prepare(
                "SELECT value FROM device_state_entry WHERE scope = ?1 ORDER BY updated_at DESC",
            )
            .map_err(runtime_error)?;
        let rows = statement
            .query_map([PROJECT_DEVICE_MOUNTS_SCOPE], |row| row.get::<_, String>(0))
            .map_err(runtime_error)?;
        let mut mounts = Vec::new();
        for row in rows {
            let value = row.map_err(runtime_error)?;
            if let Ok(mount) = serde_json::from_str::<StoredProjectMount>(&value) {
                if mount.version == 1 && is_absolute_directory(&mount.path) {
                    mounts.push(mount);
                }
            }
        }
        Ok(mounts)
    }
}

impl NativeSessionProjectCwdResolver for TauriNativeSessionProjectCwdResolver {
    fn resolve_project_cwd(
        &self,
        selector: &NativeSessionProjectCwdSelector,
    ) -> RuntimeFacadeResult<Option<String>> {
        let mounts = self.read_mounts()?;
        let expected_owner_key = native_session_mount_owner_key(selector);
        let exact = mounts
            .iter()
            .filter(|mount| {
                mount.project_id.as_deref() == Some(selector.project_id.as_str())
                    && mount.owner_key.as_deref() == Some(expected_owner_key.as_str())
            })
            .map(|mount| normalize_path(&mount.path))
            .collect::<BTreeSet<_>>();
        match exact.len() {
            1 => return Ok(exact.into_iter().next()),
            value if value > 1 => {
                return Err(RuntimeFacadeError::InvalidInput(format!(
                    "multiple desktop roots are bound to project {}",
                    selector.project_id
                )));
            }
            _ => {}
        }

        let legacy = mounts
            .iter()
            .filter(|mount| mount.project_id.is_none() || mount.owner_key.is_none())
            .filter(|mount| {
                Path::new(&mount.path)
                    .file_name()
                    .and_then(|value| value.to_str())
                    .is_some_and(|value| value.eq_ignore_ascii_case(&selector.project_name))
            })
            .map(|mount| normalize_path(&mount.path))
            .collect::<BTreeSet<_>>();
        match legacy.len() {
            0 => Ok(None),
            1 => Ok(legacy.into_iter().next()),
            _ => Err(RuntimeFacadeError::InvalidInput(format!(
                "multiple legacy desktop roots match project {}",
                selector.project_id
            ))),
        }
    }
}

fn native_session_mount_owner_key(selector: &NativeSessionProjectCwdSelector) -> String {
    let subject_id = format!(
        "{}\u{1}{}\u{1}{}",
        selector.tenant_id, selector.organization_id, selector.owner_user_id
    );
    hex::encode(Sha256::digest(subject_id.as_bytes()))
}

fn is_absolute_directory(value: &str) -> bool {
    let path = Path::new(value.trim());
    path.is_absolute() && path.is_dir()
}

fn normalize_path(value: &str) -> String {
    value.trim().trim_end_matches(['/', '\\']).to_string()
}

fn runtime_error(error: impl std::fmt::Display) -> RuntimeFacadeError {
    RuntimeFacadeError::Handler(error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owner_key_matches_subject_identity_without_runtime_realm() {
        let selector = NativeSessionProjectCwdSelector {
            tenant_id: 100_001,
            organization_id: 0,
            owner_user_id: 100,
            project_id: "project.demo".to_string(),
            project_name: "demo".to_string(),
        };
        assert_eq!(native_session_mount_owner_key(&selector).len(), 64);
        assert_eq!(
            native_session_mount_owner_key(&selector),
            hex::encode(Sha256::digest(b"100001\x010\x01100"))
        );
    }
}
