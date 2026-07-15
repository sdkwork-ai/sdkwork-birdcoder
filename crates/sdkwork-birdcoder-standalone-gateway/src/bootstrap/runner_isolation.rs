use std::fmt;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::project_workspace_root::ProjectWorkspaceRootResolver;
use sha2::{Digest, Sha256};

const MAX_WORKSPACE_ID_LENGTH: usize = 128;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProviderRunnerBinding {
    pub tenant_id: String,
    pub user_id: String,
    pub workspace_id: String,
    pub workspace_root: PathBuf,
    pub home_root: PathBuf,
    pub temporary_root: PathBuf,
    pub credentials_root: PathBuf,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProviderRunnerEnvironmentBinding {
    pub sdkwork_workspace_root: PathBuf,
    pub home: PathBuf,
    pub user_profile: PathBuf,
    pub tmpdir: PathBuf,
    pub tmp: PathBuf,
    pub temp: PathBuf,
    pub sdkwork_credentials_root: PathBuf,
}

/// Server-owned project root resolver for remote project sources and Git.
///
/// The root is derived from authenticated scope plus database-issued IDs. It
/// intentionally has no client path input and creates only private,
/// non-symlinked descendants beneath the configured runner root.
#[derive(Clone, Debug)]
pub struct ServerProjectWorkspaceRootResolver {
    configured_root: Option<PathBuf>,
}

impl ServerProjectWorkspaceRootResolver {
    pub fn new(configured_root: Option<PathBuf>) -> Self {
        Self { configured_root }
    }
}

#[derive(Debug, Eq, PartialEq)]
pub enum ProviderRunnerIsolationError {
    InvalidIdentity(&'static str),
    InvalidWorkspaceId,
    InvalidWorkingDirectory,
    WorkingDirectoryOutsideWorkspace,
    InvalidRoot,
    UnsafePath,
    DirectoryCreation(String),
}

impl ProviderRunnerIsolationError {
    pub fn is_invalid_input(&self) -> bool {
        matches!(
            self,
            Self::InvalidIdentity(_)
                | Self::InvalidWorkspaceId
                | Self::InvalidWorkingDirectory
                | Self::WorkingDirectoryOutsideWorkspace
        )
    }
}

impl fmt::Display for ProviderRunnerIsolationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidIdentity(field) => {
                write!(formatter, "{field} must be a positive numeric identifier")
            }
            Self::InvalidWorkspaceId => write!(
                formatter,
                "workspace id must use only ASCII letters, digits, hyphens, or underscores"
            ),
            Self::InvalidWorkingDirectory => {
                write!(formatter, "working directory must be an existing directory")
            }
            Self::WorkingDirectoryOutsideWorkspace => write!(
                formatter,
                "working directory must stay within the isolated runner workspace"
            ),
            Self::InvalidRoot => write!(
                formatter,
                "provider runner isolation root must be an existing absolute directory"
            ),
            Self::UnsafePath => write!(
                formatter,
                "provider runner isolation path escaped its root or contains a symbolic link"
            ),
            Self::DirectoryCreation(error) => write!(
                formatter,
                "provider runner isolation directory could not be created: {error}"
            ),
        }
    }
}

impl std::error::Error for ProviderRunnerIsolationError {}

