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
        && !value.bytes().any(|byte| byte <= b' ')
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
    use super::{
        sanitize_codeengine_git_repository_url, sanitize_codeengine_session_metadata,
        sanitize_codeengine_session_resource_records, CodeEngineSessionResourceOriginRecord,
        CodeEngineSessionResourceRecord, MAX_CODEENGINE_SESSION_RESOURCE_MEDIA_SOURCE_CHARACTERS,
    };
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

    #[test]
    fn resource_sanitizer_bounds_deduplicates_and_rejects_opaque_locations() {
        let mut resources = (0..40)
            .map(|index| CodeEngineSessionResourceRecord {
                id: format!("resource-{index}"),
                kind: "file".to_owned(),
                name: Some(format!("Resource {index}")),
                path: Some(format!("src/resource-{index}.rs")),
                uri: None,
                media_source: None,
                mime_type: Some("text/plain".to_owned()),
                description: None,
                origin: None,
                citation: None,
            })
            .collect::<Vec<_>>();
        resources.push(CodeEngineSessionResourceRecord {
            id: "resource-1".to_owned(),
            kind: "file".to_owned(),
            name: Some("Updated resource".to_owned()),
            path: Some("src/updated.rs".to_owned()),
            uri: None,
            media_source: None,
            mime_type: Some("text/plain".to_owned()),
            description: None,
            origin: None,
            citation: None,
        });

        let sanitized = sanitize_codeengine_session_resource_records(resources.as_slice());
        assert_eq!(sanitized.len(), 32);
        let updated = sanitized
            .iter()
            .find(|resource| resource.id == "resource-1")
            .expect("updated canonical resource");
        assert_eq!(updated.path.as_deref(), Some("src/updated.rs"));

        let oversized_media = format!(
            "data:image/png;base64,{}",
            "A".repeat(MAX_CODEENGINE_SESSION_RESOURCE_MEDIA_SOURCE_CHARACTERS)
        );
        let unsafe_resources = vec![
            CodeEngineSessionResourceRecord {
                id: "inline-image".to_owned(),
                kind: "image".to_owned(),
                name: None,
                path: Some("data:image/png;base64,aW1hZ2U=".to_owned()),
                uri: Some("blob:transient-image".to_owned()),
                media_source: Some("data:image/png;base64,aW1hZ2U=".to_owned()),
                mime_type: Some("image/png".to_owned()),
                description: None,
                origin: None,
                citation: None,
            },
            CodeEngineSessionResourceRecord {
                id: "oversized-image".to_owned(),
                kind: "image".to_owned(),
                name: None,
                path: None,
                uri: None,
                media_source: Some(oversized_media),
                mime_type: Some("image/png".to_owned()),
                description: None,
                origin: None,
                citation: None,
            },
            CodeEngineSessionResourceRecord {
                id: "document-data".to_owned(),
                kind: "file".to_owned(),
                name: Some("Private document".to_owned()),
                path: None,
                uri: None,
                media_source: Some("data:application/pdf;base64,AAAA".to_owned()),
                mime_type: Some("application/pdf".to_owned()),
                description: None,
                origin: None,
                citation: None,
            },
        ];
        let sanitized = sanitize_codeengine_session_resource_records(unsafe_resources.as_slice());
        assert_eq!(sanitized[0].path, None);
        assert_eq!(sanitized[0].uri, None);
        assert_eq!(
            sanitized[0].media_source.as_deref(),
            Some("data:image/png;base64,aW1hZ2U=")
        );
        assert_eq!(sanitized[1].media_source, None);
        assert_eq!(sanitized[2].media_source, None);

        let vendor_mime =
            sanitize_codeengine_session_resource_records(&[CodeEngineSessionResourceRecord {
                id: "vendor-document".to_owned(),
                kind: "file".to_owned(),
                name: Some("Vendor document".to_owned()),
                path: Some("docs/vendor.sdkwork".to_owned()),
                uri: None,
                media_source: None,
                mime_type: Some("application/vnd.sdkwork~json".to_owned()),
                description: None,
                origin: Some(CodeEngineSessionResourceOriginRecord {
                    kind: "SYMBOL".to_owned(),
                    name: Some("VendorDocument".to_owned()),
                    path: Some("src/vendor.rs".to_owned()),
                    uri: None,
                    client_name: None,
                    line_start: Some(1),
                    line_end: Some(2),
                    column_start: None,
                    column_end: None,
                    excerpt: None,
                }),
                citation: None,
            }]);
        assert_eq!(
            vendor_mime[0].mime_type.as_deref(),
            Some("application/vnd.sdkwork~json")
        );
        assert_eq!(
            vendor_mime[0]
                .origin
                .as_ref()
                .map(|origin| origin.kind.as_str()),
            Some("symbol")
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
pub struct CodeEngineSessionResourceOriginRecord {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uri: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_start: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_end: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column_start: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column_end: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub excerpt: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineSessionResourceCitationRecord {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_start: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_end: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub thread_ids: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineSessionResourceRecord {
    pub id: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uri: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<CodeEngineSessionResourceOriginRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub citation: Option<CodeEngineSessionResourceCitationRecord>,
}

const MAX_CODEENGINE_SESSION_RESOURCE_ITEMS: usize = 32;
const MAX_CODEENGINE_SESSION_RESOURCE_INPUT_ITEMS: usize = 128;
const MAX_CODEENGINE_SESSION_RESOURCE_ID_CHARACTERS: usize = 256;
const MAX_CODEENGINE_SESSION_RESOURCE_KIND_CHARACTERS: usize = 32;
const MAX_CODEENGINE_SESSION_RESOURCE_NAME_CHARACTERS: usize = 256;
const MAX_CODEENGINE_SESSION_RESOURCE_LOCATION_CHARACTERS: usize = 4_096;
const MAX_CODEENGINE_SESSION_RESOURCE_MEDIA_SOURCE_CHARACTERS: usize = 4 * 1_024 * 1_024;
const MAX_CODEENGINE_SESSION_RESOURCE_MIME_TYPE_CHARACTERS: usize = 128;
const MAX_CODEENGINE_SESSION_RESOURCE_DESCRIPTION_CHARACTERS: usize = 8_000;
const MAX_CODEENGINE_SESSION_RESOURCE_ORIGIN_EXCERPT_CHARACTERS: usize = 4_000;
const MAX_CODEENGINE_SESSION_RESOURCE_CITATION_THREADS: usize = 32;
const MAX_CODEENGINE_SESSION_RESOURCE_CITATION_NOTE_CHARACTERS: usize = 4_000;
const MAX_CODEENGINE_SESSION_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

fn bounded_resource_identity(value: &str, max_characters: usize) -> Option<String> {
    let normalized = value.trim();
    if normalized.is_empty()
        || normalized.chars().count() > max_characters
        || normalized.chars().any(char::is_control)
    {
        return None;
    }
    Some(normalized.to_owned())
}

fn bounded_resource_display_text(value: &str, max_characters: usize) -> Option<String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return None;
    }
    let bounded = normalized
        .chars()
        .map(|character| {
            if character.is_control() && !matches!(character, '\n' | '\t') {
                ' '
            } else {
                character
            }
        })
        .take(max_characters)
        .collect::<String>();
    (!bounded.trim().is_empty()).then_some(bounded)
}

fn bounded_resource_location(value: Option<&str>) -> Option<String> {
    let value =
        bounded_resource_identity(value?, MAX_CODEENGINE_SESSION_RESOURCE_LOCATION_CHARACTERS)?;
    let normalized = value.to_ascii_lowercase();
    (!normalized.starts_with("data:") && !normalized.starts_with("blob:")).then_some(value)
}

fn normalize_resource_mime_type(value: Option<&str>) -> Option<String> {
    let value =
        bounded_resource_identity(value?, MAX_CODEENGINE_SESSION_RESOURCE_MIME_TYPE_CHARACTERS)?;
    let mut parts = value.split('/');
    let type_name = parts.next()?;
    let subtype_name = parts.next()?;
    let valid_token = |part: &str| {
        !part.is_empty()
            && part.chars().all(|character| {
                character.is_ascii_alphanumeric()
                    || matches!(
                        character,
                        '!' | '#'
                            | '$'
                            | '%'
                            | '&'
                            | '\''
                            | '*'
                            | '+'
                            | '-'
                            | '.'
                            | '^'
                            | '_'
                            | '`'
                            | '|'
                            | '~'
                    )
            })
    };
    (parts.next().is_none() && valid_token(type_name) && valid_token(subtype_name))
        .then(|| value.to_ascii_lowercase())
}

fn resource_base64_payload_is_valid(value: &str) -> bool {
    if value.is_empty() || !value.len().is_multiple_of(4) || !value.is_ascii() {
        return false;
    }
    let padding_start = value.find('=').unwrap_or(value.len());
    let padding_length = value.len().saturating_sub(padding_start);
    padding_length <= 2
        && value[..padding_start]
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'/'))
        && value[padding_start..].bytes().all(|byte| byte == b'=')
}

