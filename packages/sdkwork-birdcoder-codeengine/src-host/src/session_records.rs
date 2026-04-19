use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineSessionCommandRecord {
    pub command: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
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
    pub host_mode: String,
    pub engine_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_turn_at: Option<String>,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_cwd: Option<String>,
    pub sort_timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcript_updated_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineSessionDetailRecord {
    pub summary: CodeEngineSessionSummaryRecord,
    pub messages: Vec<CodeEngineSessionMessageRecord>,
}
