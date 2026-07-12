use serde::Serialize;
use std::collections::HashSet;
use std::ffi::OsString;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::UNIX_EPOCH;

const USER_HOME_CONFIG_RELATIVE_ROOT: &str = ".sdkwork/birdcoder";

/// Error type for filesystem path safety violations. Follows
/// sdkwork-specs/SECURITY_SPEC.md sandbox principles: paths that escape the
/// workspace root or traverse through symlinks must be rejected.
#[derive(Debug)]
pub enum FilesystemError {
    /// A resolved path escapes the allowed workspace root (path traversal).
    PathTraversal,
    /// A symlink was encountered on the mutation path and blocked for safety.
    SymlinkDetected,
    /// A path could not be resolved safely enough to prove containment.
    UnresolvablePath,
}

impl std::fmt::Display for FilesystemError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FilesystemError::PathTraversal => {
                write!(f, "resolved path escapes the allowed filesystem root")
            }
            FilesystemError::SymlinkDetected => {
                write!(
                    f,
                    "link or reparse point is not allowed for this filesystem operation"
                )
            }
            FilesystemError::UnresolvablePath => {
                write!(f, "filesystem path could not be resolved safely")
            }
        }
    }
}

impl std::error::Error for FilesystemError {}

static ALLOWED_FS_ROOTS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();

pub fn register_allowed_fs_root(path: PathBuf) -> Result<(), String> {
    let canonical = path.canonicalize().map_err(|error| {
        format!(
            "failed to canonicalize filesystem root {}: {error}",
            path.display()
        )
    })?;
    if !canonical.is_dir() {
        return Err("filesystem root must be an existing directory".to_string());
    }
    ALLOWED_FS_ROOTS
        .get_or_init(|| Mutex::new(HashSet::new()))
        .lock()
        .map_err(|_| "filesystem root registry lock poisoned".to_string())?
        .insert(canonical);
    Ok(())
}

