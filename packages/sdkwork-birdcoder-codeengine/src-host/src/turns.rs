use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const CODE_ENGINE_TURN_CONTEXT_FILE_CONTENT_CHAR_LIMIT: usize = 4_000;

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineTurnConfigRecord {
    pub approval_policy: Option<String>,
    pub ephemeral: bool,
    pub full_auto: bool,
    pub sandbox_mode: Option<String>,
    pub skip_git_repo_check: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineTurnCurrentFileContextRecord {
    pub path: String,
    pub content: Option<String>,
    pub language: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineTurnIdeContextRecord {
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub session_id: Option<String>,
    pub current_file: Option<CodeEngineTurnCurrentFileContextRecord>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineTurnRequestRecord {
    pub engine_id: String,
    pub model_id: String,
    pub native_session_id: Option<String>,
    pub request_kind: String,
    pub input_summary: String,
    pub ide_context: Option<CodeEngineTurnIdeContextRecord>,
    pub working_directory: Option<PathBuf>,
    pub config: CodeEngineTurnConfigRecord,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineTurnResultRecord {
    pub assistant_content: String,
    pub native_session_id: Option<String>,
}

pub fn build_codeengine_turn_prompt(
    request_kind: &str,
    input_summary: &str,
    ide_context: Option<&CodeEngineTurnIdeContextRecord>,
) -> String {
    let contextual_input = if let Some(context_block) = build_codeengine_turn_context_block(ide_context)
    {
        format!("{context_block}\n\nUser request:\n{input_summary}")
    } else {
        input_summary.to_owned()
    };

    if request_kind == "chat" {
        contextual_input
    } else {
        format!("Request kind: {request_kind}\n\n{contextual_input}")
    }
}

fn build_codeengine_turn_context_block(
    ide_context: Option<&CodeEngineTurnIdeContextRecord>,
) -> Option<String> {
    let ide_context = ide_context?;
    let mut metadata_lines = Vec::new();

    if let Some(workspace_id) = normalize_non_empty_string(ide_context.workspace_id.as_deref()) {
        metadata_lines.push(format!("- Workspace ID: {workspace_id}"));
    }
    if let Some(project_id) = normalize_non_empty_string(ide_context.project_id.as_deref()) {
        metadata_lines.push(format!("- Project ID: {project_id}"));
    }
    if let Some(session_id) = normalize_non_empty_string(ide_context.session_id.as_deref()) {
        metadata_lines.push(format!("- Session ID: {session_id}"));
    }

    let mut sections = Vec::new();
    if !metadata_lines.is_empty() {
        sections.push(format!("IDE context:\n{}", metadata_lines.join("\n")));
    }

    if let Some(current_file) = ide_context.current_file.as_ref() {
        let mut file_lines = vec![format!("Current file path: {}", current_file.path)];
        if let Some(language) = normalize_non_empty_string(current_file.language.as_deref()) {
            file_lines.push(format!("Current file language: {language}"));
        }
        sections.push(file_lines.join("\n"));

        if let Some(content) = normalize_non_empty_string(current_file.content.as_deref()) {
            if should_inline_turn_context_file_content(
                current_file.path.as_str(),
                current_file.language.as_deref(),
            ) {
                let language = normalize_non_empty_string(current_file.language.as_deref())
                    .unwrap_or_else(|| "text".to_owned());
                sections.push(format!(
                    "Current file content:\n```{language}\n{}\n```",
                    truncate_turn_context_content(content.as_str())
                ));
            } else {
                sections.push(
                    "Current file content omitted for structured file formats. Inspect the file directly from the workspace if needed."
                        .to_owned(),
                );
            }
        }
    }

    if sections.is_empty() {
        None
    } else {
        Some(sections.join("\n\n"))
    }
}

fn truncate_turn_context_content(value: &str) -> String {
    let normalized = value.replace("\r\n", "\n").replace('\r', "\n");
    if normalized.chars().count() <= CODE_ENGINE_TURN_CONTEXT_FILE_CONTENT_CHAR_LIMIT {
        return normalized;
    }

    let mut truncated = normalized
        .chars()
        .take(CODE_ENGINE_TURN_CONTEXT_FILE_CONTENT_CHAR_LIMIT.saturating_sub(20))
        .collect::<String>();
    truncated.push_str("\n...[truncated]");
    truncated
}

fn should_inline_turn_context_file_content(path: &str, language: Option<&str>) -> bool {
    let normalized_language = language
        .map(|value| value.trim().to_ascii_lowercase())
        .unwrap_or_default();
    if matches!(
        normalized_language.as_str(),
        "json"
            | "jsonc"
            | "yaml"
            | "yml"
            | "toml"
            | "xml"
            | "csv"
            | "tsv"
            | "ini"
            | "properties"
    ) {
        return false;
    }

    let normalized_path = path.trim().to_ascii_lowercase();
    !matches!(
        normalized_path.as_str(),
        _ if normalized_path.ends_with(".lock")
            || normalized_path.ends_with("package-lock.json")
            || normalized_path.ends_with("pnpm-lock.yaml")
            || normalized_path.ends_with("yarn.lock")
            || normalized_path.ends_with("cargo.lock")
            || normalized_path.ends_with("composer.lock")
    )
}

fn normalize_non_empty_string(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_codeengine_turn_prompt_omits_structured_json_file_content() {
        let prompt = build_codeengine_turn_prompt(
            "chat",
            "Explain the package configuration.",
            Some(&CodeEngineTurnIdeContextRecord {
                workspace_id: Some("100000000000000101".to_owned()),
                project_id: Some("project-demo".to_owned()),
                session_id: Some("coding-session-demo".to_owned()),
                current_file: Some(CodeEngineTurnCurrentFileContextRecord {
                    path: "/demo/package.json".to_owned(),
                    language: Some("json".to_owned()),
                    content: Some("{\"name\":\"demo\",\"private\":true}".to_owned()),
                }),
            }),
        );

        assert!(prompt.contains("Current file path: /demo/package.json"));
        assert!(prompt.contains("Current file language: json"));
        assert!(prompt.contains("Current file content omitted for structured file formats."));
        assert!(!prompt.contains("```json"));
        assert!(!prompt.contains("\"private\":true"));
    }

    #[test]
    fn build_codeengine_turn_prompt_keeps_source_file_preview() {
        let prompt = build_codeengine_turn_prompt(
            "chat",
            "Review this component.",
            Some(&CodeEngineTurnIdeContextRecord {
                workspace_id: Some("100000000000000101".to_owned()),
                project_id: Some("project-demo".to_owned()),
                session_id: Some("coding-session-demo".to_owned()),
                current_file: Some(CodeEngineTurnCurrentFileContextRecord {
                    path: "/demo/src/App.tsx".to_owned(),
                    language: Some("tsx".to_owned()),
                    content: Some("export function App() {\n  return <main>Hello</main>;\n}".to_owned()),
                }),
            }),
        );

        assert!(prompt.contains("Current file content:\n```tsx"));
        assert!(prompt.contains("export function App()"));
    }
}
