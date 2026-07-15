use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderNativeSessionAttributes {
    #[serde(rename = "schemaVersion")]
    pub schema_version: i64,

    #[serde(rename = "sessionTreeId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_tree_id: Option<String>,

    #[serde(rename = "parentSessionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_session_id: Option<String>,

    #[serde(rename = "forkedFromSessionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub forked_from_session_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,

    #[serde(rename = "providerVersion")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_version: Option<String>,

    #[serde(rename = "modelProvider")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model_provider: Option<String>,

    #[serde(rename = "projectId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,

    #[serde(rename = "gitBranch")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_branch: Option<String>,

    #[serde(rename = "gitCommit")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_commit: Option<String>,

    #[serde(rename = "gitRepositoryUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_repository_url: Option<String>,

    #[serde(rename = "agentName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_name: Option<String>,

    #[serde(rename = "agentRole")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_role: Option<String>,

    #[serde(rename = "isEphemeral")]
    pub is_ephemeral: bool,

    #[serde(rename = "isSidechain")]
    pub is_sidechain: bool,

    pub metadata: std::collections::HashMap<String, serde_json::Value>,
}