/// Fail-closed filesystem root validation.
///
/// Follows SECURITY_SPEC.md sandbox principles: when the root registry is not
/// initialized or is empty, access is denied rather than granted. This prevents
/// a race condition where filesystem commands could execute before
/// `register_allowed_fs_root` has been called during startup.
fn is_allowed_fs_root(path: &Path) -> bool {
    let Ok(canonical) = path.canonicalize() else {
        return false;
    };
    let Some(registry) = ALLOWED_FS_ROOTS.get() else {
        return false;
    };
    let Ok(roots) = registry.lock() else {
        return false;
    };
    if roots.is_empty() {
        return false;
    }
    roots
        .iter()
        .any(|allowed| canonical == *allowed || canonical.starts_with(allowed))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemNode {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileSystemNode>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemSnapshotResponse {
    pub root_virtual_path: String,
    pub tree: FileSystemNode,
    pub limit_reached: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemDirectoryListingResponse {
    pub root_virtual_path: String,
    pub directory: FileSystemNode,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemFileRevisionProbeResponse {
    pub revision: Option<String>,
    pub missing: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn build_virtual_child_path(parent_path: &str, name: &str) -> String {
    if parent_path == "/" {
        format!("/{name}")
    } else {
        format!("{parent_path}/{name}")
    }
}

fn sort_file_system_nodes(nodes: &mut [FileSystemNode]) {
    nodes.sort_by(|left, right| {
        if left.kind != right.kind {
            return if left.kind == "directory" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        left.name.cmp(&right.name)
    });
}

fn build_directory_entry_node(
    entry_name: String,
    entry_type: &fs::FileType,
    entry_virtual_path: &str,
) -> Option<FileSystemNode> {
    if entry_type.is_dir() {
        return Some(FileSystemNode {
            name: entry_name,
            kind: "directory".to_string(),
            path: entry_virtual_path.to_string(),
            children: None,
        });
    }
    if entry_type.is_file() {
        return Some(FileSystemNode {
            name: entry_name,
            kind: "file".to_string(),
            path: entry_virtual_path.to_string(),
            children: None,
        });
    }
    None
}

pub(crate) fn resolve_root_directory_path(root_path: &str) -> Result<PathBuf, String> {
    let normalized_root_path = root_path.trim();
    if normalized_root_path.is_empty() {
        return Err("root path must not be empty".to_string());
    }
    let root_directory = PathBuf::from(normalized_root_path);
    if !root_directory.exists() {
        return Err(format!(
            "mounted root directory does not exist: {}",
            root_directory.display()
        ));
    }
    if !root_directory.is_dir() {
        return Err(format!(
            "mounted root path must be a directory: {}",
            root_directory.display()
        ));
    }
    let canonical_root = root_directory
        .canonicalize()
        .map_err(|error| format!("failed to canonicalize mounted root path: {error}"))?;
    if !is_allowed_fs_root(&canonical_root) {
        return Err(format!(
            "mounted root path is not registered for desktop filesystem access: {}",
            canonical_root.display()
        ));
    }
    Ok(canonical_root)
}

pub(crate) fn resolve_allowed_existing_path(path: &str) -> Result<PathBuf, String> {
    let normalized_path = path.trim();
    if normalized_path.is_empty() {
        return Err("path must not be empty".to_string());
    }

    let target_path = PathBuf::from(normalized_path);
    let canonical_path = target_path
        .canonicalize()
        .map_err(|_| "path does not exist or cannot be resolved".to_string())?;
    if !canonical_path.is_file() && !canonical_path.is_dir() {
        return Err("path must target an existing file or directory".to_string());
    }
    if !is_allowed_fs_root(&canonical_path) {
        return Err("path is not registered for desktop filesystem access".to_string());
    }

    Ok(canonical_path)
}

fn resolve_root_directory_name(root_directory: &Path) -> String {
    root_directory
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.to_string())
        .unwrap_or_else(|| "mounted-folder".to_string())
}

fn normalize_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let trimmed_relative_path = relative_path.trim();
    if trimmed_relative_path.is_empty() {
        return Err("relative path must not be empty".to_string());
    }
    let mut normalized_path = PathBuf::new();
    for component in Path::new(trimmed_relative_path).components() {
        match component {
            Component::CurDir => {}
            Component::Normal(value) => normalized_path.push(value),
            Component::ParentDir => {
                return Err("relative path must not traverse outside the mounted root".to_string())
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("relative path must stay relative to the mounted root".to_string())
            }
        }
    }
    if normalized_path.as_os_str().is_empty() {
        return Err("relative path must not be empty".to_string());
    }
    Ok(normalized_path)
}

fn build_virtual_path_from_relative(root_virtual_path: &str, relative_path: &Path) -> String {
    let normalized_root_virtual_path =
        if root_virtual_path.ends_with('/') && root_virtual_path.len() > 1 {
            &root_virtual_path[..root_virtual_path.len() - 1]
        } else {
            root_virtual_path
        };
    let mut virtual_path = normalized_root_virtual_path.to_string();
    for component in relative_path.components() {
        if let Component::Normal(value) = component {
            virtual_path.push('/');
            virtual_path.push_str(&value.to_string_lossy());
        }
    }
    virtual_path
}

fn resolve_scoped_path(root_path: &str, relative_path: &str) -> Result<PathBuf, String> {
    let root_directory = resolve_root_directory_path(root_path)?;
    let normalized_relative_path = normalize_relative_path(relative_path)?;
    let target_path = root_directory.join(normalized_relative_path);
    resolve_path_within_root(&root_directory, &target_path).map_err(|error| error.to_string())
}

#[cfg(windows)]
fn metadata_is_link_like(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
    metadata.file_type().is_symlink()
        || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn metadata_is_link_like(metadata: &fs::Metadata) -> bool {
    metadata.file_type().is_symlink()
}

/// Canonicalizes the nearest existing ancestor and reattaches any missing
/// path suffix only after proving the ancestor remains inside `root_canonical`.
/// This keeps missing-file probes working while rejecting symlink/junction
/// escapes for reads, listings, revisions, and mutations.
fn resolve_path_within_root(
    root_canonical: &Path,
    target_path: &Path,
) -> Result<PathBuf, FilesystemError> {
    if !target_path.starts_with(root_canonical) {
        return Err(FilesystemError::PathTraversal);
    }

    let mut candidate = target_path.to_path_buf();
    let mut missing_suffix = Vec::<OsString>::new();
    loop {
        match fs::symlink_metadata(&candidate) {
            Ok(_) => {
                let mut resolved = candidate
                    .canonicalize()
                    .map_err(|_| FilesystemError::UnresolvablePath)?;
                if !resolved.starts_with(root_canonical) {
                    return Err(FilesystemError::PathTraversal);
                }
                for component in missing_suffix.iter().rev() {
                    resolved.push(component);
                }
                if !resolved.starts_with(root_canonical) {
                    return Err(FilesystemError::PathTraversal);
                }
                return Ok(resolved);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let file_name = candidate
                    .file_name()
                    .ok_or(FilesystemError::PathTraversal)?;
                missing_suffix.push(file_name.to_os_string());
                candidate = candidate
                    .parent()
                    .ok_or(FilesystemError::PathTraversal)?
                    .to_path_buf();
            }
            Err(_) => return Err(FilesystemError::UnresolvablePath),
        }
    }
}

/// Validates that a mutation target stays within the allowed workspace root.
/// Target symlinks and Windows reparse points are rejected because delete,
/// rename, and truncate semantics must never act on an aliased entry.
fn validate_mutation_path(
    root_canonical: &Path,
    target_path: &Path,
) -> Result<PathBuf, FilesystemError> {
    if let Ok(metadata) = fs::symlink_metadata(target_path) {
        if metadata_is_link_like(&metadata) {
            return Err(FilesystemError::SymlinkDetected);
        }
    }
    resolve_path_within_root(root_canonical, target_path)
}

/// Resolves a scoped path and applies symlink / path-traversal validation
/// for mutating operations (write, delete, rename).
fn resolve_and_validate_mutation_path(
    root_path: &str,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let root_directory = resolve_root_directory_path(root_path)?;
    let normalized_relative_path = normalize_relative_path(relative_path)?;
    let target_path = root_directory.join(&normalized_relative_path);
    validate_mutation_path(&root_directory, &target_path).map_err(|error| error.to_string())
}

fn resolve_user_home_config_path(relative_path: &str) -> Result<PathBuf, String> {
    let home_directory = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .ok_or_else(|| "failed to resolve user home directory".to_string())?;
    resolve_user_home_config_path_from_home(&home_directory, relative_path)
}

fn normalize_user_home_config_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let normalized_relative_path = normalize_relative_path(relative_path)?;
    if !normalized_relative_path.starts_with(USER_HOME_CONFIG_RELATIVE_ROOT) {
        return Err(format!(
            "user home config path must stay under {USER_HOME_CONFIG_RELATIVE_ROOT}"
        ));
    }
    if normalized_relative_path == Path::new(USER_HOME_CONFIG_RELATIVE_ROOT) {
        return Err(format!(
            "user home config path must target a file under {USER_HOME_CONFIG_RELATIVE_ROOT}"
        ));
    }
    Ok(normalized_relative_path)
}

fn validate_optional_directory_path(path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata_is_link_like(&metadata) => {
            Err(FilesystemError::SymlinkDetected.to_string())
        }
        Ok(metadata) if metadata.is_dir() => Ok(()),
        Ok(_) => Err("user config directory path is not a directory".to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(FilesystemError::UnresolvablePath.to_string()),
    }
}

fn validate_link_free_existing_path(root: &Path, relative_path: &Path) -> Result<(), String> {
    let mut current_path = root.to_path_buf();
    let components = relative_path.components().collect::<Vec<_>>();
    for (index, component) in components.iter().enumerate() {
        let Component::Normal(component) = component else {
            return Err(FilesystemError::PathTraversal.to_string());
        };
        current_path.push(component);
        match fs::symlink_metadata(&current_path) {
            Ok(metadata) => {
                if metadata_is_link_like(&metadata) {
                    return Err(FilesystemError::SymlinkDetected.to_string());
                }
                if index + 1 < components.len() && !metadata.is_dir() {
                    return Err("user config path has a non-directory parent".to_string());
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(_) => return Err(FilesystemError::UnresolvablePath.to_string()),
        }
    }
    Ok(())
}

fn resolve_user_home_config_path_from_home(
    home_directory: &Path,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let normalized_relative_path = normalize_user_home_config_relative_path(relative_path)?;
    let canonical_home = home_directory
        .canonicalize()
        .map_err(|_| "failed to resolve user home directory safely".to_string())?;
    let sdkwork_directory = canonical_home.join(".sdkwork");
    let config_root = sdkwork_directory.join("birdcoder");
    validate_optional_directory_path(&sdkwork_directory)?;
    validate_optional_directory_path(&config_root)?;

    let relative_config_path = normalized_relative_path
        .strip_prefix(USER_HOME_CONFIG_RELATIVE_ROOT)
        .map_err(|_| "user home config path is outside the BirdCoder config root".to_string())?;
    if config_root.exists() {
        let canonical_config_root = config_root
            .canonicalize()
            .map_err(|_| "failed to resolve BirdCoder user config directory safely".to_string())?;
        if !canonical_config_root.starts_with(&canonical_home) {
            return Err(FilesystemError::PathTraversal.to_string());
        }
        validate_link_free_existing_path(&canonical_config_root, relative_config_path)?;
        return resolve_path_within_root(
            &canonical_config_root,
            &canonical_config_root.join(relative_config_path),
        )
        .map_err(|error| error.to_string());
    }

    validate_link_free_existing_path(&canonical_home, &normalized_relative_path)?;
    resolve_path_within_root(
        &canonical_home,
        &canonical_home.join(normalized_relative_path),
    )
    .map_err(|error| error.to_string())
}

fn ensure_scoped_directory_chain(
    root_canonical: &Path,
    relative_path: &Path,
) -> Result<PathBuf, String> {
    let mut current_directory = root_canonical.to_path_buf();
    for component in relative_path.components() {
        let Component::Normal(component) = component else {
            return Err(FilesystemError::PathTraversal.to_string());
        };
        current_directory.push(component);
        match fs::symlink_metadata(&current_directory) {
            Ok(metadata) => {
                if metadata_is_link_like(&metadata) {
                    return Err(FilesystemError::SymlinkDetected.to_string());
                }
                if !metadata.is_dir() {
                    return Err("user config directory path is not a directory".to_string());
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                fs::create_dir(&current_directory)
                    .map_err(|_| "failed to create user config directory".to_string())?;
            }
            Err(_) => return Err(FilesystemError::UnresolvablePath.to_string()),
        }
        let canonical_directory = current_directory
            .canonicalize()
            .map_err(|_| FilesystemError::UnresolvablePath.to_string())?;
        if !canonical_directory.starts_with(root_canonical) {
            return Err(FilesystemError::PathTraversal.to_string());
        }
        current_directory = canonical_directory;
    }
    Ok(current_directory)
}

fn prepare_user_home_config_write_path_from_home(
    home_directory: &Path,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let normalized_relative_path = normalize_user_home_config_relative_path(relative_path)?;
    let canonical_home = home_directory
        .canonicalize()
        .map_err(|_| "failed to resolve user home directory safely".to_string())?;
    let canonical_config_root =
        ensure_scoped_directory_chain(&canonical_home, Path::new(USER_HOME_CONFIG_RELATIVE_ROOT))?;
    let relative_config_path = normalized_relative_path
        .strip_prefix(USER_HOME_CONFIG_RELATIVE_ROOT)
        .map_err(|_| "user home config path is outside the BirdCoder config root".to_string())?;
    let file_name = relative_config_path
        .file_name()
        .ok_or_else(|| "user home config path must target a file".to_string())?;
    let parent_relative_path = relative_config_path
        .parent()
        .unwrap_or_else(|| Path::new(""));
    let parent_directory =
        ensure_scoped_directory_chain(&canonical_config_root, parent_relative_path)?;
    let target_path = parent_directory.join(file_name);
    if let Ok(metadata) = fs::symlink_metadata(&target_path) {
        if metadata_is_link_like(&metadata) {
            return Err(FilesystemError::SymlinkDetected.to_string());
        }
        if !metadata.is_file() {
            return Err("user home config path is not a file".to_string());
        }
    }
    resolve_path_within_root(&canonical_config_root, &target_path)
        .map_err(|error| error.to_string())
}

fn build_directory_listing(
    directory_path: &Path,
    virtual_path: &str,
) -> Result<FileSystemNode, String> {
    let mut children = Vec::new();
    let entries = fs::read_dir(directory_path).map_err(|error| {
        format!(
            "failed to enumerate directory '{}': {error}",
            directory_path.display()
        )
    })?;
    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "failed to inspect directory entry '{}': {error}",
                directory_path.display()
            )
        })?;
        let entry_name = entry.file_name().to_string_lossy().to_string();
        let entry_type = entry.file_type().map_err(|error| {
            format!(
                "failed to inspect entry type '{}': {error}",
                entry.path().display()
            )
        })?;
        let child_virtual_path = build_virtual_child_path(virtual_path, &entry_name);
        if let Some(child) =
            build_directory_entry_node(entry_name, &entry_type, &child_virtual_path)
        {
            children.push(child);
        }
    }
    sort_file_system_nodes(&mut children);
    Ok(FileSystemNode {
        name: resolve_root_directory_name(directory_path),
        kind: "directory".to_string(),
        path: virtual_path.to_string(),
        children: Some(children),
    })
}

/// Maximum recursion depth for directory snapshots. Prevents stack overflow
/// from deeply nested directories or symlink loops.
const MAX_DIRECTORY_SNAPSHOT_DEPTH: usize = 10;
const DEFAULT_DIRECTORY_SNAPSHOT_MAX_NODES: usize = 20_000;
const MAX_DIRECTORY_SNAPSHOT_MAX_NODES: usize = 100_000;

struct DirectorySnapshotBudget {
    limit_reached: bool,
    max_nodes: usize,
    visited_nodes: usize,
}

fn resolve_directory_snapshot_max_nodes(max_nodes: Option<usize>) -> Result<usize, String> {
    match max_nodes {
        Some(0) => Err("max_nodes must be greater than zero".to_string()),
        Some(value) => Ok(value.min(MAX_DIRECTORY_SNAPSHOT_MAX_NODES)),
        None => Ok(DEFAULT_DIRECTORY_SNAPSHOT_MAX_NODES),
    }
}

fn build_directory_snapshot(
    directory_path: &Path,
    virtual_path: &str,
    depth: usize,
    budget: &mut DirectorySnapshotBudget,
) -> Result<FileSystemNode, String> {
    let mut children = Vec::new();
    let entries = fs::read_dir(directory_path).map_err(|error| {
        format!(
            "failed to enumerate directory '{}': {error}",
            directory_path.display()
        )
    })?;
    for entry in entries {
        if budget.visited_nodes >= budget.max_nodes {
            budget.limit_reached = true;
            break;
        }

        let entry = entry.map_err(|error| {
            format!(
                "failed to inspect directory entry '{}': {error}",
                directory_path.display()
            )
        })?;
        budget.visited_nodes += 1;
        let entry_path = entry.path();
        let entry_name = entry.file_name().to_string_lossy().to_string();
        let entry_type = entry.file_type().map_err(|error| {
            format!(
                "failed to inspect entry type '{}': {error}",
                entry_path.display()
            )
        })?;
        let child_virtual_path = build_virtual_child_path(virtual_path, &entry_name);
        if entry_type.is_dir() {
            // Stop recursing when the maximum depth is reached. The directory
            // node is included with `children: None` to signal truncation.
            if depth + 1 < MAX_DIRECTORY_SNAPSHOT_DEPTH {
                children.push(build_directory_snapshot(
                    &entry_path,
                    &child_virtual_path,
                    depth + 1,
                    budget,
                )?);
            } else {
                budget.limit_reached = true;
                children.push(FileSystemNode {
                    name: entry_name,
                    kind: "directory".to_string(),
                    path: child_virtual_path,
                    children: None,
                });
            }
        } else if entry_type.is_file() {
            children.push(FileSystemNode {
                name: entry_name,
                kind: "file".to_string(),
                path: child_virtual_path,
                children: None,
            });
        }

        if budget.limit_reached {
            break;
        }
    }
    sort_file_system_nodes(&mut children);
    Ok(FileSystemNode {
        name: resolve_root_directory_name(directory_path),
        kind: "directory".to_string(),
        path: virtual_path.to_string(),
        children: Some(children),
    })
}

const DEFAULT_FS_READ_FILE_MAX_BYTES: usize = 8 * 1024 * 1024;

fn read_mounted_file_to_string(
    file_path: &Path,
    max_bytes: Option<usize>,
) -> Result<String, String> {
    use std::io::Read;
    if let Some(max_bytes) = max_bytes {
        if max_bytes == 0 {
            return Err("max_bytes must be greater than zero".to_string());
        }
        let file = fs::File::open(file_path).map_err(|error| {
            format!(
                "failed to open mounted file '{}': {error}",
                file_path.display()
            )
        })?;
        let mut buffer = Vec::with_capacity(max_bytes.min(64 * 1024));
        file.take(max_bytes as u64)
            .read_to_end(&mut buffer)
            .map_err(|error| {
                format!(
                    "failed to read mounted file prefix '{}': {error}",
                    file_path.display()
                )
            })?;
        return Ok(String::from_utf8_lossy(&buffer).into_owned());
    }

    let metadata = fs::metadata(file_path).map_err(|error| {
        format!(
            "failed to inspect mounted file '{}': {error}",
            file_path.display()
        )
    })?;
    if metadata.len() > DEFAULT_FS_READ_FILE_MAX_BYTES as u64 {
        return Err(format!(
            "mounted file '{}' is {} bytes and exceeds the {} byte text editor limit",
            file_path.display(),
            metadata.len(),
            DEFAULT_FS_READ_FILE_MAX_BYTES
        ));
    }

    let bytes = fs::read(file_path).map_err(|error| {
        format!(
            "failed to read mounted file '{}': {error}",
            file_path.display()
        )
    })?;
    String::from_utf8(bytes).map_err(|_| {
        format!(
            "mounted file '{}' is not valid UTF-8 text and cannot be opened in the text editor",
            file_path.display()
        )
    })
}

fn build_entry_revision(metadata: &fs::Metadata) -> Result<String, String> {
    let modified_nanos = metadata
        .modified()
        .map_err(|error| format!("failed to inspect mounted file modified time: {error}"))?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("mounted file modified time is before unix epoch: {error}"))?
        .as_nanos();
    Ok(format!("{}:{}", modified_nanos, metadata.len()))
}

#[tauri::command]
pub async fn fs_snapshot_folder(
    root_path: String,
    max_nodes: Option<usize>,
) -> Result<FileSystemSnapshotResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root_directory = resolve_root_directory_path(&root_path)?;
        let root_virtual_path = format!("/{}", resolve_root_directory_name(&root_directory));
        let mut budget = DirectorySnapshotBudget {
            limit_reached: false,
            max_nodes: resolve_directory_snapshot_max_nodes(max_nodes)?,
            visited_nodes: 0,
        };
        let tree = build_directory_snapshot(&root_directory, &root_virtual_path, 0, &mut budget)?;
        Ok(FileSystemSnapshotResponse {
            root_virtual_path,
            tree,
            limit_reached: budget.limit_reached,
        })
    })
    .await
    .map_err(|error| format!("failed to join folder snapshot task: {error}"))?
}

