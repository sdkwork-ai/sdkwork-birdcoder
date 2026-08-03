use std::{
    env,
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GitCommandFailureKind {
    CommandFailed,
    ExecutableUnavailable,
}

#[derive(Debug)]
pub(crate) struct GitCommandError {
    pub(crate) kind: GitCommandFailureKind,
    pub(crate) message: String,
}

pub(crate) trait GitCommandExecutor {
    fn run(
        &self,
        args: &[&str],
        cwd: &Path,
        allowed_exit_codes: &[i32],
    ) -> Result<String, GitCommandError>;
}

#[derive(Debug, Default)]
pub(crate) struct SystemGitCommandRunner;

impl GitCommandExecutor for SystemGitCommandRunner {
    fn run(
        &self,
        args: &[&str],
        cwd: &Path,
        allowed_exit_codes: &[i32],
    ) -> Result<String, GitCommandError> {
        run_git_from_candidates(git_executable_candidates(), args, cwd, allowed_exit_codes)
    }
}

fn run_git_from_candidates(
    candidates: impl IntoIterator<Item = PathBuf>,
    args: &[&str],
    cwd: &Path,
    allowed_exit_codes: &[i32],
) -> Result<String, GitCommandError> {
    let mut last_spawn_error = None;

    for executable in candidates {
        if executable.components().count() > 1 && !executable.is_file() {
            continue;
        }

        let output = Command::new(&executable)
            .args(args)
            .current_dir(cwd)
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("LC_ALL", "C")
            .env("LANG", "C")
            .output();

        match output {
            Ok(output)
                if output
                    .status
                    .code()
                    .is_some_and(|code| allowed_exit_codes.contains(&code)) =>
            {
                return Ok(String::from_utf8_lossy(&output.stdout).to_string());
            }
            Ok(output) => {
                return Err(GitCommandError {
                    kind: GitCommandFailureKind::CommandFailed,
                    message: sanitize_git_error_message(
                        &String::from_utf8_lossy(&output.stderr),
                    ),
                });
            }
            Err(error) => {
                last_spawn_error = Some(error);
            }
        }
    }

    let message = last_spawn_error
        .map(|error| format!("failed to execute git: {error}"))
        .unwrap_or_else(|| "failed to locate a Git executable".to_owned());
    Err(GitCommandError {
        kind: GitCommandFailureKind::ExecutableUnavailable,
        message,
    })
}

pub(crate) fn run_git(args: &[&str], cwd: &Path) -> Result<String, GitCommandError> {
    run_git_allow_exit_codes(args, cwd, &[0])
}

pub(crate) fn run_git_allow_exit_codes(
    args: &[&str],
    cwd: &Path,
    allowed_exit_codes: &[i32],
) -> Result<String, GitCommandError> {
    SystemGitCommandRunner.run(args, cwd, allowed_exit_codes)
}

/// Redacts credentials that git may echo back in error output (for example a
/// remote URL that embeds `user:password@host`). The sanitized message keeps
/// the diagnostic value while ensuring secrets never cross the host boundary
/// into renderer-facing errors or logs.
fn sanitize_git_error_message(stderr: &str) -> String {
    let mut sanitized = String::with_capacity(stderr.len());
    let mut remaining = stderr.trim();
    while let Some(scheme_end) = remaining.find("://") {
        let scheme_start = remaining[..scheme_end]
            .rfind(|character: char| !(character.is_ascii_alphanumeric() || character == '+'))
            .map_or(0, |index| index + 1);
        let scheme = &remaining[scheme_start..=scheme_end + 2];
        sanitized.push_str(&remaining[..scheme_start]);
        let rest = &remaining[scheme_end + 3..];
        let authority_end = rest
            .find(|character: char| !(character.is_ascii_alphanumeric()
                || matches!(character, ':' | '@' | '.' | '-' | '_' | '[' | ']' | '%' | '~' | '+')))
            .unwrap_or(rest.len());
        let authority = &rest[..authority_end];
        if let Some(at) = authority.rfind('@') {
            // user:password@host -> ***@host
            sanitized.push_str(scheme);
            sanitized.push_str("***");
            sanitized.push_str(&authority[at..]);
        } else {
            sanitized.push_str(scheme);
            sanitized.push_str(&authority);
        }
        remaining = &rest[authority_end..];
    }
    sanitized.push_str(remaining);
    sanitized
}

fn push_candidate(candidates: &mut Vec<PathBuf>, candidate: PathBuf) {
    if !candidates.iter().any(|existing| existing == &candidate) {
        candidates.push(candidate);
    }
}

fn push_env_git_candidates(candidates: &mut Vec<PathBuf>, variable: &str) {
    let Some(root) = env::var_os(variable).filter(|value| !value.is_empty()) else {
        return;
    };
    let root = PathBuf::from(root);
    push_candidate(candidates, root.join("Git").join("cmd").join("git.exe"));
    push_candidate(candidates, root.join("Git").join("bin").join("git.exe"));
}

fn git_executable_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(configured) =
        env::var_os("SDKWORK_GIT_EXECUTABLE").filter(|value| !value.is_empty())
    {
        push_candidate(&mut candidates, PathBuf::from(configured));
    }
    push_candidate(&mut candidates, PathBuf::from("git"));

    #[cfg(windows)]
    {
        push_env_git_candidates(&mut candidates, "ProgramFiles");
        push_env_git_candidates(&mut candidates, "ProgramW6432");
        push_env_git_candidates(&mut candidates, "ProgramFiles(x86)");
        if let Some(local_app_data) = env::var_os("LOCALAPPDATA").filter(|value| !value.is_empty())
        {
            let local_app_data = PathBuf::from(local_app_data);
            push_candidate(
                &mut candidates,
                local_app_data
                    .join("Programs")
                    .join("Git")
                    .join("cmd")
                    .join("git.exe"),
            );
        }
    }

    #[cfg(not(windows))]
    {
        for candidate in [
            "/usr/bin/git",
            "/usr/local/bin/git",
            "/opt/homebrew/bin/git",
        ] {
            push_candidate(&mut candidates, PathBuf::from(candidate));
        }
    }

    candidates
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io;

    #[test]
    fn system_runner_executes_git_without_interactive_prompts() {
        let output = run_git(&["--version"], Path::new(".")).expect("run git");
        assert!(output.starts_with("git version "));
    }

    #[test]
    fn runner_uses_absolute_fallback_when_path_lookup_is_unavailable() {
        let absolute_git = git_executable_candidates()
            .into_iter()
            .find(|candidate| candidate.is_absolute() && candidate.is_file())
            .expect("an absolute Git fallback path");
        let output = run_git_from_candidates(
            [PathBuf::from("sdkwork-git-missing-from-path"), absolute_git],
            &["--version"],
            Path::new("."),
            &[0],
        )
        .expect("run fallback Git executable");

        assert!(output.starts_with("git version "));
    }

    #[test]
    fn unavailable_error_kind_is_stable() {
        let error = io::Error::new(io::ErrorKind::NotFound, "missing");
        let command_error = GitCommandError {
            kind: GitCommandFailureKind::ExecutableUnavailable,
            message: format!("failed to execute git: {error}"),
        };
        assert_eq!(
            command_error.kind,
            GitCommandFailureKind::ExecutableUnavailable
        );
    }

    #[test]
    fn git_error_messages_redact_embedded_credentials() {
        let message = sanitize_git_error_message(
            "fatal: unable to access 'https://user:supersecret@example.com/repo.git/': \
             The requested URL returned error: 403\n",
        );
        assert!(!message.contains("supersecret"), "password must not survive");
        assert!(message.contains("https://***@example.com/repo.git/"));
        // A credential-free URL stays intact.
        let plain = sanitize_git_error_message(
            "fatal: unable to access 'https://example.com/repo.git/': error",
        );
        assert!(plain.contains("https://example.com/repo.git/"));
        assert!(!plain.contains("***"));
    }
}
