use std::fs;
use std::path::{Component, Path, PathBuf};

pub fn resolve_root_directory_path(root_path: &str) -> Result<PathBuf, String> {
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
    Ok(root_directory)
}

pub fn resolve_root_directory_name(root_directory: &Path) -> String {
    root_directory
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.to_string())
        .unwrap_or_else(|| "mounted-folder".to_string())
}

pub fn normalize_relative_path(relative_path: &str) -> Result<PathBuf, String> {
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

pub fn build_virtual_path_from_relative(root_virtual_path: &str, relative_path: &Path) -> String {
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

pub fn resolve_scoped_path(root_path: &str, relative_path: &str) -> Result<PathBuf, String> {
    let root_directory = resolve_root_directory_path(root_path)?;
    let normalized_relative_path = normalize_relative_path(relative_path)?;
    Ok(root_directory.join(normalized_relative_path))
}

pub fn ensure_parent_directory(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create parent directory '{}': {error}",
                parent.display()
            )
        })?;
    }
    Ok(())
}
