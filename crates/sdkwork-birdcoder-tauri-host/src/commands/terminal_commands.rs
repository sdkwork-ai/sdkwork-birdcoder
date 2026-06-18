use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCliProfileDetectRequest {
    pub profile_id: String,
    pub executable: String,
    #[serde(default)]
    pub aliases: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCliProfileAvailability {
    pub profile_id: String,
    pub status: String,
    pub resolved_executable: Option<String>,
}

fn locate_terminal_executable(executable: &str, aliases: &[String]) -> Option<String> {
    let mut candidates = Vec::new();
    if !executable.trim().is_empty() {
        candidates.push(executable.trim().to_string());
    }

    for alias in aliases {
        let normalized = alias.trim();
        if !normalized.is_empty() && !candidates.iter().any(|candidate| candidate == normalized) {
            candidates.push(normalized.to_string());
        }
    }

    for candidate in candidates {
        let output = if cfg!(target_os = "windows") {
            std::process::Command::new("where").arg(&candidate).output()
        } else {
            std::process::Command::new("which").arg(&candidate).output()
        };
        let Ok(output) = output else {
            continue;
        };
        if !output.status.success() {
            continue;
        }

        let resolved = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(str::trim)
            .find(|line| !line.is_empty())
            .map(str::to_string);
        if resolved.is_some() {
            return resolved;
        }
    }

    None
}

#[tauri::command]
pub async fn terminal_cli_profile_detect(
    request: TerminalCliProfileDetectRequest,
) -> Result<TerminalCliProfileAvailability, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let resolved_executable = locate_terminal_executable(&request.executable, &request.aliases);

        Ok(TerminalCliProfileAvailability {
            profile_id: request.profile_id,
            status: if resolved_executable.is_some() {
                "available".to_string()
            } else {
                "missing".to_string()
            },
            resolved_executable,
        })
    })
    .await
    .map_err(|error| format!("failed to join terminal CLI profile detect task: {error}"))?
}
