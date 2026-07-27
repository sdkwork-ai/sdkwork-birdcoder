use std::{fs, path::Path};

use crate::{
    command_runner::{
        GitCommandError, GitCommandExecutor, GitCommandFailureKind, SystemGitCommandRunner,
    },
    types::GitOverviewDiagnosticCode,
};

#[derive(Debug, Clone, Copy)]
pub(crate) struct GitRepositoryProbeInput<'a> {
    pub(crate) expected_root: &'a Path,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum GitRepositoryProbeStatus {
    Ready { worktree_root: String },
    NotRepository,
    RepositoryRootMismatch,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct GitRepositoryProbeOutput {
    pub(crate) diagnostic_code: Option<GitOverviewDiagnosticCode>,
    pub(crate) status: GitRepositoryProbeStatus,
}

pub(crate) fn probe_git_repository(input: GitRepositoryProbeInput<'_>) -> GitRepositoryProbeOutput {
    probe_git_repository_with_executor(input, &SystemGitCommandRunner)
}

fn probe_git_repository_with_executor(
    input: GitRepositoryProbeInput<'_>,
    executor: &dyn GitCommandExecutor,
) -> GitRepositoryProbeOutput {
    match executor.run(&["rev-parse", "--show-toplevel"], input.expected_root, &[0]) {
        Ok(worktree_root) => classify_resolved_root(input.expected_root, worktree_root),
        Err(error) => classify_probe_error(error),
    }
}

fn classify_resolved_root(expected_root: &Path, worktree_root: String) -> GitRepositoryProbeOutput {
    let worktree_root = worktree_root.trim();
    if worktree_root.is_empty() {
        return GitRepositoryProbeOutput {
            diagnostic_code: Some(GitOverviewDiagnosticCode::GitCommandFailed),
            status: GitRepositoryProbeStatus::Unavailable,
        };
    }

    if paths_equal(expected_root, Path::new(worktree_root)) {
        GitRepositoryProbeOutput {
            diagnostic_code: None,
            status: GitRepositoryProbeStatus::Ready {
                worktree_root: worktree_root.to_owned(),
            },
        }
    } else {
        GitRepositoryProbeOutput {
            diagnostic_code: Some(GitOverviewDiagnosticCode::RepositoryRootMismatch),
            status: GitRepositoryProbeStatus::RepositoryRootMismatch,
        }
    }
}

fn classify_probe_error(error: GitCommandError) -> GitRepositoryProbeOutput {
    if error.kind == GitCommandFailureKind::ExecutableUnavailable {
        return GitRepositoryProbeOutput {
            diagnostic_code: Some(GitOverviewDiagnosticCode::GitExecutableUnavailable),
            status: GitRepositoryProbeStatus::Unavailable,
        };
    }

    if error
        .message
        .to_ascii_lowercase()
        .contains("not a git repository")
    {
        return GitRepositoryProbeOutput {
            diagnostic_code: Some(GitOverviewDiagnosticCode::NotRepository),
            status: GitRepositoryProbeStatus::NotRepository,
        };
    }

    GitRepositoryProbeOutput {
        diagnostic_code: Some(GitOverviewDiagnosticCode::GitCommandFailed),
        status: GitRepositoryProbeStatus::Unavailable,
    }
}

pub(crate) fn paths_equal(left: &Path, right: &Path) -> bool {
    match (fs::canonicalize(left), fs::canonicalize(right)) {
        (Ok(left), Ok(right)) => left == right,
        _ => left == right,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FakeExecutor {
        result: Result<String, GitCommandError>,
    }

    impl GitCommandExecutor for FakeExecutor {
        fn run(
            &self,
            _args: &[&str],
            _cwd: &Path,
            _allowed_exit_codes: &[i32],
        ) -> Result<String, GitCommandError> {
            match &self.result {
                Ok(output) => Ok(output.clone()),
                Err(error) => Err(GitCommandError {
                    kind: error.kind,
                    message: error.message.clone(),
                }),
            }
        }
    }

    #[test]
    fn probe_distinguishes_missing_git_from_non_repository() {
        let output = probe_git_repository_with_executor(
            GitRepositoryProbeInput {
                expected_root: Path::new("."),
            },
            &FakeExecutor {
                result: Err(GitCommandError {
                    kind: GitCommandFailureKind::ExecutableUnavailable,
                    message: "missing".to_owned(),
                }),
            },
        );

        assert_eq!(output.status, GitRepositoryProbeStatus::Unavailable);
        assert_eq!(
            output.diagnostic_code,
            Some(GitOverviewDiagnosticCode::GitExecutableUnavailable)
        );
    }

    #[test]
    fn probe_distinguishes_non_repository_from_command_failure() {
        let output = probe_git_repository_with_executor(
            GitRepositoryProbeInput {
                expected_root: Path::new("."),
            },
            &FakeExecutor {
                result: Err(GitCommandError {
                    kind: GitCommandFailureKind::CommandFailed,
                    message: "fatal: not a git repository".to_owned(),
                }),
            },
        );

        assert_eq!(output.status, GitRepositoryProbeStatus::NotRepository);
        assert_eq!(
            output.diagnostic_code,
            Some(GitOverviewDiagnosticCode::NotRepository)
        );
    }

    #[test]
    fn probe_reports_repository_root_mismatch_without_exposing_the_parent_path() {
        let expected_root = std::env::temp_dir().join("birdcoder-probe-child");
        let parent_root = expected_root.parent().expect("parent").to_path_buf();
        let output = probe_git_repository_with_executor(
            GitRepositoryProbeInput {
                expected_root: &expected_root,
            },
            &FakeExecutor {
                result: Ok(parent_root.to_string_lossy().into_owned()),
            },
        );

        assert_eq!(
            output.status,
            GitRepositoryProbeStatus::RepositoryRootMismatch
        );
        assert_eq!(
            output.diagnostic_code,
            Some(GitOverviewDiagnosticCode::RepositoryRootMismatch)
        );
    }
}