fn sanitize_resource_media_source(value: Option<&str>, kind: &str) -> Option<String> {
    let value = value?.trim();
    if value.is_empty()
        || value.chars().any(char::is_control)
        || value.chars().count() > MAX_CODEENGINE_SESSION_RESOURCE_MEDIA_SOURCE_CHARACTERS
    {
        return None;
    }
    let normalized = value.to_ascii_lowercase();
    if normalized.starts_with("blob:") {
        return None;
    }
    if normalized.starts_with("data:") {
        if !matches!(kind, "image" | "audio") {
            return None;
        }
        let separator_index = value.find(',')?;
        if separator_index > 256 {
            return None;
        }
        let header = normalized.get(..separator_index)?;
        let mime_type = header.strip_prefix("data:")?.strip_suffix(";base64")?;
        let mime_type_matches_kind = match kind {
            "image" => matches!(
                mime_type,
                "image/gif" | "image/jpeg" | "image/png" | "image/webp"
            ),
            "audio" => {
                mime_type.starts_with("audio/")
                    && normalize_resource_mime_type(Some(mime_type)).is_some()
            }
            _ => false,
        };
        if !mime_type_matches_kind
            || !resource_base64_payload_is_valid(&value[separator_index + 1..])
        {
            return None;
        }
        return Some(value.to_owned());
    }
    if value.chars().count() > MAX_CODEENGINE_SESSION_RESOURCE_LOCATION_CHARACTERS {
        return None;
    }
    (normalized.starts_with("https://") || normalized.starts_with("http://"))
        .then(|| value.to_owned())
}

