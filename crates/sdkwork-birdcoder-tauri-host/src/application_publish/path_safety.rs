use std::fs;
use std::path::{Component, Path, PathBuf};

use super::types::ApplicationPublishError;

const MAX_RELATIVE_PATH_BYTES: usize = 2_048;
const MAX_RELATIVE_PATH_COMPONENTS: usize = 64;

pub(crate) fn metadata_is_link_like(metadata: &fs::Metadata) -> bool {
    crate::commands::filesystem_commands::metadata_is_link_like(metadata)
}

fn invalid_path(message: &str) -> ApplicationPublishError {
    ApplicationPublishError::new("APPLICATION_PUBLISH_PATH_INVALID", message)
}

pub(crate) fn is_portable_component(value: &str) -> bool {
    if value.is_empty()
        || value.ends_with('.')
        || value.ends_with(' ')
        || value
            .chars()
            .any(|character| character.is_control() || r#"<>:"/\|?*"#.contains(character))
    {
        return false;
    }
    let stem = value
        .split('.')
        .next()
        .unwrap_or_default()
        .trim_end_matches(|character| character == '.' || character == ' ')
        .to_ascii_uppercase();
    if matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL") {
        return false;
    }
    !stem
        .strip_prefix("COM")
        .or_else(|| stem.strip_prefix("LPT"))
        .is_some_and(|suffix| {
            suffix.len() == 1
                && suffix
                    .as_bytes()
                    .first()
                    .is_some_and(|value| (b'1'..=b'9').contains(value))
        })
}

pub(crate) fn normalize_relative_path(
    value: &str,
    allow_root: bool,
) -> Result<PathBuf, ApplicationPublishError> {
    let value = value.trim();
    if value.is_empty() || value.len() > MAX_RELATIVE_PATH_BYTES || value.contains('\0') {
        return Err(invalid_path("A bounded relative path is required."));
    }
    let portable_value = value.replace('\\', "/");
    if portable_value.starts_with('/')
        || portable_value.starts_with("//")
        || portable_value
            .as_bytes()
            .get(1)
            .is_some_and(|value| *value == b':')
    {
        return Err(invalid_path("Absolute paths are not allowed."));
    }

    let mut normalized = PathBuf::new();
    let mut component_count = 0;
    for component in Path::new(&portable_value).components() {
        match component {
            Component::CurDir => {}
            Component::Normal(value) => {
                let value = value
                    .to_str()
                    .filter(|value| is_portable_component(value))
                    .ok_or_else(|| invalid_path("The relative path is not portable."))?;
                component_count += 1;
                if component_count > MAX_RELATIVE_PATH_COMPONENTS {
                    return Err(invalid_path("The relative path is too deeply nested."));
                }
                normalized.push(value);
            }
            Component::ParentDir => {
                return Err(invalid_path("Parent path traversal is not allowed."));
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(invalid_path("Absolute paths are not allowed."));
            }
        }
    }
    if normalized.as_os_str().is_empty() && !allow_root {
        return Err(invalid_path("A non-root relative path is required."));
    }
    Ok(normalized)
}

pub(crate) fn resolve_application_root(
    project_root: &Path,
    application_relative_path: &str,
) -> Result<PathBuf, ApplicationPublishError> {
    let relative = normalize_relative_path(application_relative_path, true)?;
    if relative.as_os_str().is_empty() {
        return Ok(project_root.to_path_buf());
    }
    let path = resolve_link_free_path(project_root, &relative, true)?;
    if !path.is_dir() {
        return Err(invalid_path(
            "The selected application root is not a directory.",
        ));
    }
    Ok(path)
}

pub(crate) fn resolve_relative_path(
    root: &Path,
    relative_path: &str,
    must_exist: bool,
) -> Result<PathBuf, ApplicationPublishError> {
    let relative = normalize_relative_path(relative_path, false)?;
    resolve_link_free_path(root, &relative, must_exist)
}

fn resolve_link_free_path(
    root: &Path,
    relative: &Path,
    must_exist: bool,
) -> Result<PathBuf, ApplicationPublishError> {
    let mut current = root.to_path_buf();
    let components = relative.components().collect::<Vec<_>>();
    for (index, component) in components.iter().enumerate() {
        let Component::Normal(component) = component else {
            return Err(invalid_path("The relative path is invalid."));
        };
        current.push(component);
        match fs::symlink_metadata(&current) {
            Ok(metadata) => {
                if metadata_is_link_like(&metadata) {
                    return Err(ApplicationPublishError::new(
                        "APPLICATION_PUBLISH_LINK_REJECTED",
                        "Links and filesystem reparse points are not allowed in publish paths.",
                    ));
                }
                if index + 1 < components.len() && !metadata.is_dir() {
                    return Err(invalid_path("A publish path parent is not a directory."));
                }
                let canonical = current
                    .canonicalize()
                    .map_err(|_| invalid_path("The publish path could not be resolved safely."))?;
                if !canonical.starts_with(root) {
                    return Err(invalid_path(
                        "The publish path escapes the application root.",
                    ));
                }
                current = canonical;
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                if must_exist {
                    return Err(ApplicationPublishError::new(
                        "APPLICATION_PUBLISH_PATH_MISSING",
                        "A required publish path does not exist.",
                    ));
                }
                for remaining in components.iter().skip(index + 1) {
                    let Component::Normal(component) = remaining else {
                        return Err(invalid_path("The relative path is invalid."));
                    };
                    current.push(component);
                }
                break;
            }
            Err(_) => {
                return Err(invalid_path(
                    "The publish path could not be inspected safely.",
                ));
            }
        }
    }
    if !current.starts_with(root) {
        return Err(invalid_path(
            "The publish path escapes the application root.",
        ));
    }
    Ok(current)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalization_rejects_portable_absolute_and_parent_paths() {
        assert!(normalize_relative_path("../outside", false).is_err());
        assert!(normalize_relative_path("C:\\outside", false).is_err());
        assert!(normalize_relative_path("/outside", false).is_err());
        assert!(normalize_relative_path("dist/file:stream", false).is_err());
        assert!(normalize_relative_path("dist/CON", false).is_err());
        assert!(normalize_relative_path("dist/trailing.", false).is_err());
        assert_eq!(
            normalize_relative_path("apps\\web", false).expect("portable relative path"),
            PathBuf::from("apps").join("web")
        );
    }
}
