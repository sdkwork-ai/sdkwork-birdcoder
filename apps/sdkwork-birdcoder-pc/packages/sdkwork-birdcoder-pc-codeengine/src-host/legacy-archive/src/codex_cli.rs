pub fn prepend_fake_codex_directory_to_path(
    fixture_directory: &std::path::Path,
    original_path: Option<&std::ffi::OsStr>,
) -> std::ffi::OsString {
    let mut path_entries = vec![fixture_directory.to_path_buf()];
    if let Some(existing_path) = original_path {
        path_entries.extend(std::env::split_paths(existing_path));
    }
    std::env::join_paths(path_entries).expect("join fake codex PATH")
}

pub fn update_codex_cli_turn_error(turn_error: &mut Option<String>, candidate: &str) {
    let candidate = candidate.trim();
    if candidate.is_empty() {
        return;
    }

    match turn_error {
        Some(existing) if is_codex_cli_authentication_error(existing) => {}
        Some(_) if is_codex_cli_authentication_error(candidate) => {
            *turn_error = Some(candidate.to_owned());
        }
        None => {
            *turn_error = Some(candidate.to_owned());
        }
        Some(_) => {}
    }
}

pub fn format_codex_cli_error(message: &str) -> String {
    let trimmed = message.trim();
    if is_codex_cli_authentication_error(trimmed) {
        "Codex CLI authentication is not configured. BirdCoder reuses your existing Codex auth from `CODEX_HOME` or `~/.codex`; if none is configured, set `OPENAI_API_KEY` or run `codex login --with-api-key`.".to_owned()
    } else if trimmed.is_empty() {
        "Codex CLI turn failed.".to_owned()
    } else {
        trimmed.to_owned()
    }
}

pub fn is_codex_cli_authentication_error(message: &str) -> bool {
    let normalized = message.trim().to_ascii_lowercase();
    normalized.contains("401 unauthorized")
        || normalized.contains("missing bearer or basic authentication")
        || normalized.contains("login")
        || normalized.contains("api key")
        || normalized.contains("authentication")
}
