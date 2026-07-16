use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const CODE_ENGINE_NATIVE_SESSION_SCHEMA_VERSION: i64 = 1;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineSessionNativeAttributesRecord {
    #[serde(default = "default_native_session_schema_version")]
    pub schema_version: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_tree_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub forked_from_session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model_provider: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_commit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_repository_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_role: Option<String>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub is_ephemeral: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub is_sidechain: bool,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub metadata: BTreeMap<String, serde_json::Value>,
}

impl Default for CodeEngineSessionNativeAttributesRecord {
    fn default() -> Self {
        Self {
            schema_version: CODE_ENGINE_NATIVE_SESSION_SCHEMA_VERSION,
            session_tree_id: None,
            parent_session_id: None,
            forked_from_session_id: None,
            title: None,
            preview: None,
            source: None,
            provider_version: None,
            model_provider: None,
            project_id: None,
            cwd: None,
            git_branch: None,
            git_commit: None,
            git_repository_url: None,
            agent_name: None,
            agent_role: None,
            is_ephemeral: false,
            is_sidechain: false,
            metadata: BTreeMap::new(),
        }
    }
}

const fn default_native_session_schema_version() -> i64 {
    CODE_ENGINE_NATIVE_SESSION_SCHEMA_VERSION
}

const fn is_false(value: &bool) -> bool {
    !*value
}

pub fn sanitize_codeengine_session_metadata(value: &Value) -> BTreeMap<String, Value> {
    value
        .as_object()
        .into_iter()
        .flatten()
        .filter_map(|(key, value)| {
            if should_redact_session_metadata_key(key) {
                return None;
            }
            sanitize_session_metadata_value(value).map(|value| (key.clone(), value))
        })
        .collect()
}

pub fn sanitize_codeengine_git_repository_url(value: Option<String>) -> Option<String> {
    let value = value?.trim().to_owned();
    let has_uri_userinfo = value
        .split_once("://")
        .map(|(_, rest)| {
            rest.split('/')
                .next()
                .is_some_and(|authority| authority.contains('@'))
        })
        .unwrap_or(false);
    let is_safe_scp_git_remote =
        value.starts_with("git@") && value[4..].contains(':') && !value[4..].contains('@');
    let is_safe = !value.is_empty()
        && value.len() <= 2048
        && !value.bytes().any(|byte| byte < 0x20 || byte == b' ')
        && !value.contains(['?', '#'])
        && !has_uri_userinfo
        && (value.starts_with("https://")
            || value.starts_with("ssh://") && !value.contains('@')
            || value.starts_with("git://")
            || is_safe_scp_git_remote);

    is_safe.then_some(value)
}

fn sanitize_session_metadata_value(value: &Value) -> Option<Value> {
    match value {
        Value::Object(record) => Some(Value::Object(
            record
                .iter()
                .filter_map(|(key, value)| {
                    if should_redact_session_metadata_key(key) {
                        return None;
                    }
                    sanitize_session_metadata_value(value).map(|value| (key.clone(), value))
                })
                .collect(),
        )),
        Value::Array(values) => Some(Value::Array(
            values
                .iter()
                .filter_map(sanitize_session_metadata_value)
                .collect(),
        )),
        Value::String(value) if looks_like_sensitive_path(value) => None,
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => Some(value.clone()),
    }
}

fn should_redact_session_metadata_key(key: &str) -> bool {
    let normalized = key
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect::<String>();
    matches!(
        normalized.as_str(),
        "authorization"
            | "content"
            | "credential"
            | "credentials"
            | "env"
            | "environment"
            | "events"
            | "input"
            | "message"
            | "messages"
            | "output"
            | "password"
            | "prompt"
            | "secret"
            | "transcript"
    ) || normalized.contains("apikey")
        || normalized.contains("accesstoken")
        || normalized.contains("authtoken")
        || normalized.contains("privatekey")
        || normalized.contains("refreshtoken")
        || normalized.contains("credential")
        || normalized.contains("handle")
        || normalized.contains("fingerprint")
        || normalized.contains("cipher")
        || normalized.contains("locator")
        || is_path_like_session_metadata_key(normalized.as_str())
}

