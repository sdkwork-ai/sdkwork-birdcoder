use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderCodingSessionTurnCurrentFileContext};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionTurnIdeContext {
    #[serde(rename = "workspaceId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,

    #[serde(rename = "projectId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,

    #[serde(rename = "sessionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,

    #[serde(rename = "currentFile")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_file: Option<BirdCoderCodingSessionTurnCurrentFileContext>,
}