impl ProviderRunnerBinding {
    pub fn prepare(
        configured_root: &Path,
        tenant_id: &str,
        user_id: &str,
        workspace_id: &str,
    ) -> Result<Self, ProviderRunnerIsolationError> {
        let tenant_id = normalize_numeric_identity(tenant_id, "tenant id")?;
        let user_id = normalize_numeric_identity(user_id, "user id")?;
        let workspace_id = normalize_workspace_id(workspace_id)?;
        let isolation_root = canonicalize_isolation_root(configured_root)?;

        let tenant_scopes =
            ensure_descendant_directory(&isolation_root, &isolation_root, "tenants")?;
        let tenant_scope =
            ensure_descendant_directory(&isolation_root, &tenant_scopes, &tenant_id)?;
        let user_scopes = ensure_descendant_directory(&isolation_root, &tenant_scope, "users")?;
        let user_scope = ensure_descendant_directory(&isolation_root, &user_scopes, &user_id)?;
        let workspace_scopes =
            ensure_descendant_directory(&isolation_root, &user_scope, "workspaces")?;
        let workspace_scope = ensure_descendant_directory(
            &isolation_root,
            &workspace_scopes,
            &workspace_directory_key(&workspace_id),
        )?;

        let workspace_root =
            ensure_descendant_directory(&isolation_root, &workspace_scope, "workspace")?;
        let home_root = ensure_descendant_directory(&isolation_root, &workspace_scope, "home")?;
        let temporary_root = ensure_descendant_directory(&isolation_root, &workspace_scope, "tmp")?;
        let credentials_root =
            ensure_descendant_directory(&isolation_root, &workspace_scope, "credentials")?;

        Ok(Self {
            tenant_id,
            user_id,
            workspace_id,
            workspace_root,
            home_root,
            temporary_root,
            credentials_root,
        })
    }

    pub fn environment(&self) -> ProviderRunnerEnvironmentBinding {
        ProviderRunnerEnvironmentBinding {
            sdkwork_workspace_root: self.workspace_root.clone(),
            home: self.home_root.clone(),
            user_profile: self.home_root.clone(),
            tmpdir: self.temporary_root.clone(),
            tmp: self.temporary_root.clone(),
            temp: self.temporary_root.clone(),
            sdkwork_credentials_root: self.credentials_root.clone(),
        }
    }

    pub fn resolve_project_root(
        &self,
        project_id: &str,
    ) -> Result<PathBuf, ProviderRunnerIsolationError> {
        let project_id = normalize_numeric_identity(project_id, "project id")?;
        let projects_root =
            ensure_descendant_directory(&self.workspace_root, &self.workspace_root, "projects")?;
        ensure_descendant_directory(&self.workspace_root, &projects_root, &project_id)
    }

    pub fn resolve_working_directory(
        &self,
        requested_directory: Option<&Path>,
    ) -> Result<PathBuf, ProviderRunnerIsolationError> {
        let Some(requested_directory) = requested_directory else {
            return Ok(self.workspace_root.clone());
        };
        let requested_directory = std::fs::canonicalize(requested_directory)
            .map_err(|_| ProviderRunnerIsolationError::InvalidWorkingDirectory)?;
        if !requested_directory.is_dir() {
            return Err(ProviderRunnerIsolationError::InvalidWorkingDirectory);
        }
        if !requested_directory.starts_with(&self.workspace_root) {
            return Err(ProviderRunnerIsolationError::WorkingDirectoryOutsideWorkspace);
        }
        Ok(requested_directory)
    }
}

impl ProjectWorkspaceRootResolver for ServerProjectWorkspaceRootResolver {
    fn resolve_project_root(
        &self,
        context: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<PathBuf, ProjectError> {
        let configured_root = self.configured_root.as_deref().ok_or_else(|| {
            ProjectError::Unavailable("Server project workspace is unavailable.".to_owned())
        })?;
        let binding = ProviderRunnerBinding::prepare(
            configured_root,
            &context.tenant_id,
            &context.user_id,
            workspace_id,
        )
        .map_err(|_| {
            ProjectError::Unavailable("Server project workspace is unavailable.".to_owned())
        })?;
        binding.resolve_project_root(project_id).map_err(|_| {
            ProjectError::Unavailable("Server project workspace is unavailable.".to_owned())
        })
    }
}

fn normalize_numeric_identity(
    value: &str,
    field: &'static str,
) -> Result<String, ProviderRunnerIsolationError> {
    let value = value.trim();
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(ProviderRunnerIsolationError::InvalidIdentity(field));
    }
    let value = value
        .parse::<u64>()
        .map_err(|_| ProviderRunnerIsolationError::InvalidIdentity(field))?;
    if value == 0 {
        return Err(ProviderRunnerIsolationError::InvalidIdentity(field));
    }
    Ok(value.to_string())
}

