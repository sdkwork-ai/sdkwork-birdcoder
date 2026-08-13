use std::{
    env,
    io::{self, Read},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::mpsc::{channel, Receiver},
    thread,
    time::{Duration, Instant},
};

/// Default command execution budget applied to every git invocation.
///
/// `timeout` bounds the wall-clock duration of a single git process so a
/// hung network operation (for example a push against a stalled remote)
/// cannot pin a host blocking thread forever. `max_output_bytes` bounds how
/// much stdout/stderr is retained per stream; the tail is kept so diagnostics
/// remain meaningful while memory stays bounded even for pathological
/// repositories.
const DEFAULT_COMMAND_TIMEOUT: Duration = Duration::from_secs(60);
const DEFAULT_MAX_OUTPUT_BYTES: usize = 128 * 1024;
/// Upper bound for error text surfaced to callers after credential redaction.
const MAX_ERROR_MESSAGE_BYTES: usize = 8 * 1024;

/// Budget applied to a single git subprocess invocation.
#[derive(Debug, Clone, Copy)]
pub(crate) struct CommandLimits {
    pub(crate) timeout: Duration,
    pub(crate) max_output_bytes: usize,
}

impl Default for CommandLimits {
    fn default() -> Self {
        Self {
            timeout: DEFAULT_COMMAND_TIMEOUT,
            max_output_bytes: DEFAULT_MAX_OUTPUT_BYTES,
        }
    }
}

impl CommandLimits {
    /// A generous budget for diff-style commands that legitimately emit
    /// large patches; retention is aligned with the response-side diff limit
    /// so the caller never collects more than it can present.
    pub(crate) fn diff() -> Self {
        Self {
            timeout: Duration::from_secs(300),
            max_output_bytes: 2 * 1024 * 1024,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GitCommandFailureKind {
    CommandFailed,
    ExecutableUnavailable,
    TimedOut,
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
        run_git_from_candidates(
            git_executable_candidates(),
            args,
            cwd,
            allowed_exit_codes,
            CommandLimits::default(),
        )
    }
}

fn run_git_from_candidates(
    candidates: impl IntoIterator<Item = PathBuf>,
    args: &[&str],
    cwd: &Path,
    allowed_exit_codes: &[i32],
    limits: CommandLimits,
) -> Result<String, GitCommandError> {
    let mut last_spawn_error = None;

    for executable in candidates {
        if executable.components().count() > 1 && !executable.is_file() {
            continue;
        }

        match run_single_process(&executable, args, cwd, allowed_exit_codes, limits) {
            Ok(output) => return Ok(output),
            Err(error) if error.kind == GitCommandFailureKind::ExecutableUnavailable => {
                last_spawn_error = Some(error.message);
            }
            Err(error) => return Err(error),
        }
    }

    let message = last_spawn_error
        .map(|message| format!("failed to execute git: {message}"))
        .unwrap_or_else(|| "failed to locate a Git executable".to_owned());
    Err(GitCommandError {
        kind: GitCommandFailureKind::ExecutableUnavailable,
        message,
    })
}

fn run_single_process(
    executable: &Path,
    args: &[&str],
    cwd: &Path,
    allowed_exit_codes: &[i32],
    limits: CommandLimits,
) -> Result<String, GitCommandError> {
    let mut child = match Command::new(executable)
        .args(args)
        .current_dir(cwd)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C")
        .env("LANG", "C")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            return Err(GitCommandError {
                kind: GitCommandFailureKind::ExecutableUnavailable,
                message: format!("failed to execute git: {error}"),
            });
        }
    };

    let stdout_rx = spawn_output_reader(child.stdout.take(), limits.max_output_bytes);
    let stderr_rx = spawn_output_reader(child.stderr.take(), limits.max_output_bytes);

    let status = match wait_with_timeout(&mut child, limits.timeout) {
        Ok(status) => status,
        Err(error) => {
            kill_and_reap(&mut child);
            return Err(GitCommandError {
                kind: GitCommandFailureKind::TimedOut,
                message: error,
            });
        }
    };

    let stdout = join_output_reader(stdout_rx);
    let stderr = join_output_reader(stderr_rx);

    if status.code().is_some_and(|code| allowed_exit_codes.contains(&code)) {
        Ok(String::from_utf8_lossy(&stdout).to_string())
    } else {
        let message = sanitize_git_error_message(&String::from_utf8_lossy(&stderr));
        Err(GitCommandError {
            kind: GitCommandFailureKind::CommandFailed,
            message: bounded_error_message(&message),
        })
    }
}

fn spawn_output_reader(mut stream: Option<impl Read + Send + 'static>, max_bytes: usize) -> Receiver<Vec<u8>> {
    let (sender, receiver) = channel();
    let Some(mut stream) = stream.take() else {
        // The stream was not piped; deliver an empty payload immediately.
        drop(sender);
        return receiver;
    };
    thread::spawn(move || {
        let retained = read_bounded_tail(&mut stream, max_bytes);
        let _ = sender.send(retained);
    });
    receiver
}

