use std::path::{Component, Path, PathBuf};

use crate::types::GitMutationError;

pub(crate) fn validate_git_branch_name(branch_name: &str) -> Result<(), GitMutationError> {
    let trimmed = branch_name.trim();
    if trimmed.is_empty() {
        return Err(GitMutationError::Mutate("branch name is required".to_owned()));
    }
    if trimmed.starts_with('-') || trimmed.contains("..") {
        return Err(GitMutationError::Mutate("invalid branch name".to_owned()));
    }
    if trimmed.chars().any(|ch| matches!(ch, '\0' | ':' | '?' | '*' | '[' | '\\' | '^' | '~')) {
        return Err(GitMutationError::Mutate("invalid branch name".to_owned()));
    }
    Ok(())
}

pub(crate) fn validate_git_remote_name(remote_name: &str) -> Result<(), GitMutationError> {
    let trimmed = remote_name.trim();
    if trimmed.is_empty() || trimmed.starts_with('-') {
        return Err(GitMutationError::Mutate("invalid remote name".to_owned()));
    }
    Ok(())
}

pub(crate) fn validate_git_worktree_path(
    project_root: &Path,
    worktree_path: &str,
) -> Result<PathBuf, GitMutationError> {
    let trimmed = worktree_path.trim();
    if trimmed.is_empty() {
        return Err(GitMutationError::Mutate("worktree path is required".to_owned()));
    }
    if trimmed.starts_with('-') {
        return Err(GitMutationError::Mutate("invalid worktree path".to_owned()));
    }

    let candidate = PathBuf::from(trimmed);
    let resolved = if candidate.is_absolute() {
        candidate
    } else {
        project_root.join(candidate)
    };

    for component in resolved.components() {
        if matches!(component, Component::ParentDir) {
            return Err(GitMutationError::Mutate(
                "worktree path must not contain parent traversal".to_owned(),
            ));
        }
    }

    let canonical_root = project_root
        .canonicalize()
        .map_err(|error| GitMutationError::Mutate(error.to_string()))?;

    if resolved.is_absolute() {
        if let Ok(canonical_worktree) = resolved.canonicalize() {
            if !canonical_worktree.starts_with(&canonical_root) {
                return Err(GitMutationError::Mutate(
                    "worktree path must stay within the repository".to_owned(),
                ));
            }
        } else if let Some(parent) = resolved.parent() {
            let parent = parent
                .canonicalize()
                .map_err(|error| GitMutationError::Mutate(error.to_string()))?;
            if !parent.starts_with(&canonical_root) {
                return Err(GitMutationError::Mutate(
                    "worktree path must stay within the repository".to_owned(),
                ));
            }
        }
    } else if !canonical_root.join(&resolved).starts_with(&canonical_root) {
        return Err(GitMutationError::Mutate(
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