fn sanitize_resource_origin(
    origin: Option<&CodeEngineSessionResourceOriginRecord>,
) -> Option<CodeEngineSessionResourceOriginRecord> {
    let origin = origin?;
    let kind = bounded_resource_identity(
        &origin.kind,
        MAX_CODEENGINE_SESSION_RESOURCE_KIND_CHARACTERS,
    )?
    .to_ascii_lowercase();
    if !matches!(kind.as_str(), "file" | "symbol" | "resource") {
        return None;
    }
    Some(CodeEngineSessionResourceOriginRecord {
        kind,
        name: origin.name.as_deref().and_then(|value| {
            bounded_resource_display_text(value, MAX_CODEENGINE_SESSION_RESOURCE_NAME_CHARACTERS)
        }),
        path: bounded_resource_location(origin.path.as_deref()),
        uri: bounded_resource_location(origin.uri.as_deref()),
        client_name: origin.client_name.as_deref().and_then(|value| {
            bounded_resource_display_text(value, MAX_CODEENGINE_SESSION_RESOURCE_NAME_CHARACTERS)
        }),
        line_start: origin
            .line_start
            .filter(|value| *value <= MAX_CODEENGINE_SESSION_SAFE_INTEGER),
        line_end: origin
            .line_end
            .filter(|value| *value <= MAX_CODEENGINE_SESSION_SAFE_INTEGER),
        column_start: origin
            .column_start
            .filter(|value| *value <= MAX_CODEENGINE_SESSION_SAFE_INTEGER),
        column_end: origin
            .column_end
            .filter(|value| *value <= MAX_CODEENGINE_SESSION_SAFE_INTEGER),
        excerpt: origin.excerpt.as_deref().and_then(|value| {
            bounded_resource_display_text(
                value,
                MAX_CODEENGINE_SESSION_RESOURCE_ORIGIN_EXCERPT_CHARACTERS,
            )
        }),
    })
}

