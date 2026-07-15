use std::path::{Component, Path, PathBuf};

use crate::types::GitMutationError;

pub(crate) fn validate_git_branch_name(branch_name: &str) -> Result<(), GitMutationError> {
    let trimmed = branch_name.trim();
    let is_invalid = trimmed.is_empty()
        || trimmed.starts_with('-')
        || trimmed.starts_with('.')
        || trimmed.ends_with('/')
        || trimmed.ends_with('.')
        || trimmed.ends_with(".lock")
        || trimmed.contains("..")
        || trimmed.contains("@{")
        || trimmed.contains("//")
        || trimmed.chars().any(|ch| {
            ch.is_control()
                || ch.is_whitespace()
                || matches!(ch, ':' | '?' | '*' | '[' | '\\' | '^' | '~')
        });
    if is_invalid {
        return Err(GitMutationError::Validation(
            "invalid branch name".to_owned(),
        ));
    }
    Ok(())
}

pub(crate) fn validate_git_remote_name(remote_name: &str) -> Result<(), GitMutationError> {
    let trimmed = remote_name.trim();
    if trimmed.is_empty() || trimmed.starts_with('-') || trimmed.chars().any(char::is_whitespace) {
        return Err(GitMutationError::Validation(
            "invalid remote name".to_owned(),
        ));
    }
    Ok(())
}

pub(crate) fn validate_git_worktree_path(
    project_root: &Path,
    worktree_path: &str,
) -> Result<PathBuf, GitMutationError> {
    let trimmed = worktree_path.trim();
    if trimmed.is_empty() {
        return Err(GitMutationError::Validation(
            "worktree path is required".to_owned(),
        ));
    }
    if trimmed.starts_with('-') {
        return Err(GitMutationError::Validation(
            "invalid worktree path".to_owned(),
        ));
    }

    let candidate = PathBuf::from(trimmed);
    for component in candidate.components() {
        if matches!(component, Component::ParentDir) {
            return Err(GitMutationError::Validation(
                "worktree path must not contain parent traversal".to_owned(),
            ));
        }
    }
    let resolved = if candidate.is_absolute() {
        candidate
    } else {
        project_root.join(candidate)
    };

    let canonical_root = project_root
        .canonicalize()
        .map_err(|error| GitMutationError::Mutate(error.to_string()))?;

    let boundary_path = if resolved.exists() {
        resolved
            .canonicalize()
            .map_err(|error| GitMutationError::Mutate(error.to_string()))?
    } else {
        resolved
            .parent()
            .ok_or_else(|| GitMutationError::Validation("invalid worktree path".to_owned()))?
            .canonicalize()
            .map_err(|error| GitMutationError::Mutate(error.to_string()))?
    };
    if !boundary_path.starts_with(&canonical_root) {
        return Err(GitMutationError::Validation(
            "worktree path must stay within the repository".to_owned(),
        ));
    }

    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_branch_names_that_look_like_flags() {
        assert!(validate_git_branch_name("-evil").is_err());
    }

    #[test]
    fn rejects_event_handler_like_branch_names() {
        assert!(validate_git_branch_name("feature/../main").is_err());
    }
}