#[tauri::command]
pub async fn fs_list_directory(
    root_path: String,
    relative_path: Option<String>,
) -> Result<FileSystemDirectoryListingResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root_directory = resolve_root_directory_path(&root_path)?;
        let root_virtual_path = format!("/{}", resolve_root_directory_name(&root_directory));
        let target_relative_path = relative_path
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(normalize_relative_path)
            .transpose()?;
        let target_directory = if let Some(ref normalized_relative_path) = target_relative_path {
            resolve_path_within_root(
                &root_directory,
                &root_directory.join(normalized_relative_path),
            )
            .map_err(|error| error.to_string())?
        } else {
            root_directory.clone()
        };
        if !target_directory.exists() {
            return Err(format!(
                "mounted directory does not exist: {}",
                target_directory.display()
            ));
        }
        if !target_directory.is_dir() {
            return Err(format!(
                "mounted path must be a directory: {}",
                target_directory.display()
            ));
        }
        let directory_virtual_path =
            if let Some(ref normalized_relative_path) = target_relative_path {
                build_virtual_path_from_relative(&root_virtual_path, normalized_relative_path)
            } else {
                root_virtual_path.clone()
            };
        let directory = build_directory_listing(&target_directory, &directory_virtual_path)?;
        Ok(FileSystemDirectoryListingResponse {
            root_virtual_path,
            directory,
        })
    })
    .await
    .map_err(|error| format!("failed to join directory listing task: {error}"))?
}