fn sanitize_resource_citation(
    citation: Option<&CodeEngineSessionResourceCitationRecord>,
) -> Option<CodeEngineSessionResourceCitationRecord> {
    let citation = citation?;
    let thread_ids = citation
        .thread_ids
        .iter()
        .filter_map(|value| {
            bounded_resource_identity(value, MAX_CODEENGINE_SESSION_RESOURCE_ID_CHARACTERS)
        })
        .take(MAX_CODEENGINE_SESSION_RESOURCE_CITATION_THREADS)
        .fold(Vec::<String>::new(), |mut output, value| {
            if !output.contains(&value) {
                output.push(value);
            }
            output
        });
    Some(CodeEngineSessionResourceCitationRecord {
        line_start: citation
            .line_start
            .filter(|value| *value <= MAX_CODEENGINE_SESSION_SAFE_INTEGER),
        line_end: citation
            .line_end
            .filter(|value| *value <= MAX_CODEENGINE_SESSION_SAFE_INTEGER),
        note: citation.note.as_deref().and_then(|value| {
            bounded_resource_display_text(
                value,
                MAX_CODEENGINE_SESSION_RESOURCE_CITATION_NOTE_CHARACTERS,
            )
        }),
        thread_ids,
    })
}

fn sanitize_codeengine_session_resource_record(
    record: &CodeEngineSessionResourceRecord,
) -> Option<CodeEngineSessionResourceRecord> {
    let id = bounded_resource_identity(
        record.id.as_str(),
        MAX_CODEENGINE_SESSION_RESOURCE_ID_CHARACTERS,
    )?;
    let kind = bounded_resource_identity(
        record.kind.as_str(),
        MAX_CODEENGINE_SESSION_RESOURCE_KIND_CHARACTERS,
    )?
    .to_ascii_lowercase();
    if !matches!(
        kind.as_str(),
        "file" | "image" | "audio" | "uri" | "citation" | "skill" | "mention"
    ) {
        return None;
    }
    Some(CodeEngineSessionResourceRecord {
        id,
        kind: kind.clone(),
        name: record.name.as_deref().and_then(|value| {
            bounded_resource_display_text(value, MAX_CODEENGINE_SESSION_RESOURCE_NAME_CHARACTERS)
        }),
        path: bounded_resource_location(record.path.as_deref()),
        uri: bounded_resource_location(record.uri.as_deref()),
        media_source: sanitize_resource_media_source(record.media_source.as_deref(), kind.as_str()),
        mime_type: normalize_resource_mime_type(record.mime_type.as_deref()),
        description: record.description.as_deref().and_then(|value| {
            bounded_resource_display_text(
                value,
                MAX_CODEENGINE_SESSION_RESOURCE_DESCRIPTION_CHARACTERS,
            )
        }),
        origin: sanitize_resource_origin(record.origin.as_ref()),
        citation: sanitize_resource_citation(record.citation.as_ref()),
    })
}

