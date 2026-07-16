use std::collections::BTreeMap;

use serde::{Deserialize, Deserializer, Serialize, Serializer};

pub const NATIVE_SESSION_ATTRIBUTES_SCHEMA_VERSION: i64 = 1;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionAttributesPayload {
    #[serde(default = "default_native_session_attributes_schema_version")]
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
    // `cwd` is input/persistence-only authority metadata. It must never cross
    // an app API boundary because it can disclose an absolute host path.
    #[serde(default, skip_serializing)]
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
    #[serde(default)]
    pub is_ephemeral: bool,
    #[serde(default)]
    pub is_sidechain: bool,
    #[serde(default)]
    pub metadata: BTreeMap<String, serde_json::Value>,
}

impl Default for NativeSessionAttributesPayload {
    fn default() -> Self {
        Self {
            schema_version: NATIVE_SESSION_ATTRIBUTES_SCHEMA_VERSION,
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

const fn default_native_session_attributes_schema_version() -> i64 {
    NATIVE_SESSION_ATTRIBUTES_SCHEMA_VERSION
}

#[derive(Clone, Debug, Default, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionCommandPayload {
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

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionMessagePayload {
    pub id: String,
    pub coding_session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commands: Option<Vec<NativeSessionCommandPayload>>,
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

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionSummaryPayload {
    pub created_at: String,
    pub id: String,
    pub workspace_id: String,
    pub project_id: String,
    pub title: String,
    pub status: String,
    pub host_mode: String,
    pub engine_id: String,
    pub model_id: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_turn_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_status: Option<String>,
    pub kind: String,
    #[serde(
        deserialize_with = "deserialize_i64_from_decimal_string_or_number",
        serialize_with = "serialize_i64_as_decimal_string"
    )]
    pub sort_timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcript_updated_at: Option<String>,
    #[serde(default)]
    pub native_attributes: NativeSessionAttributesPayload,
}

pub fn serialize_i64_as_decimal_string<S>(value: &i64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

pub fn parse_i64_decimal_string<E>(value: &str) -> Result<i64, E>
where
    E: serde::de::Error,
{
    value
        .trim()
        .parse::<i64>()
        .map_err(|_| E::custom("expected an i64 decimal string"))
}

pub fn deserialize_i64_from_decimal_string_or_number<'de, D>(
    deserializer: D,
) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::String(value) => parse_i64_decimal_string::<D::Error>(&value),
        serde_json::Value::Number(value) => value
            .as_i64()
            .ok_or_else(|| serde::de::Error::custom("expected an i64 JSON number")),
        _ => Err(serde::de::Error::custom("expected an i64 decimal string")),
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionDetailPayload {
    pub summary: NativeSessionSummaryPayload,
    pub messages: Vec<NativeSessionMessagePayload>,
}

#[cfg(test)]
mod tests {
    use super::NativeSessionAttributesPayload;

    #[test]
    fn native_attribute_cwd_is_deserializable_but_never_serialized() {
        let payload = NativeSessionAttributesPayload {
            cwd: Some("C:/private/project".to_owned()),
            ..Default::default()
        };

        let serialized = serde_json::to_value(payload).expect("serialize native attributes");
        assert!(serialized.get("cwd").is_none());
    }
}
