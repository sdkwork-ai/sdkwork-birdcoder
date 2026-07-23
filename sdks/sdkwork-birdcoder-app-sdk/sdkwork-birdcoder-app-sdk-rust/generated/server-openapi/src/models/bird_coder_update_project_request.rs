use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderUpdateProjectRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,

    #[serde(rename = "projectKind")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_kind: Option<String>,

    /// Stable sdkwork-agents project identifier.
    #[serde(rename = "defaultAgentProjectId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_agent_project_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}