#[tauri::command]
pub async fn fs_read_file(
    root_path: String,
    relative_path: String,
    max_bytes: Option<usize>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_scoped_path(&root_path, &relative_path)?;
        read_mounted_file_to_string(&file_path, max_bytes)
    })
    .await
    .map_err(|error| format!("failed to join mounted file read task: {error}"))?
}

#[tauri::command]
pub async fn fs_get_file_revision(
    root_path: String,
    relative_path: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_scoped_path(&root_path, &relative_path)?;
        let metadata = fs::metadata(&file_path).map_err(|error| {
            format!(
                "failed to inspect mounted file '{}': {error}",
                file_path.display()
            )
        })?;
        if !metadata.is_file() {
            return Err(format!(
                "mounted path must be a file: {}",
                file_path.display()
            ));
        }
        build_entry_revision(&metadata)
    })
    .await
    .map_err(|error| format!("failed to join mounted file revision task: {error}"))?
}

#[tauri::command]
pub async fn fs_get_file_revisions(
    root_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<FileSystemFileRevisionProbeResponse>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut probes = Vec::with_capacity(relative_paths.len());
        for relative_path in relative_paths {
            let file_path = match resolve_scoped_path(&root_path, &relative_path) {
                Ok(file_path) => file_path,
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(error),
                    });
                    continue;
                }
            };
            let metadata = match fs::metadata(&file_path) {
                Ok(metadata) => metadata,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: true,
                        error: None,
                    });
                    continue;
                }
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(format!(
                            "failed to inspect mounted file '{}': {error}",
                            file_path.display()
                        )),
                    });
                    continue;
                }
            };
            if !metadata.is_file() {
                probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(format!(
                        "mounted path must be a file: {}",
                        file_path.display()
                    )),
                });
                continue;
            }
            match build_entry_revision(&metadata) {
                Ok(revision) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: Some(revision),
                    missing: false,
                    error: None,
                }),
                Err(error) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(error),
                }),
            }
        }
        Ok(probes)
    })
    .await
    .map_err(|error| format!("failed to join mounted file revisions task: {error}"))?
}

