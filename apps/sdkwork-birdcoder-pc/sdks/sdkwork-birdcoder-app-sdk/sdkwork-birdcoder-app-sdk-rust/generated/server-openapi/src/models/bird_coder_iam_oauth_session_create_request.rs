use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamOAuthSessionCreateRequest {
    pub code: String,

    #[serde(rename = "deviceId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,

    #[serde(rename = "deviceType")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_type: Option<String>,

    pub provider: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
}