fn normalize_workspace_id(value: &str) -> Result<String, ProviderRunnerIsolationError> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > MAX_WORKSPACE_ID_LENGTH
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
        || !value
            .as_bytes()
            .first()
            .is_some_and(u8::is_ascii_alphanumeric)
        || !value
            .as_bytes()
            .last()
            .is_some_and(u8::is_ascii_alphanumeric)
    {
        return Err(ProviderRunnerIsolationError::InvalidWorkspaceId);
    }
    Ok(value.to_owned())
}

fn workspace_directory_key(workspace_id: &str) -> String {
    let digest = Sha256::digest(workspace_id.as_bytes());
    format!("workspace-{}", hex::encode(digest))
}

fn canonicalize_isolation_root(
    configured_root: &Path,
) -> Result<PathBuf, ProviderRunnerIsolationError> {
    if !configured_root.is_absolute() {
        return Err(ProviderRunnerIsolationError::InvalidRoot);
    }
    if !configured_root.exists() {
        std::fs::create_dir_all(configured_root)
            .map_err(|error| ProviderRunnerIsolationError::DirectoryCreation(error.to_string()))?;
    }
    let metadata = std::fs::symlink_metadata(configured_root)
        .map_err(|_| ProviderRunnerIsolationError::InvalidRoot)?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(ProviderRunnerIsolationError::InvalidRoot);
    }
    std::fs::canonicalize(configured_root).map_err(|_| ProviderRunnerIsolationError::InvalidRoot)
}