#[tauri::command]
pub async fn fs_get_directory_revisions(
    root_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<FileSystemFileRevisionProbeResponse>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut probes = Vec::with_capacity(relative_paths.len());
        for relative_path in relative_paths {
            let directory_path = match resolve_scoped_path(&root_path, &relative_path) {
                Ok(path) => path,
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(error),
                    });
                    continue;
                }
            };
            let metadata = match fs::metadata(&directory_path) {
                Ok(metadata) => metadata,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: true,
                        error: None,
                    });
                    continue;
                }
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(format!(
                            "failed to inspect mounted directory '{}': {error}",
                            directory_path.display()
                        )),
                    });
                    continue;
                }
            };
            if !metadata.is_dir() {
                probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(format!(
                        "mounted path must be a directory: {}",
                        directory_path.display()
                    )),
                });
                continue;
            }
            match build_entry_revision(&metadata) {
                Ok(revision) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: Some(revision),
                    missing: false,
                    error: None,
                }),
                Err(error) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(error),
                }),
            }
        }
        Ok(probes)
    })
    .await
    .map_err(|error| format!("failed to join mounted directory revisions task: {error}"))?
}

#[tauri::command]
pub async fn fs_write_file(
    root_path: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_and_validate_mutation_path(&root_path, &relative_path)?;
        fs::write(&file_path, content).map_err(|error| {
            format!(
                "failed to write mounted file '{}': {error}",
                file_path.display()
            )
        })
    })
    .await
    .map_err(|error| format!("failed to join mounted file write task: {error}"))?
}