pub fn sanitize_codeengine_session_resource_records(
    records: &[CodeEngineSessionResourceRecord],
) -> Vec<CodeEngineSessionResourceRecord> {
    let mut sanitized = Vec::<CodeEngineSessionResourceRecord>::new();
    for record in records
        .iter()
        .take(MAX_CODEENGINE_SESSION_RESOURCE_INPUT_ITEMS)
    {
        let Some(record) = sanitize_codeengine_session_resource_record(record) else {
            continue;
        };
        if let Some(existing_index) = sanitized
            .iter()
            .position(|existing| existing.id == record.id)
        {
            sanitized[existing_index] = record;
        } else if sanitized.len() < MAX_CODEENGINE_SESSION_RESOURCE_ITEMS {
            sanitized.push(record);
        }
    }
    sanitized
}

const MAX_CODEENGINE_SESSION_REASONING_ITEMS: usize = 32;
const MAX_CODEENGINE_SESSION_REASONING_INPUT_ITEMS: usize = 128;
const MAX_CODEENGINE_SESSION_REASONING_ID_CHARACTERS: usize = 256;
const MAX_CODEENGINE_SESSION_REASONING_TITLE_CHARACTERS: usize = 256;
const MAX_CODEENGINE_SESSION_REASONING_SUMMARY_CHARACTERS: usize = 8_000;
const MAX_CODEENGINE_SESSION_REASONING_TIMESTAMP_CHARACTERS: usize = 64;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineSessionReasoningRecord {
    pub id: String,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

fn bounded_reasoning_string(value: &str, max_characters: usize) -> Option<String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return None;
    }
    Some(normalized.chars().take(max_characters).collect())
}

fn normalize_reasoning_timestamp(value: Option<&str>) -> Option<String> {
    let value = bounded_reasoning_string(
        value?,
        MAX_CODEENGINE_SESSION_REASONING_TIMESTAMP_CHARACTERS,
    )?;
    time::OffsetDateTime::parse(
        value.as_str(),
        &time::format_description::well_known::Rfc3339,
    )
    .ok()?;
    Some(value)
}

fn sanitize_codeengine_session_reasoning_record(
    record: &CodeEngineSessionReasoningRecord,
) -> Option<CodeEngineSessionReasoningRecord> {
    Some(CodeEngineSessionReasoningRecord {
        id: bounded_reasoning_string(
            record.id.as_str(),
            MAX_CODEENGINE_SESSION_REASONING_ID_CHARACTERS,
        )?,
        summary: bounded_reasoning_string(
            record.summary.as_str(),
            MAX_CODEENGINE_SESSION_REASONING_SUMMARY_CHARACTERS,
        )?,
        title: record.title.as_deref().and_then(|value| {
            bounded_reasoning_string(value, MAX_CODEENGINE_SESSION_REASONING_TITLE_CHARACTERS)
        }),
        created_at: normalize_reasoning_timestamp(record.created_at.as_deref()),
        started_at: normalize_reasoning_timestamp(record.started_at.as_deref()),
        completed_at: normalize_reasoning_timestamp(record.completed_at.as_deref()),
        duration_ms: record
            .duration_ms
            .filter(|value| *value <= 9_007_199_254_740_991),
    })
}

pub fn sanitize_codeengine_session_reasoning_records(
    records: &[CodeEngineSessionReasoningRecord],
) -> Vec<CodeEngineSessionReasoningRecord> {
    let mut sanitized = Vec::<CodeEngineSessionReasoningRecord>::new();
    for record in records
        .iter()
        .take(MAX_CODEENGINE_SESSION_REASONING_INPUT_ITEMS)
    {
        let Some(record) = sanitize_codeengine_session_reasoning_record(record) else {
            continue;
        };
        if let Some(existing_index) = sanitized
            .iter()
            .position(|existing| existing.id == record.id)
        {
            sanitized[existing_index] = record;
        } else if sanitized.len() < MAX_CODEENGINE_SESSION_REASONING_ITEMS {
            sanitized.push(record);
        }
    }
    sanitized
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
    pub reasoning: Option<Vec<CodeEngineSessionReasoningRecord>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resources: Option<Vec<CodeEngineSessionResourceRecord>>,
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