fn ensure_descendant_directory(
    isolation_root: &Path,
    parent: &Path,
    component: &str,
) -> Result<PathBuf, ProviderRunnerIsolationError> {
    debug_assert!(!component.is_empty());
    debug_assert_eq!(Path::new(component).components().count(), 1);

    let candidate = parent.join(component);
    match create_private_directory(&candidate) {
        Ok(()) => {}
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {}
        Err(error) => {
            return Err(ProviderRunnerIsolationError::DirectoryCreation(
                error.to_string(),
            ));
        }
    }

    let metadata = std::fs::symlink_metadata(&candidate)
        .map_err(|error| ProviderRunnerIsolationError::DirectoryCreation(error.to_string()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(ProviderRunnerIsolationError::UnsafePath);
    }

    let canonical_candidate = std::fs::canonicalize(&candidate)
        .map_err(|error| ProviderRunnerIsolationError::DirectoryCreation(error.to_string()))?;
    if !canonical_candidate.starts_with(isolation_root)
        || canonical_candidate.parent() != Some(parent)
    {
        return Err(ProviderRunnerIsolationError::UnsafePath);
    }
    Ok(canonical_candidate)
}

#[cfg(unix)]
fn create_private_directory(path: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::DirBuilderExt;

    let mut builder = std::fs::DirBuilder::new();
    builder.mode(0o700).create(path)
}

#[cfg(not(unix))]
fn create_private_directory(path: &Path) -> std::io::Result<()> {
    std::fs::create_dir(path)
}

#[cfg(test)]
mod tests {
    use std::ffi::OsStr;
    use std::path::{Path, PathBuf};

    use super::{ProviderRunnerBinding, ProviderRunnerIsolationError};

    struct TestDirectory {
        root: PathBuf,
    }

    impl TestDirectory {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!(
                "sdkwork-birdcoder-runner-isolation-{}",
                uuid::Uuid::new_v4()
            ));
            std::fs::create_dir_all(&root).expect("create runner isolation test directory");
            Self { root }
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn prepares_distinct_private_roots_and_explicit_environment_fields() {
        let root = TestDirectory::new();
        let first = ProviderRunnerBinding::prepare(
            &root.root,
            "100000000000000001",
            "100000000000000002",
            "workspace-alpha",
        )
        .expect("prepare the first runner binding");
        let other_user = ProviderRunnerBinding::prepare(
            &root.root,
            "100000000000000001",
            "100000000000000003",
            "workspace-alpha",
        )
        .expect("prepare another user's runner binding");
        let other_workspace = ProviderRunnerBinding::prepare(
            &root.root,
            "100000000000000001",
            "100000000000000002",
            "workspace-beta",
        )
        .expect("prepare another workspace runner binding");

        for path in [
            &first.workspace_root,
            &first.home_root,
            &first.temporary_root,
            &first.credentials_root,
        ] {
            assert!(path.is_dir());
            assert!(path.starts_with(std::fs::canonicalize(&root.root).expect("canonical root")));
        }
        assert_ne!(first.workspace_root, other_user.workspace_root);
        assert_ne!(first.workspace_root, other_workspace.workspace_root);

        let environment = first.environment();
        assert_eq!(environment.sdkwork_workspace_root, first.workspace_root);
        assert_eq!(environment.home, first.home_root);
        assert_eq!(environment.user_profile, first.home_root);
        assert_eq!(environment.tmpdir, first.temporary_root);
        assert_eq!(environment.tmp, first.temporary_root);
        assert_eq!(environment.temp, first.temporary_root);
        assert_eq!(environment.sdkwork_credentials_root, first.credentials_root);
    }

    #[test]
    fn derives_distinct_server_owned_project_roots() {
        let root = TestDirectory::new();
        let binding = ProviderRunnerBinding::prepare(
            &root.root,
            "100000000000000001",
            "100000000000000002",
            "workspace-alpha",
        )
        .expect("prepare runner binding");

        let first = binding
            .resolve_project_root("100000000000000003")
            .expect("derive first project root");
        let second = binding
            .resolve_project_root("100000000000000004")
            .expect("derive second project root");

        assert!(first.is_dir());
        assert!(first.starts_with(&binding.workspace_root));
        assert_ne!(first, second);
        assert_eq!(
            first.parent().and_then(Path::file_name),
            Some(OsStr::new("projects"))
        );
        assert!(matches!(
            binding.resolve_project_root("../escape"),
            Err(ProviderRunnerIsolationError::InvalidIdentity("project id"))
        ));
    }

    #[test]
    fn creates_a_missing_absolute_isolation_root() {
        let parent = TestDirectory::new();
        let root = parent.root.join("runner-root");

        let binding = ProviderRunnerBinding::prepare(
            &root,
            "100000000000000001",
            "100000000000000002",
            "workspace-alpha",
        )
        .expect("prepare runner binding under a missing root");

        assert!(root.is_dir());
        assert!(binding
            .workspace_root
            .starts_with(std::fs::canonicalize(&root).expect("canonical runner isolation root")));
    }

    #[test]
    fn rejects_untrusted_identity_and_workspace_path_input() {
        let root = TestDirectory::new();
        for (tenant_id, user_id, workspace_id) in [
            ("tenant-1", "100000000000000002", "workspace-alpha"),
            ("100000000000000001", "../user", "workspace-alpha"),
            ("100000000000000001", "100000000000000002", "../escape"),
            ("100000000000000001", "100000000000000002", "/absolute"),
            ("100000000000000001", "100000000000000002", r"C:\escape"),
            ("100000000000000001", "100000000000000002", "nested/path"),
            ("100000000000000001", "100000000000000002", r"nested\path"),
        ] {
            let error =
                ProviderRunnerBinding::prepare(&root.root, tenant_id, user_id, workspace_id)
                    .expect_err("untrusted path input must be rejected");
            assert!(error.is_invalid_input(), "unexpected error: {error}");
        }
    }

    #[test]
    fn fails_closed_when_a_required_directory_is_a_file() {
        let root = TestDirectory::new();
        std::fs::write(root.root.join("tenants"), "not a directory")
            .expect("create conflicting file");

        let error = ProviderRunnerBinding::prepare(
            &root.root,
            "100000000000000001",
            "100000000000000002",
            "workspace-alpha",
        )
        .expect_err("a non-directory component must fail closed");

        assert_eq!(error, ProviderRunnerIsolationError::UnsafePath);
    }

    #[test]
    fn rejects_relative_and_symlinked_isolation_roots() {
        let relative_error = ProviderRunnerBinding::prepare(
            std::path::Path::new("relative-runner-root"),
            "100000000000000001",
            "100000000000000002",
            "workspace-alpha",
        )
        .expect_err("a relative isolation root must fail closed");
        assert_eq!(relative_error, ProviderRunnerIsolationError::InvalidRoot);

        let target = TestDirectory::new();
        let link_parent = TestDirectory::new();
        let link = link_parent.root.join("runner-root");
        if create_directory_symlink(&target.root, &link).is_err() {
            return;
        }
        let symlink_error = ProviderRunnerBinding::prepare(
            &link,
            "100000000000000001",
            "100000000000000002",
            "workspace-alpha",
        )
        .expect_err("a symlinked isolation root must fail closed");
        assert_eq!(symlink_error, ProviderRunnerIsolationError::InvalidRoot);
    }

    #[test]
    fn resolves_only_directories_inside_the_bound_workspace() {
        let root = TestDirectory::new();
        let outside = TestDirectory::new();
        let binding = ProviderRunnerBinding::prepare(
            &root.root,
            "100000000000000001",
            "100000000000000002",
            "workspace-alpha",
        )
        .expect("prepare runner binding");
        let source = binding.workspace_root.join("src");
        std::fs::create_dir(&source).expect("create workspace source directory");

        assert_eq!(
            binding
                .resolve_working_directory(None)
                .expect("resolve the workspace root"),
            binding.workspace_root
        );
        assert_eq!(
            binding
                .resolve_working_directory(Some(&source))
                .expect("resolve a workspace child directory"),
            std::fs::canonicalize(source).expect("canonical source directory")
        );
        assert_eq!(
            binding
                .resolve_working_directory(Some(&outside.root))
                .expect_err("an absolute outside directory must fail closed"),
            ProviderRunnerIsolationError::WorkingDirectoryOutsideWorkspace
        );
    }

    #[test]
    fn rejects_a_working_directory_symlink_that_escapes_the_workspace() {
        let root = TestDirectory::new();
        let outside = TestDirectory::new();
        let binding = ProviderRunnerBinding::prepare(
            &root.root,
            "100000000000000001",
            "100000000000000002",
            "workspace-alpha",
        )
        .expect("prepare runner binding");
        let link = binding.workspace_root.join("outside-link");
        if create_directory_symlink(&outside.root, &link).is_err() {
            return;
        }

        let error = binding
            .resolve_working_directory(Some(&link))
            .expect_err("a symlinked outside working directory must fail closed");

        assert_eq!(
            error,
            ProviderRunnerIsolationError::WorkingDirectoryOutsideWorkspace
        );
    }

    #[test]
    fn rejects_a_symlink_that_redirects_a_runner_scope() {
        let root = TestDirectory::new();
        let outside = TestDirectory::new();
        if create_directory_symlink(&outside.root, &root.root.join("tenants")).is_err() {
            return;
        }

        let error = ProviderRunnerBinding::prepare(
            &root.root,
            "100000000000000001",
            "100000000000000002",
            "workspace-alpha",
        )
        .expect_err("a symlinked scope must fail closed");

        assert_eq!(error, ProviderRunnerIsolationError::UnsafePath);
        assert!(
            std::fs::read_dir(&outside.root)
                .expect("read outside directory")
                .next()
                .is_none(),
            "the runner must not create directories through the symlink"
        );
    }

    #[cfg(unix)]
    fn create_directory_symlink(target: &PathBuf, link: &PathBuf) -> std::io::Result<()> {
        std::os::unix::fs::symlink(target, link)
    }

    #[cfg(windows)]
    fn create_directory_symlink(target: &PathBuf, link: &PathBuf) -> std::io::Result<()> {
        std::os::windows::fs::symlink_dir(target, link)
    }
}