#[tauri::command]
pub async fn fs_create_file(root_path: String, relative_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_and_validate_mutation_path(&root_path, &relative_path)?;
        if file_path.exists() {
            return Err(format!(
                "cannot create file because an entry already exists at '{}'",
                file_path.display()
            ));
        }
        let parent_directory = file_path.parent().ok_or_else(|| {
            format!(
                "cannot create mounted file without a parent directory: {}",
                file_path.display()
            )
        })?;
        if !parent_directory.exists() {
            return Err(format!(
                "parent directory does not exist for mounted file '{}'",
                file_path.display()
            ));
        }
        fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(false)
            .open(&file_path)
            .map_err(|error| {
                format!(
                    "failed to create mounted file '{}': {error}",
                    file_path.display()
                )
            })?;
        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted file create task: {error}"))?
}

#[tauri::command]
pub async fn fs_create_directory(root_path: String, relative_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory_path = resolve_and_validate_mutation_path(&root_path, &relative_path)?;
        if directory_path.exists() {
            return Err(format!(
                "cannot create directory because an entry already exists at '{}'",
                directory_path.display()
            ));
        }
        let parent_directory = directory_path.parent().ok_or_else(|| {
            format!(
                "cannot create mounted directory without a parent directory: {}",
                directory_path.display()
            )
        })?;
        if !parent_directory.exists() {
            return Err(format!(
                "parent directory does not exist for mounted directory '{}'",
                directory_path.display()
            ));
        }
        fs::create_dir(&directory_path).map_err(|error| {
            format!(
                "failed to create mounted directory '{}': {error}",
                directory_path.display()
            )
        })?;
        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted directory create task: {error}"))?
}

#[tauri::command]
pub async fn fs_delete_entry(
    root_path: String,
    relative_path: String,
    recursive: bool,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry_path = resolve_and_validate_mutation_path(&root_path, &relative_path)?;
        let metadata = fs::metadata(&entry_path).map_err(|error| {
            format!(
                "failed to inspect mounted entry '{}': {error}",
                entry_path.display()
            )
        })?;
        if metadata.is_dir() {
            if recursive {
                fs::remove_dir_all(&entry_path).map_err(|error| {
                    format!(
                        "failed to delete mounted directory '{}': {error}",
                        entry_path.display()
                    )
                })?;
            } else {
                fs::remove_dir(&entry_path).map_err(|error| {
                    format!(
                        "failed to delete mounted directory '{}': {error}",
                        entry_path.display()
                    )
                })?;
            }
        } else {
            fs::remove_file(&entry_path).map_err(|error| {
                format!(
                    "failed to delete mounted file '{}': {error}",
                    entry_path.display()
                )
            })?;
        }
        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted entry delete task: {error}"))?
}

#[tauri::command]
pub async fn fs_rename_entry(
    root_path: String,
    old_relative_path: String,
    new_relative_path: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let old_path = resolve_and_validate_mutation_path(&root_path, &old_relative_path)?;
        let new_path = resolve_and_validate_mutation_path(&root_path, &new_relative_path)?;
        if old_path == new_path {
            return Ok(());
        }
        if new_path.exists() {
            return Err(format!(
                "cannot rename mounted entry because the destination already exists: {}",
                new_path.display()
            ));
        }
        let new_parent_directory = new_path.parent().ok_or_else(|| {
            format!(
                "cannot rename mounted entry without a destination parent directory: {}",
                new_path.display()
            )
        })?;
        if !new_parent_directory.exists() {
            return Err(format!(
                "destination parent directory does not exist for mounted entry '{}'",
                new_path.display()
            ));
        }
        fs::rename(&old_path, &new_path).map_err(|error| {
            format!(
                "failed to rename mounted entry '{}' to '{}': {error}",
                old_path.display(),
                new_path.display()
            )
        })?;
        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted entry rename task: {error}"))?
}

#[tauri::command]
pub async fn user_home_config_read(relative_path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = resolve_user_home_config_path(&relative_path)?;
        if !path.exists() {
            return Ok(None);
        }
        if !path.is_file() {
            return Err("user home config path is not a file".to_string());
        }
        fs::read_to_string(&path)
            .map(Some)
            .map_err(|_| "failed to read user home config".to_string())
    })
    .await
    .map_err(|error| format!("failed to join user home config read task: {error}"))?
}

