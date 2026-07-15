use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateProjectRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    pub name: String,

    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
}