fn is_path_like_session_metadata_key(normalized: &str) -> bool {
    matches!(
        normalized,
        "cwd"
            | "dir"
            | "directory"
            | "home"
            | "nativecwd"
            | "root"
            | "workingdir"
            | "workingdirectory"
    ) || normalized.contains("cwd")
        || normalized.contains("directory")
        || normalized.contains("path")
        || normalized.ends_with("dir")
        || normalized.ends_with("root")
}

fn looks_like_sensitive_path(value: &str) -> bool {
    let trimmed = value.trim();
    trimmed.starts_with('/')
        || trimmed.starts_with("\\\\")
        || trimmed.starts_with("file://")
        || trimmed
            .as_bytes()
            .get(1)
            .is_some_and(|character| *character == b':')
            && trimmed
                .as_bytes()
                .first()
                .is_some_and(u8::is_ascii_alphabetic)
}

#[cfg(test)]
mod tests {
    use super::{sanitize_codeengine_git_repository_url, sanitize_codeengine_session_metadata};
    use serde_json::json;

    #[test]
    fn metadata_sanitizer_removes_nested_path_credentials_and_handles() {
        let sanitized = sanitize_codeengine_session_metadata(&json!({
            "cwd": "C:/private/project",
            "nested": {
                "workingDirectory": "C:/private/project/packages",
                "browserHandle": { "opaque": true },
                "safe": "kept",
            },
            "items": [
                { "nativeCwd": "/private/project/src" },
                { "safe": true },
            ],
            "unlabeled": "/private/project",
        }));

        assert!(!sanitized.contains_key("cwd"));
        assert!(sanitized["nested"].get("workingDirectory").is_none());
        assert!(sanitized["nested"].get("browserHandle").is_none());
        assert_eq!(sanitized["nested"]["safe"], "kept");
        assert!(sanitized["items"][0].get("nativeCwd").is_none());
        assert_eq!(sanitized["items"][1]["safe"], true);
        assert!(!sanitized.contains_key("unlabeled"));
    }

    #[test]
    fn repository_url_sanitizer_rejects_credentials_and_retains_safe_remotes() {
        assert_eq!(
            sanitize_codeengine_git_repository_url(Some(
                "https://token:secret@example.com/owner/repository.git".to_owned(),
            )),
            None,
        );
        assert_eq!(
            sanitize_codeengine_git_repository_url(Some(
                "https://example.com/owner/repository.git".to_owned(),
            )),
            Some("https://example.com/owner/repository.git".to_owned()),
        );
    }
}

#[derive(Clone, Debug, Default, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineSessionCommandRecord {
    pub command: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_approval: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_reply: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineSessionMessageRecord {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commands: Option<Vec<CodeEngineSessionCommandRecord>>,
    #[serde(
        default,
        rename = "tool_calls",
        skip_serializing_if = "Option::is_none"
    )]
    pub tool_calls: Option<Vec<serde_json::Value>>,
    #[serde(
        default,
        rename = "tool_call_id",
        skip_serializing_if = "Option::is_none"
    )]
    pub tool_call_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_changes: Option<Vec<serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_progress: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<BTreeMap<String, String>>,
    pub created_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineSessionSummaryRecord {
    pub created_at: String,
    pub id: String,
    pub title: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_status: Option<String>,
    pub host_mode: String,
    pub engine_id: String,
    pub model_id: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_turn_at: Option<String>,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_cwd: Option<String>,
    pub sort_timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcript_updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub native_attributes: CodeEngineSessionNativeAttributesRecord,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineSessionDetailRecord {
    pub summary: CodeEngineSessionSummaryRecord,
    pub messages: Vec<CodeEngineSessionMessageRecord>,
}