#[tauri::command]
pub async fn user_home_config_write(relative_path: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let home_directory = std::env::var_os("USERPROFILE")
            .or_else(|| std::env::var_os("HOME"))
            .map(PathBuf::from)
            .ok_or_else(|| "failed to resolve user home directory".to_string())?;
        let path = prepare_user_home_config_write_path_from_home(&home_directory, &relative_path)?;
        fs::write(&path, content).map_err(|_| "failed to write user home config".to_string())
    })
    .await
    .map_err(|error| format!("failed to join user home config write task: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_filesystem_command_test_root(label: &str) -> PathBuf {
        let nonce = std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("test clock must be after the Unix epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-filesystem-{label}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).expect("filesystem command test root must be created");
        register_allowed_fs_root(root.clone())
            .expect("filesystem command test root must be registered");
        root
    }

    #[cfg(unix)]
    fn try_create_directory_link(target: &Path, link: &Path) -> bool {
        std::os::unix::fs::symlink(target, link).is_ok()
    }

    #[cfg(windows)]
    fn try_create_directory_link(target: &Path, link: &Path) -> bool {
        std::os::windows::fs::symlink_dir(target, link).is_ok()
    }

    #[cfg(unix)]
    fn remove_directory_link(link: &Path) {
        let _ = fs::remove_file(link);
    }

    #[cfg(windows)]
    fn remove_directory_link(link: &Path) {
        let _ = fs::remove_dir(link);
    }

    #[test]
    fn user_home_config_path_is_scoped_to_birdcoder_config_root() {
        let resolved_path =
            resolve_user_home_config_path(".sdkwork/birdcoder/code-engine-models.json")
                .expect("canonical code-engine model config path should be allowed");

        assert!(resolved_path.ends_with(".sdkwork/birdcoder/code-engine-models.json"));
        assert!(resolve_user_home_config_path(".ssh/config").is_err());
    }

    #[tokio::test]
    async fn mounted_commands_reject_symlink_or_junction_escape() {
        let root = create_filesystem_command_test_root("scoped-link-root");
        let outside = create_filesystem_command_test_root("scoped-link-outside");
        fs::write(outside.join("secret.txt"), "outside").expect("outside fixture must be written");
        let link = root.join("escape");
        if !try_create_directory_link(&outside, &link) {
            fs::remove_dir_all(root).expect("filesystem command test root must be removed");
            fs::remove_dir_all(outside).expect("outside fixture root must be removed");
            return;
        }

        let root_path = root.to_string_lossy().into_owned();
        for error in [
            fs_read_file(root_path.clone(), "escape/secret.txt".to_string(), None)
                .await
                .expect_err("reads through an escaping link must fail"),
            fs_get_file_revision(root_path.clone(), "escape/secret.txt".to_string())
                .await
                .expect_err("revision probes through an escaping link must fail"),
            fs_list_directory(root_path.clone(), Some("escape".to_string()))
                .await
                .expect_err("directory listings through an escaping link must fail"),
            fs_create_file(root_path.clone(), "escape/new.txt".to_string())
                .await
                .expect_err("file creation through an escaping link must fail"),
            fs_create_directory(root_path, "escape/new-directory".to_string())
                .await
                .expect_err("directory creation through an escaping link must fail"),
        ] {
            assert!(
                error.contains("escapes the allowed filesystem root"),
                "unexpected scoped path error: {error}"
            );
        }

        assert_eq!(
            fs::read_to_string(outside.join("secret.txt"))
                .expect("outside fixture must remain readable"),
            "outside"
        );
        assert!(!outside.join("new.txt").exists());
        assert!(!outside.join("new-directory").exists());
        remove_directory_link(&link);
        fs::remove_dir_all(root).expect("filesystem command test root must be removed");
        fs::remove_dir_all(outside).expect("outside fixture root must be removed");
    }

    #[test]
    fn user_home_config_rejects_linked_config_root() {
        let home = create_filesystem_command_test_root("user-config-home");
        let outside = create_filesystem_command_test_root("user-config-outside");
        let sdkwork_directory = home.join(".sdkwork");
        fs::create_dir(&sdkwork_directory).expect("sdkwork fixture directory must be created");
        let config_link = sdkwork_directory.join("birdcoder");
        if !try_create_directory_link(&outside, &config_link) {
            fs::remove_dir_all(home).expect("user config home fixture must be removed");
            fs::remove_dir_all(outside).expect("outside fixture root must be removed");
            return;
        }

        let relative_path = ".sdkwork/birdcoder/code-engine-models.json";
        let read_error = resolve_user_home_config_path_from_home(&home, relative_path)
            .expect_err("linked user config roots must not be readable");
        let write_error = prepare_user_home_config_write_path_from_home(&home, relative_path)
            .expect_err("linked user config roots must not be writable");
        assert!(read_error.contains("link or reparse point"));
        assert!(write_error.contains("link or reparse point"));
        assert!(!outside.join("code-engine-models.json").exists());

        remove_directory_link(&config_link);
        fs::remove_dir_all(home).expect("user config home fixture must be removed");
        fs::remove_dir_all(outside).expect("outside fixture root must be removed");
    }

    #[test]
    fn user_home_config_write_path_creates_only_scoped_directories() {
        let home = create_filesystem_command_test_root("user-config-create");
        let path = prepare_user_home_config_write_path_from_home(
            &home,
            ".sdkwork/birdcoder/nested/code-engine-models.json",
        )
        .expect("scoped user config directories should be created");

        let canonical_home = home
            .canonicalize()
            .expect("user config home fixture must canonicalize");
        assert!(path.starts_with(canonical_home.join(".sdkwork").join("birdcoder")));
        assert!(path
            .parent()
            .expect("user config file must have a parent")
            .is_dir());
        fs::remove_dir_all(home).expect("user config home fixture must be removed");
    }

    #[tokio::test]
    async fn create_file_rejects_an_existing_entry_without_truncating_it() {
        let root = create_filesystem_command_test_root("create-file-conflict");
        let existing_file = root.join("existing.txt");
        fs::write(&existing_file, "keep-me").expect("existing file fixture must be written");

        let error = fs_create_file(
            root.to_string_lossy().into_owned(),
            "existing.txt".to_string(),
        )
        .await
        .expect_err("creating an existing file must fail");

        assert!(error.contains("already exists"));
        assert_eq!(
            fs::read_to_string(&existing_file).expect("existing file must remain readable"),
            "keep-me"
        );
        fs::remove_dir_all(root).expect("filesystem command test root must be removed");
    }

    #[tokio::test]
    async fn create_directory_rejects_an_existing_directory() {
        let root = create_filesystem_command_test_root("create-directory-conflict");
        fs::create_dir(root.join("existing")).expect("existing directory fixture must be created");

        let error =
            fs_create_directory(root.to_string_lossy().into_owned(), "existing".to_string())
                .await
                .expect_err("creating an existing directory must fail");

        assert!(error.contains("already exists"));
        fs::remove_dir_all(root).expect("filesystem command test root must be removed");
    }

    #[tokio::test]
    async fn rename_rejects_an_existing_destination_without_overwriting_it() {
        let root = create_filesystem_command_test_root("rename-conflict");
        let source_file = root.join("source.txt");
        let destination_file = root.join("destination.txt");
        fs::write(&source_file, "source").expect("source fixture must be written");
        fs::write(&destination_file, "destination").expect("destination fixture must be written");

        let error = fs_rename_entry(
            root.to_string_lossy().into_owned(),
            "source.txt".to_string(),
            "destination.txt".to_string(),
        )
        .await
        .expect_err("renaming over an existing destination must fail");

        assert!(error.contains("destination already exists"));
        assert_eq!(
            fs::read_to_string(&source_file).expect("source file must remain readable"),
            "source"
        );
        assert_eq!(
            fs::read_to_string(&destination_file).expect("destination file must remain readable"),
            "destination"
        );
        fs::remove_dir_all(root).expect("filesystem command test root must be removed");
    }

    #[tokio::test]
    async fn editor_read_rejects_files_larger_than_the_text_limit() {
        let root = create_filesystem_command_test_root("large-editor-read");
        let file_path = root.join("large.txt");
        fs::write(&file_path, vec![b'a'; DEFAULT_FS_READ_FILE_MAX_BYTES + 1])
            .expect("large text fixture must be written");

        let error = fs_read_file(
            root.to_string_lossy().into_owned(),
            "large.txt".to_string(),
            None,
        )
        .await
        .expect_err("an oversized editor read must fail instead of returning a truncated file");

        assert!(error.contains("exceeds the"));
        assert!(error.contains("text editor limit"));
        assert_eq!(
            fs::metadata(&file_path)
                .expect("large text fixture metadata must remain readable")
                .len(),
            (DEFAULT_FS_READ_FILE_MAX_BYTES + 1) as u64
        );
        fs::remove_dir_all(root).expect("filesystem command test root must be removed");
    }

    #[tokio::test]
    async fn editor_read_rejects_non_utf8_files_without_lossy_conversion() {
        let root = create_filesystem_command_test_root("binary-editor-read");
        let file_path = root.join("binary.dat");
        fs::write(&file_path, [0xff, 0xfe, 0xfd]).expect("binary fixture must be written");

        let error = fs_read_file(
            root.to_string_lossy().into_owned(),
            "binary.dat".to_string(),
            None,
        )
        .await
        .expect_err("a binary editor read must fail instead of replacing invalid bytes");

        assert!(error.contains("not valid UTF-8 text"));
        assert_eq!(
            fs::read(&file_path).expect("binary fixture must remain readable"),
            [0xff, 0xfe, 0xfd]
        );
        fs::remove_dir_all(root).expect("filesystem command test root must be removed");
    }

    #[tokio::test]
    async fn bounded_search_read_keeps_prefix_semantics() {
        let root = create_filesystem_command_test_root("bounded-search-read");
        fs::write(root.join("search.txt"), "prefix-suffix")
            .expect("search text fixture must be written");

        let content = fs_read_file(
            root.to_string_lossy().into_owned(),
            "search.txt".to_string(),
            Some(6),
        )
        .await
        .expect("an explicit bounded read must return the requested prefix");

        assert_eq!(content, "prefix");
        fs::remove_dir_all(root).expect("filesystem command test root must be removed");
    }

    #[tokio::test]
    async fn directory_snapshot_reports_when_the_node_budget_is_reached() {
        let root = create_filesystem_command_test_root("snapshot-node-budget");
        fs::write(root.join("a.txt"), "a").expect("first snapshot fixture must be written");
        fs::write(root.join("b.txt"), "b").expect("second snapshot fixture must be written");
        fs::write(root.join("c.txt"), "c").expect("third snapshot fixture must be written");

        let snapshot = fs_snapshot_folder(root.to_string_lossy().into_owned(), Some(2))
            .await
            .expect("bounded directory snapshot must complete");

        assert!(snapshot.limit_reached);
        assert_eq!(
            snapshot
                .tree
                .children
                .as_ref()
                .expect("snapshot root must expose children")
                .len(),
            2
        );
        fs::remove_dir_all(root).expect("filesystem command test root must be removed");
    }
}