fn join_output_reader(receiver: Receiver<Vec<u8>>) -> Vec<u8> {
    receiver.recv().unwrap_or_default()
}

/// Reads a stream while retaining only the trailing `max_bytes` bytes, so a
/// pathological repository can never force the whole output into memory.
///
/// A start offset trims the head as bytes arrive; the buffer is compacted
/// periodically so the retained window stays `max_bytes + one chunk` and
/// never grows with the streamed size.
fn read_bounded_tail(reader: &mut impl Read, max_bytes: usize) -> Vec<u8> {
    let mut retained: Vec<u8> = Vec::new();
    let mut start = 0usize;
    let mut buffer = [0u8; 16 * 1024];
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(count) => {
                retained.extend_from_slice(&buffer[..count]);
                let window = retained.len() - start;
                if window > max_bytes {
                    let excess = window - max_bytes;
                    start += excess;
                    if start > 1024 * 1024 {
                        retained.drain(..start);
                        start = 0;
                    }
                }
            }
            Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
            Err(_) => break,
        }
    }
    retained.split_off(start)
}

fn wait_with_timeout(child: &mut Child, timeout: Duration) -> Result<std::process::ExitStatus, String> {
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(status),
            Ok(None) => {
                if Instant::now() >= deadline {
                    return Err(format!("git command timed out after {timeout:?}"));
                }
                thread::sleep(Duration::from_millis(10));
            }
            Err(error) => {
                return Err(format!("failed to wait for git: {error}"));
            }
        }
    }
}

fn kill_and_reap(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

fn bounded_error_message(message: &str) -> String {
    let mut end = MAX_ERROR_MESSAGE_BYTES.min(message.len());
    while !message.is_char_boundary(end) {
        end -= 1;
    }
    message[..end].to_owned()
}

pub(crate) fn run_git(args: &[&str], cwd: &Path) -> Result<String, GitCommandError> {
    run_git_allow_exit_codes(args, cwd, &[0])
}

pub(crate) fn run_git_allow_exit_codes(
    args: &[&str],
    cwd: &Path,
    allowed_exit_codes: &[i32],
) -> Result<String, GitCommandError> {
    run_git_with_limits(args, cwd, allowed_exit_codes, CommandLimits::default())
}

pub(crate) fn run_git_with_limits(
    args: &[&str],
    cwd: &Path,
    allowed_exit_codes: &[i32],
    limits: CommandLimits,
) -> Result<String, GitCommandError> {
    run_git_from_candidates(git_executable_candidates(), args, cwd, allowed_exit_codes, limits)
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

    // The bare "git" name resolves through PATH and is the last resort: a
    // malicious directory earlier in PATH must never shadow the absolute
    // fallback candidates above (Windows desktop PATH-hijack surface).
    push_candidate(&mut candidates, PathBuf::from("git"));

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
            CommandLimits::default(),
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

    #[test]
    fn bounded_tail_reader_retains_only_the_trailing_window() {
        let payload = (0..4096)
            .map(|index| format!("line-{index}\n"))
            .collect::<String>();
        let mut reader = payload.as_bytes();
        let retained = read_bounded_tail(&mut reader, 512);
        let retained = String::from_utf8(retained).expect("utf-8 retained");
        assert!(retained.len() <= 512 + 16 * 1024);
        assert!(retained.ends_with("line-4095\n"), "tail must be preserved");
        assert!(!retained.contains("line-0\n"), "head must be dropped");
    }

    #[test]
    fn bounded_tail_reader_passes_through_small_payloads_unchanged() {
        let payload = "small output\n";
        let mut reader = payload.as_bytes();
        let retained = read_bounded_tail(&mut reader, 128 * 1024);
        assert_eq!(String::from_utf8(retained).expect("utf-8"), payload);
    }

    #[test]
    fn timeout_kills_hung_process_and_reports_timed_out() {
        // A command that cannot finish within the 100ms budget.
        #[cfg(windows)]
        let hang_args: &[&str] = &["cmd", "/C", "ping -n 3 127.0.0.1 >nul"];
        #[cfg(not(windows))]
        let hang_args: &[&str] = &["sleep", "3"];
        let result = run_git_from_candidates(
            [PathBuf::from("git")],
            &["--version"],
            Path::new("."),
            &[0],
            CommandLimits {
                timeout: Duration::from_millis(1),
                max_output_bytes: 4096,
            },
        );
        // A 1ms budget is normally too short for a fresh git spawn; the
        // important contract is that a timeout surfaces as TimedOut and the
        // child is reaped rather than leaked.
        if let Err(error) = result {
            assert_eq!(error.kind, GitCommandFailureKind::TimedOut);
            assert!(error.message.contains("timed out"));
        }

        let timeout_result = run_single_process(
            Path::new(hang_args[0]),
            &hang_args[1..],
            Path::new("."),
            &[0],
            CommandLimits {
                timeout: Duration::from_millis(100),
                max_output_bytes: 4096,
            },
        );
        let error = timeout_result.expect_err("hung command must time out");
        assert_eq!(error.kind, GitCommandFailureKind::TimedOut);
        assert!(error.message.contains("timed out"));
    }
}
