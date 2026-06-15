use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderEngineCapabilityMatrix {
    pub chat: bool,

    pub streaming: bool,

    #[serde(rename = "structuredOutput")]
    pub structured_output: bool,

    #[serde(rename = "toolCalls")]
    pub tool_calls: bool,

    pub planning: bool,

    #[serde(rename = "patchArtifacts")]
    pub patch_artifacts: bool,

    #[serde(rename = "commandArtifacts")]
    pub command_artifacts: bool,

    #[serde(rename = "todoArtifacts")]
    pub todo_artifacts: bool,

    #[serde(rename = "ptyArtifacts")]
    pub pty_artifacts: bool,

    #[serde(rename = "previewArtifacts")]
    pub preview_artifacts: bool,

    #[serde(rename = "testArtifacts")]
    pub test_artifacts: bool,

    #[serde(rename = "approvalCheckpoints")]
    pub approval_checkpoints: bool,

    #[serde(rename = "sessionResume")]
    pub session_resume: bool,

    #[serde(rename = "remoteBridge")]
    pub remote_bridge: bool,

    pub mcp: bool,
}
