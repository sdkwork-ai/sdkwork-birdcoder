use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use sdkwork_agents_runtime_facade::{
    ProviderSessionProjectCwdResolver, ProviderSessionProjectCwdSelector, RuntimeFacadeError,
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

pub struct TauriProviderSessionProjectCwdResolver {
    device_state_path: PathBuf,
}

impl TauriProviderSessionProjectCwdResolver {
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

impl ProviderSessionProjectCwdResolver for TauriProviderSessionProjectCwdResolver {
    fn resolve_project_cwd(
        &self,
        selector: &ProviderSessionProjectCwdSelector,
    ) -> RuntimeFacadeResult<Option<String>> {
        let mounts = self.read_mounts()?;
        let expected_owner_key = provider_session_mount_owner_key(selector);
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
            .filter(|mount| {
                // Everything else bound for the current subject: pre-identity
                // mounts (missing owner key) or mounts bound to an earlier
                // project record after the project was re-imported (stale
                // project id). The mount is keyed by project path, so a
                // same-basename mount remains the authoritative desktop root
                // for the project directory. Never match another subject's
                // mount: a mount whose owner key is present but differs is
                // excluded even when its project id is stale.
                let owner_matches = mount
                    .owner_key
                    .as_deref()
                    .is_none_or(|key| key == expected_owner_key.as_str());
                let exact_identity = mount.project_id.as_deref()
                    == Some(selector.project_id.as_str())
                    && mount.owner_key.as_deref() == Some(expected_owner_key.as_str());
                owner_matches && !exact_identity
            })
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

fn provider_session_mount_owner_key(selector: &ProviderSessionProjectCwdSelector) -> String {
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

    fn selector(project_id: &str) -> ProviderSessionProjectCwdSelector {
        ProviderSessionProjectCwdSelector {
            tenant_id: 100_001,
            organization_id: 0,
            owner_user_id: 100,
            project_id: project_id.to_string(),
            project_name: "sdkwork-birdcoder".to_string(),
        }
    }

    fn create_resolver_fixture(label: &str) -> (PathBuf, PathBuf) {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("test clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-native-cwd-{label}-{}-{nonce}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).expect("native cwd fixture root");
        let database = root.join("device-state.sqlite3");
        let connection = Connection::open(&database).expect("native cwd fixture database");
        connection
            .execute_batch(
                r#"
                CREATE TABLE device_state_entry (
                    scope TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (scope, key)
                );
                "#,
            )
            .expect("native cwd fixture schema");
        drop(connection);
        (root, database)
    }

    fn insert_mount(database: &Path, key: &str, path: &Path, project_id: &str, owner_key: &str) {
        let connection = Connection::open(database).expect("native cwd fixture database");
        connection
            .execute(
                "INSERT INTO device_state_entry VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![
                    PROJECT_DEVICE_MOUNTS_SCOPE,
                    key,
                    serde_json::json!({
                        "ownerKey": owner_key,
                        "path": path.to_string_lossy(),
                        "projectId": project_id,
                        "version": 1
                    })
                    .to_string(),
                    key
                ],
            )
            .expect("native cwd fixture mount");
    }

    #[test]
    fn owner_key_matches_subject_identity_without_runtime_realm() {
        let selector = selector("project.demo");
        assert_eq!(provider_session_mount_owner_key(&selector).len(), 64);
        assert_eq!(
            provider_session_mount_owner_key(&selector),
            hex::encode(Sha256::digest(b"100001\x010\x01100"))
        );
    }

    #[test]
    fn resolves_one_current_subject_project_mount() {
        let (root, database) = create_resolver_fixture("exact");
        let project_root = root.join("sdkwork-birdcoder");
        std::fs::create_dir_all(&project_root).expect("exact project root");
        let selector = selector("project.exact");
        insert_mount(
            &database,
            &"1".repeat(64),
            &project_root,
            &selector.project_id,
            &provider_session_mount_owner_key(&selector),
        );

        let resolved = TauriProviderSessionProjectCwdResolver::new(database)
            .resolve_project_cwd(&selector)
            .expect("exact project cwd");
        assert_eq!(
            resolved.as_deref(),
            Some(project_root.to_string_lossy().as_ref())
        );
        std::fs::remove_dir_all(root).expect("exact resolver fixture cleanup");
    }

    #[test]
    fn rejects_other_subject_mounts_and_other_basename_project_mounts() {
        let (root, database) = create_resolver_fixture("scope");
        let project_root = root.join("sdkwork-birdcoder");
        let other_root = root.join("unrelated-app");
        std::fs::create_dir_all(&project_root).expect("scoped project root");
        std::fs::create_dir_all(&other_root).expect("other basename project root");
        let selector = selector("project.expected");
        insert_mount(
            &database,
            &"2".repeat(64),
            &other_root,
            "project.other",
            &provider_session_mount_owner_key(&selector),
        );
        insert_mount(
            &database,
            &"3".repeat(64),
            &project_root,
            &selector.project_id,
            &"f".repeat(64),
        );

        assert!(TauriProviderSessionProjectCwdResolver::new(database)
            .resolve_project_cwd(&selector)
            .expect("scoped project cwd")
            .is_none());
        std::fs::remove_dir_all(root).expect("scoped resolver fixture cleanup");
    }

    #[test]
    fn resolves_a_stale_project_id_mount_for_the_same_subject() {
        let (root, database) = create_resolver_fixture("stale");
        let project_root = root.join("sdkwork-birdcoder");
        std::fs::create_dir_all(&project_root).expect("stale project root");
        let selector = selector("project.340096569736957952");
        insert_mount(
            &database,
            &"7".repeat(64),
            &project_root,
            // The project was soft-deleted and re-imported: the mount still
            // points at the retired project record while the active project
            // shares the same directory (and name).
            "project.339967887101923328",
            &provider_session_mount_owner_key(&selector),
        );

        let resolved = TauriProviderSessionProjectCwdResolver::new(database)
            .resolve_project_cwd(&selector)
            .expect("stale project cwd");
        assert_eq!(
            resolved.as_deref(),
            Some(project_root.to_string_lossy().as_ref())
        );
        std::fs::remove_dir_all(root).expect("stale resolver fixture cleanup");
    }

    #[test]
    fn rejects_a_stale_project_id_mount_of_another_subject() {
        let (root, database) = create_resolver_fixture("stale-other");
        let project_root = root.join("sdkwork-birdcoder");
        std::fs::create_dir_all(&project_root).expect("stale other project root");
        let selector = selector("project.expected");
        insert_mount(
            &database,
            &"8".repeat(64),
            &project_root,
            "project.retired",
            &"f".repeat(64),
        );

        assert!(TauriProviderSessionProjectCwdResolver::new(database)
            .resolve_project_cwd(&selector)
            .expect("stale other subject cwd")
            .is_none());
        std::fs::remove_dir_all(root).expect("stale other resolver fixture cleanup");
    }

    #[test]
    fn fails_closed_when_multiple_roots_match_the_same_project_identity() {
        let (root, database) = create_resolver_fixture("ambiguous");
        let first = root.join("first").join("sdkwork-birdcoder");
        let second = root.join("second").join("sdkwork-birdcoder");
        std::fs::create_dir_all(&first).expect("first ambiguous project root");
        std::fs::create_dir_all(&second).expect("second ambiguous project root");
        let selector = selector("project.ambiguous");
        let owner_key = provider_session_mount_owner_key(&selector);
        insert_mount(
            &database,
            &"4".repeat(64),
            &first,
            &selector.project_id,
            &owner_key,
        );
        insert_mount(
            &database,
            &"5".repeat(64),
            &second,
            &selector.project_id,
            &owner_key,
        );

        let error = TauriProviderSessionProjectCwdResolver::new(database)
            .resolve_project_cwd(&selector)
            .expect_err("ambiguous project roots must fail closed");
        assert!(matches!(error, RuntimeFacadeError::InvalidInput(_)));
        std::fs::remove_dir_all(root).expect("ambiguous resolver fixture cleanup");
    }

    #[test]
    fn ignores_a_persisted_mount_whose_directory_no_longer_exists() {
        let (root, database) = create_resolver_fixture("missing");
        let selector = selector("project.missing");
        insert_mount(
            &database,
            &"6".repeat(64),
            &root.join("missing").join("sdkwork-birdcoder"),
            &selector.project_id,
            &provider_session_mount_owner_key(&selector),
        );

        assert!(TauriProviderSessionProjectCwdResolver::new(database)
            .resolve_project_cwd(&selector)
            .expect("missing project cwd")
            .is_none());
        std::fs::remove_dir_all(root).expect("missing resolver fixture cleanup");
    }
}
