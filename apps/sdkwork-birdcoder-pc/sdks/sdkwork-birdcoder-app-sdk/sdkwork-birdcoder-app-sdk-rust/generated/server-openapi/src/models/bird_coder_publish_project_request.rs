use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderPublishProjectRequest {
    #[serde(rename = "endpointUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub endpoint_url: Option<String>,

    #[serde(rename = "environmentKey")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub environment_key: Option<String>,

    #[serde(rename = "releaseKind")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_kind: Option<String>,

    #[serde(rename = "releaseVersion")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_version: Option<String>,

    #[serde(rename = "rolloutStage")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rollout_stage: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime: Option<String>,

    #[serde(rename = "targetId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_id: Option<String>,

    #[serde(rename = "targetName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_name: Option<String>,
}
